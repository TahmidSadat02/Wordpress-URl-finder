/**
 * config.ts
 *
 * Central configuration for the WARC worker.
 *
 * All tuneable constants live here so you never need to dig into
 * business logic just to change a limit or target URL.
 *
 * Resumable-friendly note:
 *   CHECKPOINT_EVERY is wired up here for future use. The runner can
 *   read it and call saveCheckpoint() every N records without changes
 *   to this file.
 */

/** The Common Crawl WARC file to process (streamed, never fully downloaded). */
export const WARC_URL =
  "https://data.commoncrawl.org/crawl-data/CC-MAIN-2026-21/segments/1778213376806.31/warc/CC-MAIN-20260508104411-20260508134411-00274.warc.gz";

/**
 * URL sub-strings that confirm a page was served by WordPress.
 * These appear in HTML responses as asset paths, login pages, etc.
 */
export const WP_FOOTPRINTS: string[] = [
  "/wp-content/",
  "/wp-login.php",
  "/wp-admin/",
  "/wp-includes/",
];

/** Stop collecting new URLs once we have this many distinct matches. */
export const MAX_URLS = 20;

/**
 * Log a progress summary every N records processed.
 * Keeping this low gives visibility into large WARC files.
 */
export const LOG_EVERY_N_RECORDS = 1_000;

/**
 * (Future) Save a checkpoint file every N records so the worker can
 * resume from where it left off after a crash.
 * Not yet implemented — set to 0 to disable.
 */
export const CHECKPOINT_EVERY = 0;
