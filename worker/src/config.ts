/**
 * config.ts
 *
 * Central configuration for the verified-domain collector.
 *
 * All tuneable constants live here so you never need to dig into
 * business logic to change a limit, timeout, or target URL.
 *
 * Environment variable overrides are supported for every setting
 * so the worker can be configured at deploy-time without recompilation.
 *
 * The spec-required names (QUEUE_SIZE, VERIFY_CONCURRENCY, TARGET, etc.)
 * are the canonical exports.  Legacy names (QUEUE_CAPACITY, CONCURRENCY,
 * VERIFIED_TARGET, etc.) are re-exported as aliases for backward compat.
 */

/* ── Helper ─────────────────────────────────────────────────────────── */

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

/* ── Targets ────────────────────────────────────────────────────────── */

/** Stop after this many *verified + inserted* domains (not just candidates). */
export const TARGET = envInt("TARGET", 500);
/** @deprecated Use TARGET */
export const VERIFIED_TARGET = TARGET;

/* ── Concurrency & Queue ────────────────────────────────────────────── */

/** Number of parallel verification workers. */
export const VERIFY_CONCURRENCY = envInt("VERIFY_CONCURRENCY", 20);
/** @deprecated Use VERIFY_CONCURRENCY */
export const CONCURRENCY = VERIFY_CONCURRENCY;

/** Max items in the candidate queue before the WARC producer blocks. */
export const QUEUE_SIZE = envInt("QUEUE_SIZE", 100);
/** @deprecated Use QUEUE_SIZE */
export const QUEUE_CAPACITY = QUEUE_SIZE;

/* ── Timeouts ───────────────────────────────────────────────────────── */

/** Per-request HTTP timeout in milliseconds. */
export const HTTP_TIMEOUT = envInt("HTTP_TIMEOUT", 8_000);
/** @deprecated Use HTTP_TIMEOUT */
export const HTTP_TIMEOUT_MS = HTTP_TIMEOUT;

/** DNS resolution timeout in milliseconds. */
export const DNS_TIMEOUT = envInt("DNS_TIMEOUT", 5_000);
/** @deprecated Use DNS_TIMEOUT */
export const DNS_TIMEOUT_MS = DNS_TIMEOUT;

/* ── Retries ────────────────────────────────────────────────────────── */

/** Max retries for transient network failures per domain per probe. */
export const RETRY_COUNT = envInt("RETRY_COUNT", 2);
/** @deprecated Use RETRY_COUNT */
export const MAX_RETRIES = RETRY_COUNT;

/** Base delay (ms) for exponential back-off between retries. */
export const RETRY_BASE_MS = 500;

/** Error codes that are considered transient and worth retrying. */
export const TRANSIENT_ERRORS: ReadonlySet<string> = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "EPIPE",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

/* ── Common Crawl ───────────────────────────────────────────────────── */

/** The CC crawl whose WARC index we iterate. */
export const CC_CRAWL_ID = envStr("CC_CRAWL_ID", "CC-MAIN-2026-21");

/**
 * Max WARC segments to process.  0 = unlimited (stream until target).
 * Useful for development / testing with a small number of files.
 */
export const CC_SEGMENT_LIMIT = envInt("CC_SEGMENT_LIMIT", 0);

/* ── WordPress detection (WARC pre-filter) ──────────────────────────── */

/**
 * Sub-strings in HTML bodies or URLs that hint "this page is WordPress".
 * Used by the WARC pre-filter (detector.ts) to extract *candidates*.
 */
export const WP_FOOTPRINTS: readonly string[] = [
  "/wp-content/",
  "/wp-login.php",
  "/wp-admin/",
  "/wp-includes/",
];

/* ── WordPress verification (live HTTP probes) ──────────────────────── */

/**
 * Paths probed on the live domain to confirm WordPress.
 * The verifier tries each in order and stops at the first success.
 */
export const WP_VERIFY_PATHS: readonly string[] = [
  "/wp-json/",
  "/wp-login.php",
  "/wp-content/",
];

/* ── Logging ────────────────────────────────────────────────────────── */

/** Log a [PROGRESS] block every N WARC records processed. */
export const PROGRESS_INTERVAL = envInt("PROGRESS_INTERVAL", 1_000);
/** @deprecated Use PROGRESS_INTERVAL */
export const LOG_EVERY_N_RECORDS = PROGRESS_INTERVAL;

/** Log memory usage every N WARC records (0 = disable). */
export const LOG_MEMORY_EVERY = envInt("LOG_MEMORY_EVERY", 5_000);
