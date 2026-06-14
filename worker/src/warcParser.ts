/**
 * warcParser.ts
 *
 * Streams a gzip-compressed WARC file from a URL and yields parsed
 * WARC records one at a time via an async iterator.
 *
 * WHY STREAM?
 *   Common Crawl WARC files are 700 MB–1 GB each. Streaming means we
 *   start finding URLs within seconds and stop the download as soon as
 *   we have enough matches — no disk space wasted.
 *
 * HOW A WARC RECORD LOOKS (simplified):
 * ─────────────────────────────────────
 *   WARC/1.0\r\n
 *   WARC-Type: response\r\n
 *   WARC-Target-URI: https://example.com/\r\n
 *   Content-Length: 1234\r\n
 *   \r\n
 *   HTTP/1.1 200 OK\r\n
 *   Content-Type: text/html\r\n
 *   \r\n
 *   <html>…</html>
 *   \r\n\r\n          ← record separator
 *
 * We only yield "response" records with HTTP 200 + text/html.
 *
 * Resumable-friendly note:
 *   The caller (runner.ts) drives iteration and can break out of the
 *   for-await loop at any time.  To add checkpointing, track a record
 *   counter in the runner and save state every N records.
 */

import * as https from "https";
import * as zlib from "zlib";
import { IncomingMessage } from "http";
import { Readable } from "stream";

/** A parsed WARC response record. */
export interface WarcRecord {
  /** The original URL that was crawled (WARC-Target-URI). */
  targetUri: string;
  /** The HTTP response body text. */
  body: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function openHttpsStream(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        res.destroy();
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
  });
}

/** Find the first occurrence of `needle` inside `haystack`. */
function indexOf(haystack: Buffer, needle: Buffer, start = 0): number {
  const n = needle.length;
  const limit = haystack.length - n;
  outer: for (let i = start; i <= limit; i++) {
    for (let j = 0; j < n; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Streams the WARC file at `warcUrl` and yields one `WarcRecord` per
 * qualifying HTTP response (200 OK, text/html only).
 *
 * Call `parser.destroy()` to abort the download early.
 *
 * @param warcUrl  HTTPS URL of the .warc.gz file.
 * @param onAbort  Callback to receive the destroy function once streaming starts.
 */
export async function* streamWarcRecords(
  warcUrl: string,
  onAbort?: (destroyFn: () => void) => void
): AsyncGenerator<WarcRecord> {
  const DOUBLE_CRLF = Buffer.from("\r\n\r\n");

  // ── 1. Open the network stream ────────────────────────────────────────────
  const httpStream = await openHttpsStream(warcUrl);
  const gunzip = zlib.createGunzip();
  httpStream.pipe(gunzip);

  // Expose a way for the caller to abort the download mid-stream.
  if (onAbort) {
    onAbort(() => {
      httpStream.destroy();
      gunzip.destroy();
    });
  }

  // ── 2. Convert the gunzip Readable into an async chunk iterator ───────────
  // Node 16+ has Readable.toWeb() / Readable[Symbol.asyncIterator]().
  // We use the built-in async iterator to pull chunks.
  const chunks: Buffer[] = [];
  let streamDone = false;
  let streamError: Error | null = null;
  let notify: (() => void) | null = null;

  gunzip.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
    notify?.();
  });
  gunzip.on("end", () => {
    streamDone = true;
    notify?.();
  });
  gunzip.on("error", (err: Error) => {
    streamError = err;
    streamDone = true;
    notify?.();
  });
  httpStream.on("error", (err: Error) => {
    streamError = err;
    streamDone = true;
    notify?.();
  });

  /** Wait until new data arrives or the stream finishes. */
  function waitForData(): Promise<void> {
    return new Promise((resolve) => {
      notify = () => {
        notify = null;
        resolve();
      };
    });
  }

  // ── 3. Buffer accumulator ─────────────────────────────────────────────────
  let buf = Buffer.alloc(0);

  function appendChunks(): void {
    if (chunks.length === 0) return;
    buf = Buffer.concat([buf, ...chunks.splice(0)]);
  }

  // ── 4. Main parse loop ───────────────────────────────────────────────────
  while (true) {
    appendChunks();

    // Not enough data yet — wait for more unless stream is done.
    if (buf.length === 0) {
      if (streamDone) break;
      await waitForData();
      continue;
    }

    // ── 4a. Locate the end of the WARC header block (first \r\n\r\n) ──────
    const headerEnd = indexOf(buf, DOUBLE_CRLF);
    if (headerEnd === -1) {
      // Header not yet complete — need more data.
      if (streamDone) break;
      await waitForData();
      continue;
    }

    const warcHeaderText = buf.slice(0, headerEnd).toString("latin1");

    // ── 4b. Parse WARC fields ───────────────────────────────────────────────
    const warcType =
      warcHeaderText.match(/^WARC-Type:\s*(\S+)/im)?.[1]?.toLowerCase() ?? "";
    const targetUri =
      warcHeaderText.match(/^WARC-Target-URI:\s*(\S+)/im)?.[1] ?? "";
    const contentLength = parseInt(
      warcHeaderText.match(/^Content-Length:\s*(\d+)/im)?.[1] ?? "0",
      10
    );

    // ── 4c. Check we have the full payload + trailing separator ────────────
    const payloadStart = headerEnd + 4; // skip \r\n\r\n
    const payloadEnd = payloadStart + contentLength;
    const recordEnd = payloadEnd + 4; // skip trailing \r\n\r\n

    if (buf.length < recordEnd) {
      // Payload not yet complete.
      if (streamDone) break;
      await waitForData();
      appendChunks();
      continue;
    }

    // ── 4d. Advance the buffer past this record ─────────────────────────────
    const payload = buf.slice(payloadStart, payloadEnd);
    buf = buf.slice(recordEnd);

    // ── 4e. Filter: only WARC response records ──────────────────────────────
    if (warcType !== "response") continue;

    // ── 4f. Split HTTP envelope: header vs body ─────────────────────────────
    const httpHeaderEnd = indexOf(payload, DOUBLE_CRLF);
    if (httpHeaderEnd === -1) continue;

    const httpHeaderText = payload.slice(0, httpHeaderEnd).toString("latin1");
    const httpBody = payload.slice(httpHeaderEnd + 4);

    // ── 4g. Filter: only HTTP 200 text/html ────────────────────────────────
    const statusCode = parseInt(
      httpHeaderText.match(/^HTTP\/\S+\s+(\d+)/i)?.[1] ?? "0",
      10
    );
    if (statusCode !== 200) continue;

    const contentType =
      httpHeaderText
        .match(/^Content-Type:\s*([^\r\n;]+)/im)?.[1]
        ?.trim()
        .toLowerCase() ?? "";
    if (!contentType.includes("text/html")) continue;

    // ── 4h. Yield the record ─────────────────────────────────────────────────
    yield { targetUri, body: httpBody.toString("utf8") };
  }

  if (streamError) {
    throw streamError;
  }

  // Final cleanup
  httpStream.destroy();
}
