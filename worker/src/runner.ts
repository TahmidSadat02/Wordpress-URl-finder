/**
 * runner.ts
 *
 * Orchestrates the full WARC processing pipeline:
 *
 *   1. Open the WARC stream  (warcParser)
 *   2. Feed each record through WordPress detection  (detector)
 *   3. Collect unique site origins until MAX_URLS is reached
 *   4. Abort the download early (saves bandwidth)
 *   5. Insert results into PostgreSQL via Prisma  (db)
 *   6. Emit progress logs throughout  (logger)
 *
 * Resumable-friendly note:
 *   A checkpoint slot is marked with TODO comments below.
 *   To add resumability:
 *     - Load a checkpoint file at startup → skip `recordsProcessed < checkpoint.offset` records.
 *     - Save a checkpoint file every CHECKPOINT_EVERY records.
 *   No other files need to change.
 */

import { WARC_URL, MAX_URLS, LOG_EVERY_N_RECORDS } from "./config";
import { isWordPressBody, isWordPressUrl, extractOrigin } from "./detector";
import { insertDomains, disconnect } from "./db";
import { log } from "./logger";
import { streamWarcRecords } from "./warcParser";

export async function run(): Promise<void> {
  log.info(`Starting WARC worker`);
  log.info(`Target file: ${WARC_URL}`);
  log.info(`Goal: collect ${MAX_URLS} unique WordPress site origins`);

  const found = new Set<string>();   // deduplicated WordPress origins
  let recordsProcessed = 0;

  // Use a ref object to hold the abort function.
  // TypeScript's control-flow narrowing can incorrectly infer that a
  // mutable variable set inside a callback remains null at the call site.
  // Wrapping in an object prevents this false narrowing.
  const abortRef: { fn: (() => void) | null } = { fn: null };

  // TODO (checkpoint): load checkpoint here and set recordsProcessed to the saved offset.

  try {
    const parser = streamWarcRecords(WARC_URL, (destroyFn) => {
      abortRef.fn = destroyFn;
    });

    for await (const record of parser) {
      recordsProcessed++;

      // TODO (checkpoint): if recordsProcessed < savedOffset, continue;

      // ── Detection ──────────────────────────────────────────────────────────
      const isWp =
        isWordPressUrl(record.targetUri) ||
        isWordPressBody(record.body);

      if (isWp) {
        const origin = extractOrigin(record.targetUri);
        if (origin && !found.has(origin)) {
          found.add(origin);
          log.match(origin, found.size);

          // ── Early exit ──────────────────────────────────────────────────────
          if (found.size >= MAX_URLS) {
            log.info(`Reached ${MAX_URLS} URLs — aborting stream to save bandwidth`);
            if (abortRef.fn !== null) abortRef.fn();
            break;
          }
        }
      }

      // ── Progress logging ───────────────────────────────────────────────────
      if (recordsProcessed % LOG_EVERY_N_RECORDS === 0) {
        log.progress(recordsProcessed, found.size);

        // TODO (checkpoint): if CHECKPOINT_EVERY > 0 && recordsProcessed % CHECKPOINT_EVERY === 0,
        //   saveCheckpoint({ offset: recordsProcessed, urls: [...found] });
      }
    }
  } catch (err: unknown) {
    // Treat a destroyed stream (from our own abort) as a normal exit.
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("destroyed") && !msg.includes("aborted")) {
      log.error("Unexpected error during stream processing", err);
      throw err;
    }
  }

  // ── Final progress line ────────────────────────────────────────────────────
  log.progress(recordsProcessed, found.size);

  // ── Save results to PostgreSQL ─────────────────────────────────────────────
  const urls = [...found];
  if (urls.length === 0) {
    log.error(
      "No WordPress URLs found. The WARC file may not contain WordPress sites. " +
        "Try changing WARC_URL in src/config.ts to a different segment."
    );
    await disconnect();
    process.exit(1);
  }

  try {
    const result = await insertDomains(urls, WARC_URL);
    log.db(result.total, result.inserted, result.skipped);
    log.done(urls.length);
  } finally {
    await disconnect();
  }
}
