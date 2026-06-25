/**
 * verifier.ts
 *
 * Three-stage domain verification pipeline:
 *
 *   1. DNS — resolve the hostname to confirm it's a live domain.
 *   2. HTTP — fetch the homepage, accept only 200/301/302.
 *   3. WordPress — probe WP-specific paths (/wp-json, /wp-login.php,
 *      /wp-content/) and check for `<meta name="generator"` tag.
 *
 * Each stage can fail independently.  The pipeline short-circuits on
 * the first failure and returns the rejection reason.
 *
 * All HTTP calls use the global `fetch()` (Node 18+) with
 * `AbortSignal.timeout()` for request-level timeouts, combined with
 * an optional external AbortSignal (for global cancellation) via
 * `AbortSignal.any()`.
 *
 * Transient network errors (ECONNRESET, ETIMEDOUT, etc.) are retried
 * up to MAX_RETRIES times with exponential backoff.
 */

import * as dns from "dns";
import {
  HTTP_TIMEOUT_MS,
  DNS_TIMEOUT_MS,
  MAX_RETRIES,
  RETRY_BASE_MS,
  TRANSIENT_ERRORS,
  WP_VERIFY_PATHS,
} from "./config";
import { log } from "./logger";

/* ── Types ──────────────────────────────────────────────────────────── */

export interface VerifyResult {
  verified: boolean;
  reason: string;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

/** Extract the error code from a Node.js / undici error. */
function errorCode(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    // Node system errors have a `code` property.
    if ("code" in err && typeof (err as { code: unknown }).code === "string") {
      return (err as { code: string }).code;
    }
    // undici / fetch errors may embed the code in cause.
    if ("cause" in err) {
      return errorCode((err as { cause: unknown }).cause);
    }
  }
  return "";
}

/** Check if an error is transient (worth retrying). */
function isTransient(err: unknown): boolean {
  const code = errorCode(err);
  if (code && TRANSIENT_ERRORS.has(code)) return true;

  // Also catch generic "abort" from timeouts (these are NOT retried by default,
  // but a timeout might be caused by a transient slowdown).
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("network timeout") || msg.includes("ETIMEDOUT")) return true;

  return false;
}

/** Check if an error is caused by the global cancellation signal. */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  const code = errorCode(err);
  return code === "ABORT_ERR";
}

/**
 * Sleep for `ms` milliseconds.
 * Clears immediately if the provided signal is aborted.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      // Clean up listener after timer fires normally.
      const originalResolve = resolve;
      resolve = () => {
        signal.removeEventListener("abort", onAbort);
        originalResolve();
      };
    }
  });
}

/**
 * Combine a per-request timeout with an optional external cancellation
 * signal.  Uses AbortSignal.any() (Node 20+).
 */
function combinedSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  return AbortSignal.any([timeout, external]);
}

/**
 * Execute `fn` with retries on transient errors.
 * Uses exponential backoff: 500ms, 1000ms, 2000ms, …
 * Bails immediately if the external signal is aborted.
 */
async function withRetry<T>(
  domain: string,
  label: string,
  fn: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    // Bail before each attempt if cancelled.
    if (signal?.aborted) {
      throw signal.reason ?? new Error("Aborted");
    }

    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      // If cancelled globally, don't retry.
      if (isAbortError(err) || signal?.aborted) {
        throw err;
      }

      if (attempt <= MAX_RETRIES && isTransient(err)) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        const errMsg = err instanceof Error ? err.message : String(err);
        log.retry(domain, attempt, MAX_RETRIES + 1, `${label}: ${errMsg}`);
        await sleep(delay, signal);
        continue;
      }

      throw err;
    }
  }

  throw lastErr;
}

/* ── Stage 1: DNS Resolution ────────────────────────────────────────── */

async function resolveDns(hostname: string, signal?: AbortSignal): Promise<void> {
  await withRetry(hostname, "DNS", () =>
    new Promise<void>((resolve, reject) => {
      // Check abort before starting.
      if (signal?.aborted) {
        reject(signal.reason ?? new Error("Aborted"));
        return;
      }

      const timer = setTimeout(
        () => reject(new Error("DNS_TIMEOUT")),
        DNS_TIMEOUT_MS
      );

      // Cancel DNS timer on external abort.
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal?.reason ?? new Error("Aborted"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      dns.resolve4(hostname, (err) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }),
    signal
  );
}

/* ── Stage 2: HTTP Probe ────────────────────────────────────────────── */

/**
 * Fetches the homepage and returns { status, body }.
 * Accepts only 200, 301, 302.
 * Follows redirects manually to control what we accept.
 */
interface HttpProbeResult {
  status: number;
  body: string;
  finalUrl: string;
}

async function probeHomepage(
  hostname: string,
  signal?: AbortSignal
): Promise<HttpProbeResult> {
  return withRetry(hostname, "HTTP", async () => {
    const url = `https://${hostname}/`;

    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: combinedSignal(HTTP_TIMEOUT_MS, signal),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WPFinder/1.0)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
    });

    const status = res.status;

    // Accept 200, 301, 302 only.
    if (status !== 200 && status !== 301 && status !== 302) {
      // Drain the body to prevent memory leaks.
      await res.text().catch(() => {});
      throw new Error(`HTTP_${status}`);
    }

    // For redirects, we still note the status but try to read the body.
    // For 301/302, the body is typically minimal, but the status alone
    // tells us the domain is alive.
    let body = "";
    if (status === 200) {
      // Only read a reasonable amount (first 100KB) to avoid huge pages.
      const reader = res.body?.getReader();
      if (reader) {
        let totalBytes = 0;
        const maxBytes = 100_000;
        const chunks: Uint8Array[] = [];

        while (totalBytes < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalBytes += value.length;
        }
        reader.cancel().catch(() => {});
        body = Buffer.concat(chunks).toString("utf8");
      } else {
        body = await res.text();
      }
    } else {
      // Drain redirect response.
      await res.text().catch(() => {});
    }

    return { status, body, finalUrl: url };
  }, signal);
}

