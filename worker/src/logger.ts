/**
 * logger.ts
 *
 * Minimal structured logger for the worker.
 *
 * Every log line is prefixed with an ISO timestamp and a severity tag
 * so output can be piped into any log aggregator later without changes
 * to the calling code.
 *
 * Usage:
 *   import { log } from "./logger";
 *   log.info("Processing started");
 *   log.progress(processed, found);
 *   log.db(total, inserted, skipped);
 *   log.done(found);
 *   log.error("Something went wrong", err);
 */

function ts(): string {
  return new Date().toISOString();
}

export const log = {
  info(message: string): void {
    console.log(`[${ts()}] [INFO]  ${message}`);
  },

  progress(recordsProcessed: number, matchesFound: number): void {
    console.log(
      `[${ts()}] [PROG]  records_processed=${recordsProcessed.toLocaleString()}  matches_found=${matchesFound}`
    );
  },

  match(url: string, matchesFound: number): void {
    console.log(
      `[${ts()}] [MATCH] (${matchesFound}) ${url}`
    );
  },

  db(total: number, inserted: number, skipped: number): void {
    console.log(
      `[${ts()}] [DB]    total_discovered=${total}  inserted=${inserted}  skipped_duplicates=${skipped}`
    );
  },

  done(matchesFound: number): void {
    console.log(
      `[${ts()}] [DONE]  Finished. total_matches=${matchesFound}  output=PostgreSQL`
    );
  },

  error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : String(err ?? "");
    console.error(`[${ts()}] [ERROR] ${message}${detail ? ": " + detail : ""}`);
  },
};
