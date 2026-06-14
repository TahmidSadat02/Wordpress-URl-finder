/**
 * output.ts
 *
 * Handles writing collected URLs to disk.
 *
 * Responsibilities:
 *  - Ensure the output directory exists before writing.
 *  - Write one URL per line to OUTPUT_FILE.
 *  - Overwrite any existing file so each run is self-contained.
 *
 * Resumable-friendly note:
 *   Replace writeFileSync with an appendFileSync call inside the
 *   runner loop to flush partial results as they arrive.  That way
 *   a crash mid-run still persists everything collected so far.
 */

import * as fs from "fs";
import * as path from "path";

/** Default output path (kept for optional text-file fallback). */
const OUTPUT_FILE = "output/wordpress_urls.txt";

/**
 * Saves the given array of URLs to OUTPUT_FILE, one per line.
 * Creates intermediate directories automatically.
 *
 * @param urls - Deduplicated list of WordPress site origins.
 */
export function saveResults(urls: string[]): void {
  const absPath = path.resolve(OUTPUT_FILE);
  const dir = path.dirname(absPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(absPath, urls.join("\n") + "\n", "utf-8");
}

/**
 * (Future) Append a single URL to the output file immediately after
 * discovery, so partial results survive a crash.
 *
 * Uncomment and call from the runner loop to activate incremental saves.
 *
 * @param url - The URL to append.
 */
// export function appendResult(url: string): void {
//   const absPath = path.resolve(OUTPUT_FILE);
//   const dir = path.dirname(absPath);
//   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//   fs.appendFileSync(absPath, url + "\n", "utf-8");
// }