/* ── Stage 3: WordPress Verification ────────────────────────────────── */

/**
 * Check for WordPress meta generator tag in the homepage HTML.
 */
function hasWordPressMetaTag(html: string): boolean {
  // Match: <meta name="generator" content="WordPress …">
  return /meta[^>]+name\s*=\s*["']generator["'][^>]+content\s*=\s*["']WordPress/i.test(html);
}

/**
 * Probe WP-specific paths on the live domain.
 * Returns the path that confirmed WordPress, or null if none matched.
 */
async function probeWordPressPaths(
  hostname: string,
  signal?: AbortSignal
): Promise<string | null> {
  for (const wpPath of WP_VERIFY_PATHS) {
    // Short-circuit if cancelled between probes.
    if (signal?.aborted) return null;

    try {
      const url = `https://${hostname}${wpPath}`;
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: combinedSignal(HTTP_TIMEOUT_MS, signal),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WPFinder/1.0)",
          Accept: "*/*",
        },
      });

      const status = res.status;

      if (wpPath === "/wp-json/") {
        // wp-json should return 200 with JSON containing "namespaces"
        if (status === 200) {
          const text = await res.text();
          if (text.includes("namespaces") || text.includes("wp/v2")) {
            return "wp-json";
          }
        } else {
          await res.text().catch(() => {});
        }
      } else if (wpPath === "/wp-login.php") {
        // wp-login should return 200 with "wp-login" in body
        if (status === 200) {
          const text = await res.text();
          if (text.includes("wp-login") || text.includes("wp-submit")) {
            return "wp-login";
          }
        } else {
          await res.text().catch(() => {});
        }
      } else if (wpPath === "/wp-content/") {
        // wp-content often returns 200 (listing) or 403 (forbidden).
        // Both confirm the path exists.
        await res.text().catch(() => {});
        if (status === 200 || status === 403) {
          return "wp-content";
        }
      } else {
        await res.text().catch(() => {});
      }
    } catch {
      // Individual path probe failed — try next path.
      continue;
    }
  }

  return null;
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Run the full 3-stage verification pipeline on a domain.
 *
 * @param hostname - The bare hostname to verify (e.g. "example.com")
 * @param signal   - Optional AbortSignal for global cancellation
 * @returns { verified, reason }
 */
export async function verifyDomain(
  hostname: string,
  signal?: AbortSignal
): Promise<VerifyResult> {
  // Bail early if already cancelled.
  if (signal?.aborted) {
    return { verified: false, reason: "CANCELLED" };
  }

  // ── Stage 1: DNS ──────────────────────────────────────────────────
  try {
    await resolveDns(hostname, signal);
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) {
      return { verified: false, reason: "CANCELLED" };
    }
    const code = errorCode(err);
    const msg = code || (err instanceof Error ? err.message : String(err));
    return { verified: false, reason: `DNS_FAIL:${msg}` };
  }

  // ── Stage 2: HTTP probe ───────────────────────────────────────────
  let homepage: HttpProbeResult;
  try {
    homepage = await probeHomepage(hostname, signal);
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) {
      return { verified: false, reason: "CANCELLED" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { verified: false, reason: `HTTP_FAIL:${msg}` };
  }

  // ── Stage 3: WordPress check ──────────────────────────────────────

  // 3a. Check meta generator tag from homepage body (free — no extra request).
  if (homepage.status === 200 && hasWordPressMetaTag(homepage.body)) {
    return { verified: true, reason: "meta-generator" };
  }

  // 3b. Probe WP-specific paths.
  if (signal?.aborted) {
    return { verified: false, reason: "CANCELLED" };
  }

  const wpPath = await probeWordPressPaths(hostname, signal);
  if (wpPath) {
    return { verified: true, reason: wpPath };
  }

  // No WordPress evidence found.
  return { verified: false, reason: "NO_WP_EVIDENCE" };
}
