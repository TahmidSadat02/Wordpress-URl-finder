/**
 * inventory.config.ts
 *
 * Centralised configuration for the inventory management system.
 *
 * All values can be overridden via environment variables so the
 * behaviour is tuneable at deploy-time without recompilation.
 *
 * Environment variables:
 *   LOW_WATER_MARK  — When remaining unserved domains drop below this,
 *                     the worker is auto-triggered.  Default: 100
 *   REFILL_TARGET   — How many verified domains the worker should collect
 *                     per run (passed as TARGET env to the child process).
 *                     Default: 500
 *   CHECK_INTERVAL  — Milliseconds between periodic inventory checks
 *                     (reserved for future scheduled polling).  Default: 60 000
 */

/* ── Helper ─────────────────────────────────────────────────────────── */

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/* ── Exports ────────────────────────────────────────────────────────── */

/**
 * When the count of unserved domains drops below this threshold the
 * API will automatically spawn the worker to refill the pool.
 */
export const LOW_WATER_MARK: number = envInt("LOW_WATER_MARK", 100);

/**
 * Number of verified WordPress domains the worker should collect per
 * refill cycle.  This value is forwarded to the worker process as its
 * `TARGET` environment variable.
 */
export const REFILL_TARGET: number = envInt("REFILL_TARGET", 500);

/**
 * Milliseconds between periodic inventory checks.
 * Reserved for a future scheduled-polling mode; currently the check
 * is triggered reactively on each GET /api/domains request.
 */
export const CHECK_INTERVAL: number = envInt("CHECK_INTERVAL", 60_000);
