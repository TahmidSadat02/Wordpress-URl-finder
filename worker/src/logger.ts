/**
 * logger.ts
 *
 * Structured logger for the verified-domain collector.
 *
 * Every log line is prefixed with an ISO timestamp and a severity tag
 * so output can be piped into any log aggregator without changes.
 *
 * Usage:
 *   import { log } from "./logger";
 *   log.info("Processing started");
 *   log.stats(stats);
 *   log.verify("example.com", true, "wp-json");
 *   log.warc("https://…/00274.warc.gz", 3);
 */

/* ── Types ──────────────────────────────────────────────────────────── */

/** Aggregate counters tracked by the runner. */
export interface Stats {
  scanned: number;
  candidates: number;
  verified: number;
  rejected: number;
  inserted: number;
  duplicates: number;

  /** Running sum of verification latencies (ms) for averaging. */
  verifyLatencySum: number;
  /** Number of completed verifications (for averaging). */
  verifyLatencyCount: number;

  /** Highest queue depth observed during the run. */
  peakQueueSize: number;
}

/** Create a zero-initialised Stats object. */
export function createStats(existingInserted = 0): Stats {
  return {
    scanned: 0,
    candidates: 0,
    verified: 0,
    rejected: 0,
    inserted: existingInserted,
    duplicates: 0,
    verifyLatencySum: 0,
    verifyLatencyCount: 0,
    peakQueueSize: 0,
  };
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function ts(): string {
  return new Date().toISOString();
}

/** Format bytes as human-readable MB string. */
function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/** Track peak RSS across the entire process lifetime. */
let peakRssBytes = 0;

function updatePeakRss(): number {
  const rss = process.memoryUsage.rss();
  if (rss > peakRssBytes) peakRssBytes = rss;
  return rss;
}

/* ── Logger ─────────────────────────────────────────────────────────── */

export const log = {
  info(message: string): void {
    console.log(`[${ts()}] [INFO]   ${message}`);
  },

  /**
   * [PROGRESS] block — printed every PROGRESS_INTERVAL scanned records.
   * Includes: records scanned, candidates found, verified, inserted,
   * queue size, and memory.
   */
  progress(
    recordsProcessed: number,
    candidatesFound: number,
    verified: number,
    inserted: number,
    queueSize: number
  ): void {
    const rss = updatePeakRss();
    console.log(
      `[${ts()}] [PROGRESS] records=${recordsProcessed.toLocaleString()}` +
        `  candidates=${candidatesFound}` +
        `  verified=${verified}` +
        `  inserted=${inserted}` +
        `  queue=${queueSize}` +
        `  mem=${mb(rss)}MB`
    );
  },

  match(domain: string, candidateCount: number): void {
    console.log(`[${ts()}] [CAND]   (${candidateCount}) ${domain}`);
  },

  /** Log full stats summary. */
  stats(s: Stats): void {
    console.log(
      `[${ts()}] [STATS]  scanned=${s.scanned}  candidates=${s.candidates}` +
        `  verified=${s.verified}  rejected=${s.rejected}` +
        `  inserted=${s.inserted}  duplicates=${s.duplicates}`
    );
  },

  /** Log a verification result. */
  verify(domain: string, ok: boolean, reason: string): void {
    if (ok) {
      console.log(`[${ts()}] [VERIFY] ✓ ${domain} (${reason})`);
    } else {
      console.log(`[${ts()}] [REJECT] ✗ ${domain} (${reason})`);
    }
  },

  /** Log WARC segment start. */
  warc(url: string, segmentNumber: number): void {
    // Show just the filename, not the full URL
    const filename = url.split("/").pop() ?? url;
    console.log(`[${ts()}] [WARC]   Starting segment #${segmentNumber}: ${filename}`);
  },

  /** Log a retry attempt. */
  retry(domain: string, attempt: number, maxRetries: number, err: string): void {
    console.log(
      `[${ts()}] [RETRY]  ${domain} attempt ${attempt}/${maxRetries}: ${err}`
    );
  },

  /** Log database insert result. */
  db(total: number, inserted: number, skipped: number): void {
    console.log(
      `[${ts()}] [DB]     total=${total}  inserted=${inserted}  skipped_dupes=${skipped}`
    );
  },

  /** Log memory usage. */
  memory(): void {
    const usage = process.memoryUsage();
    console.log(
      `[${ts()}] [MEM]    rss=${mb(usage.rss)}MB  heap=${mb(usage.heapUsed)}/${mb(usage.heapTotal)}MB`
    );
  },

  done(stats: Stats): void {
    console.log(
      `[${ts()}] [DONE]   Finished. inserted=${stats.inserted}  verified=${stats.verified}  total_scanned=${stats.scanned}`
    );
  },

  /**
   * Print the final runtime summary table.
   *
   * ───────────────────────────────────────────────────
   * Runtime
   * ───────────────────────────────────────────────────
   * Duration:            12.4s
   * Candidates:          1,234
   * Verified:            567
   * Rejected:            667
   * Inserted:            500
   * Duplicates:          67
   * Verification Rate:   45.9%
   * Peak Queue:          100
   * Peak RSS:            128.3 MB
   * Average Verify:      84.2 ms
   * ───────────────────────────────────────────────────
   */
  runtimeSummary(stats: Stats, startTime: number): void {
    updatePeakRss();
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSec = (durationMs / 1000).toFixed(1);
    const verifyRate =
      stats.candidates > 0
        ? ((stats.verified / stats.candidates) * 100).toFixed(1)
        : "0.0";
    const avgVerifyMs =
      stats.verifyLatencyCount > 0
        ? (stats.verifyLatencySum / stats.verifyLatencyCount).toFixed(1)
        : "0.0";

    const sep = "─".repeat(55);
    const lines = [
      sep,
      "Runtime",
      sep,
      `Duration:            ${durationSec}s`,
      `Candidates:          ${stats.candidates.toLocaleString()}`,
      `Verified:            ${stats.verified.toLocaleString()}`,
      `Rejected:            ${stats.rejected.toLocaleString()}`,
      `Inserted:            ${stats.inserted.toLocaleString()}`,
      `Duplicates:          ${stats.duplicates.toLocaleString()}`,
      `Verification Rate:   ${verifyRate}%`,
      `Peak Queue:          ${stats.peakQueueSize}`,
      `Peak RSS:            ${mb(peakRssBytes)} MB`,
      `Average Verify:      ${avgVerifyMs} ms`,
      sep,
    ];

    for (const line of lines) {
      console.log(line);
    }
  },

  error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : String(err ?? "");
    console.error(`[${ts()}] [ERROR]  ${message}${detail ? ": " + detail : ""}`);
  },
};
