/**
 * runner.ts
 *
 * Orchestrates the full verified-domain collection pipeline:
 *
 *   ┌────────────┐     ┌──────────────┐     ┌───────────────┐
 *   │ WARC Index │────▶│ WARC Parser  │────▶│ Bounded Queue │
 *   │ (segments) │     │ (candidates) │     │  (cap=100)    │
 *   └────────────┘     └──────────────┘     └───────┬───────┘
 *                                                   │
 *                                    ┌──────────────┼──────────────┐
 *                                    ▼              ▼              ▼
 *                              ┌──────────┐  ┌──────────┐  ┌──────────┐
 *                              │ Worker 1 │  │ Worker 2 │  │ Worker N │
 *                              │ verify() │  │ verify() │  │ verify() │
 *                              │ insert() │  │ insert() │  │ insert() │
 *                              └──────────┘  └──────────┘  └──────────┘
 *
 * The producer (WARC parser) feeds candidate domains into a bounded
 * queue.  N concurrent verification workers dequeue candidates, run
 * the 3-stage verification pipeline, and insert verified domains into
 * PostgreSQL.  The pipeline stops when VERIFIED_TARGET is reached.
 *
 * Optimizations over baseline:
 *  - Global CancellationController aborts all in-flight HTTP/DNS immediately
 *  - Queue supports pause/resume/clear for coordinated drain
 *  - AbortSignal threaded through every fetch() call
 *  - Runtime metrics with formatted summary table
 *  - Progress logging every N records
 *  - Graceful shutdown on SIGINT/SIGTERM
 *
 * Memory stays constant because:
 *  - The queue is bounded (QUEUE_SIZE items max).
 *  - The WARC parser buffers only one record at a time.
 *  - The candidate Set stores only domain strings (~50 bytes each).
 */

import {
  TARGET,
  VERIFY_CONCURRENCY,
  QUEUE_SIZE,
  PROGRESS_INTERVAL,
  LOG_MEMORY_EVERY,
} from "./config";
import { isWordPressBody, isWordPressUrl, extractHostname } from "./detector";
import { insertDomain, countDomains, disconnect } from "./db";
import { verifyDomain } from "./verifier";
import { log, createStats } from "./logger";
import { streamWarcRecords } from "./warcParser";
import { iterateWarcUrls } from "./warcIndex";
import { BoundedQueue } from "./queue";
import { CancellationController } from "./cancellation";
import { loadCheckpoint, saveCheckpoint, deleteCheckpoint } from "./checkpoint";

/* ── Types ──────────────────────────────────────────────────────────── */

interface Candidate {
  hostname: string;
  sourceWarc: string;
}

/* ── Main ───────────────────────────────────────────────────────────── */

