/**
 * warcIndex.ts
 *
 * Iterates WARC file paths from the Common Crawl index.
 *
 * Common Crawl publishes a `warc.paths.gz` file for each crawl that
 * lists every WARC segment (~90,000 files per crawl).  This module
 * fetches and decompresses that list, yielding full URLs one at a time.
 *
 * This allows the runner to process multiple WARC files sequentially
 * until the verified-domain target is reached, rather than being
 * limited to a single hardcoded segment.
 */

import * as https from "https";
import * as zlib from "zlib";
import { IncomingMessage } from "http";
import { CC_CRAWL_ID, CC_SEGMENT_LIMIT } from "./config";
import { log } from "./logger";

const CC_BASE = "https://data.commoncrawl.org";

/**
 * Fetch an HTTPS URL and return the response stream.
 */
function fetchStream(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        res.destroy();
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
  });
}

/**
 * Async generator that yields full WARC file URLs from the
 * Common Crawl warc.paths.gz index for the configured crawl.
 *
 * @example
 *   for await (const url of iterateWarcUrls()) {
 *     // url = "https://data.commoncrawl.org/crawl-data/CC-MAIN-…/…warc.gz"
 *   }
 */
export async function* iterateWarcUrls(): AsyncGenerator<string> {
  const indexUrl = `${CC_BASE}/crawl-data/${CC_CRAWL_ID}/warc.paths.gz`;
  log.info(`Fetching WARC index: ${indexUrl}`);

  const httpStream = await fetchStream(indexUrl);
  const gunzip = zlib.createGunzip();
  httpStream.pipe(gunzip);

  let count = 0;
  let remainder = "";

  // Read decompressed chunks, split into lines (one WARC path per line).
  for await (const chunk of gunzip as AsyncIterable<Buffer>) {
    const text = remainder + chunk.toString("utf8");
    const lines = text.split("\n");

    // Last element may be a partial line — save it.
    remainder = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Only yield WARC files (skip wat/wet files if present).
      if (!trimmed.endsWith(".warc.gz")) continue;

      count++;
      yield `${CC_BASE}/${trimmed}`;

      // Respect the segment limit if configured.
      if (CC_SEGMENT_LIMIT > 0 && count >= CC_SEGMENT_LIMIT) {
        log.info(`Reached CC_SEGMENT_LIMIT (${CC_SEGMENT_LIMIT}) — stopping index iteration`);
        httpStream.destroy();
        return;
      }
    }
  }

  // Handle any trailing partial line.
  if (remainder.trim() && remainder.trim().endsWith(".warc.gz")) {
    count++;
    yield `${CC_BASE}/${remainder.trim()}`;
  }

  log.info(`WARC index complete: ${count} segments available`);
}