export async function run(): Promise<void> {
  const startTime = Date.now();

  log.info("Starting verified-domain collector");
  log.info(`Target: ${TARGET} verified WordPress domains`);
  log.info(`Concurrency: ${VERIFY_CONCURRENCY} workers`);
  log.info(`Queue capacity: ${QUEUE_SIZE}`);

  // ── Load checkpoint ─────────────────────────────────────────────────
  const checkpoint = loadCheckpoint();
  let resumeWarcPath = checkpoint?.warcPath ?? null;
  let resumeRecordOffset = checkpoint?.recordOffset ?? 0;
  let startingVerifiedCount = checkpoint?.verifiedCount ?? 0;

  // ── Check existing progress ─────────────────────────────────────────
  const existingCount = await countDomains();
  if (existingCount > 0) {
    log.info(`Database: ${existingCount} domains already in database`);
  }

  // ── Shared state ────────────────────────────────────────────────────
  const stats = createStats(existingCount);
  if (checkpoint) {
    stats.verified = startingVerifiedCount;
    log.info(
      `Checkpoint detected: resuming from WARC ${resumeWarcPath?.split("/").pop()} ` +
        `at record offset ${resumeRecordOffset} (already verified: ${startingVerifiedCount})`
    );
  }

  /** Current state tracking for checkpointing */
  let currentWarcPath = resumeWarcPath ?? "";
  let currentWarcRecordIndex = resumeRecordOffset;

  /** Global cancellation — aborts all HTTP, DNS, and queue operations. */
  const cancellation = new CancellationController();

  // ── Checkpoint timer (runs every 60 seconds) ────────────────────────
  const CHECKPOINT_INTERVAL_MS = 60_000;
  const checkpointTimer = setInterval(() => {
    if (cancellation.isCancelled || !currentWarcPath) return;

    // Save max of the current index and the resume offset if we are still on the resume segment
    const offsetToSave = (currentWarcPath === resumeWarcPath)
      ? Math.max(currentWarcRecordIndex, resumeRecordOffset)
      : currentWarcRecordIndex;

    saveCheckpoint({
      warcPath: currentWarcPath,
      recordOffset: offsetToSave,
      verifiedCount: stats.verified,
      timestamp: new Date().toISOString(),
    });
    log.info(
      `[CHECKPOINT] State persisted. Segment: ${currentWarcPath.split("/").pop()} ` +
        `offset: ${offsetToSave} verified: ${stats.verified}`
    );
  }, CHECKPOINT_INTERVAL_MS);

  /** Domains already seen as candidates (dedup before enqueueing). */
  const seenCandidates = new Set<string>();

  const queue = new BoundedQueue<Candidate>(QUEUE_SIZE);

  /** Promise that workers resolve — used for awaiting shutdown. */
  let workersPromise: Promise<void[]> | null = null;

  // ── Graceful shutdown handler ───────────────────────────────────────
  let shutdownInitiated = false;

  async function gracefulShutdown(signal: string): Promise<void> {
    if (shutdownInitiated) return;
    shutdownInitiated = true;

    // Clear the checkpoint timer immediately
    clearInterval(checkpointTimer);

    // Save final checkpoint if we haven't reached target yet
    if (stats.inserted < TARGET && currentWarcPath) {
      const offsetToSave = (currentWarcPath === resumeWarcPath)
        ? Math.max(currentWarcRecordIndex, resumeRecordOffset)
        : currentWarcRecordIndex;

      saveCheckpoint({
        warcPath: currentWarcPath,
        recordOffset: offsetToSave,
        verifiedCount: stats.verified,
        timestamp: new Date().toISOString(),
      });
      log.info(`[CHECKPOINT] Saved final checkpoint on ${signal}`);
    }

    log.info(`\n${signal} received — initiating graceful shutdown…`);

    // 1. Cancel all in-flight operations.
    cancellation.cancel(`shutdown:${signal}`);

    // 2. Stop accepting new items and discard queued work.
    queue.clear();
    queue.close();

    // 3. Wait for workers to finish their current item and exit.
    if (workersPromise) {
      try {
        await workersPromise;
      } catch {
        // Workers may throw on cancelled operations — that's fine.
      }
    }

    // 4. Print final metrics.
    log.runtimeSummary(stats, startTime);

    // 5. Disconnect Prisma.
    await disconnect();

    log.info("Shutdown complete.");
    process.exit(0);
  }

  // Register signal handlers.
  const onSigint = () => { void gracefulShutdown("SIGINT"); };
  const onSigterm = () => { void gracefulShutdown("SIGTERM"); };
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  // ── Verification workers ────────────────────────────────────────────
  async function worker(workerId: number): Promise<void> {
    while (true) {
      // Exit immediately if cancelled.
      if (cancellation.isCancelled) break;

      const candidate = await queue.dequeue();
      if (candidate === null) break; // Queue closed, no more work.

      if (cancellation.isCancelled) break; // Re-check after dequeue wake.

      const { hostname, sourceWarc } = candidate;
      stats.scanned++;

      try {
        // Measure verification latency.
        const verifyStart = Date.now();
        const result = await verifyDomain(hostname, cancellation.signal);
        const verifyMs = Date.now() - verifyStart;

        stats.verifyLatencySum += verifyMs;
        stats.verifyLatencyCount++;

        // If cancelled during verification, stop inserting.
        if (cancellation.isCancelled) break;

        if (!result.verified) {
          stats.rejected++;
          log.verify(hostname, false, result.reason);
          continue;
        }

        stats.verified++;
        log.verify(hostname, true, result.reason);

        // Insert into database.
        const dbResult = await insertDomain(hostname, sourceWarc);

        if (dbResult === "inserted") {
          stats.inserted++;
          log.info(
            `[Worker ${workerId}] Inserted #${stats.inserted}: ${hostname}`
          );

          // Check target — trigger global cancellation.
          if (stats.inserted >= TARGET && !cancellation.isCancelled) {
            cancellation.cancel("target reached");
            log.info(
              `🎯 Target reached! ${stats.inserted}/${TARGET} verified domains.`
            );
            queue.clear();
            queue.close();
            break;
          }
        } else {
          stats.duplicates++;
        }
      } catch (err) {
        // Swallow cancellation errors silently.
        if (cancellation.isCancelled) break;

        stats.rejected++;
        log.error(`[Worker ${workerId}] Failed to process ${hostname}`, err);
      }
    }
  }

  // ── Launch workers ──────────────────────────────────────────────────
  const workers: Promise<void>[] = [];
  for (let i = 1; i <= VERIFY_CONCURRENCY; i++) {
    workers.push(worker(i));
  }
  workersPromise = Promise.all(workers).then(() => { /* void */ }) as unknown as Promise<void[]>;

  // ── Producer: WARC streaming ────────────────────────────────────────
  let recordsProcessed = 0;
  let segmentNumber = 0;
  let foundResumeWarc = !resumeWarcPath;

  try {
    for await (const warcUrl of iterateWarcUrls()) {
      if (cancellation.isCancelled) break;

      segmentNumber++;

      if (!foundResumeWarc) {
        if (warcUrl === resumeWarcPath) {
          foundResumeWarc = true;
          log.info(`Found checkpoint WARC segment #${segmentNumber}. Resuming…`);
        } else {
          // Skip WARC files prior to the checkpointed one
          continue;
        }
      }

      currentWarcPath = warcUrl;
      currentWarcRecordIndex = 0;

      log.warc(warcUrl, segmentNumber);

      const abortRef: { fn: (() => void) | null } = { fn: null };

      try {
        const parser = streamWarcRecords(warcUrl, (destroyFn) => {
          abortRef.fn = destroyFn;
        });

        for await (const record of parser) {
          if (cancellation.isCancelled) {
            if (abortRef.fn) abortRef.fn();
            break;
          }

          currentWarcRecordIndex++;

          // If we are on the resumed segment, skip records up to resumeRecordOffset
          if (warcUrl === resumeWarcPath && currentWarcRecordIndex <= resumeRecordOffset) {
            continue;
          }

          recordsProcessed++;

          // ── WordPress pre-filter (from WARC body/URL) ───────────────
          const isWp =
            isWordPressUrl(record.targetUri) ||
            isWordPressBody(record.body);

          if (isWp) {
            const hostname = extractHostname(record.targetUri);
            if (hostname && !seenCandidates.has(hostname)) {
              seenCandidates.add(hostname);
              stats.candidates++;
              log.match(hostname, seenCandidates.size);

              // Track peak queue size.
              if (queue.size + 1 > stats.peakQueueSize) {
                stats.peakQueueSize = queue.size + 1;
              }

              // Enqueue for verification — blocks if queue is full.
              try {
                await queue.enqueue({ hostname, sourceWarc: warcUrl });
              } catch {
                // Queue was closed (target reached during enqueue wait).
                break;
              }

              // Update peak from actual queue state.
              if (queue.peakSize > stats.peakQueueSize) {
                stats.peakQueueSize = queue.peakSize;
              }
            }
          }

          // ── Progress logging ────────────────────────────────────────
          if (PROGRESS_INTERVAL > 0 && recordsProcessed % PROGRESS_INTERVAL === 0) {
            log.progress(
              recordsProcessed,
              stats.candidates,
              stats.verified,
              stats.inserted,
              queue.size
            );
          }

          // ── Memory logging ──────────────────────────────────────────
          if (
            LOG_MEMORY_EVERY > 0 &&
            recordsProcessed % LOG_MEMORY_EVERY === 0
          ) {
            log.memory();
          }
        }
      } catch (err: unknown) {
        // A destroyed stream (from our own abort) is a normal exit.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("destroyed") && !msg.includes("aborted")) {
          log.error(`Error processing WARC segment #${segmentNumber}`, err);
          // Continue to the next segment rather than crashing.
        }
      }

      // Free candidate references for this segment to help GC
      // (the Set itself persists for cross-segment dedup).
    }
  } catch (err) {
    if (!cancellation.isCancelled) {
      log.error("Fatal error in WARC index iteration", err);
    }
  }

  // ── Close queue and wait for workers ────────────────────────────────
  queue.close();
  await Promise.all(workers);

  // ── Clean up signal handlers & timers ───────────────────────────────
  process.removeListener("SIGINT", onSigint);
  process.removeListener("SIGTERM", onSigterm);
  clearInterval(checkpointTimer);

  // ── Final summary ──────────────────────────────────────────────────
  log.runtimeSummary(stats, startTime);

  if (stats.inserted < TARGET && !cancellation.isCancelled) {
    log.info(
      `⚠ Collected ${stats.inserted}/${TARGET} domains. ` +
        `Ran out of WARC segments. Try a different CC_CRAWL_ID or increase CC_SEGMENT_LIMIT.`
    );
  }

  // Delete checkpoint file upon successful/normal completion
  deleteCheckpoint();

  // ── Cleanup ────────────────────────────────────────────────────────
  await disconnect();
}
