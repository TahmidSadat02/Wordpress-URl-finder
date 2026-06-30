import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { shouldRefill } from "@/lib/inventory.service";
import { workerManager } from "@/lib/worker.manager";

/* ── Auto-refill ───────────────────────────────────────────────────── */

/**
 * Non-blocking inventory check.
 *
 * Called after each successful domain serve.  If the remaining pool
 * has dropped below LOW_WATER_MARK and no worker is currently running,
 * the worker is spawned in the background.
 *
 * Errors are caught and logged — they must never affect the domain
 * response that has already been committed and is about to be sent.
 */
async function checkAndRefill(): Promise<void> {
  try {
    if (workerManager.isRunning()) return;

    const needsRefill: boolean = await shouldRefill();
    if (needsRefill) {
      console.log(
        "[GET /api/domains] Inventory below LOW_WATER_MARK — starting worker.",
      );
      workerManager.startRefill();
    }
  } catch (err: unknown) {
    const msg: string = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/domains] Refill check failed:", msg);
  }
}

/**
 * GET /api/domains
 *
 * Opens a database transaction, atomically claims up to 50 unserved domains
 * using FOR UPDATE SKIP LOCKED (so concurrent workers never collide), marks
 * them as served, and returns their domain names.
 *
 * Responses:
 *   200  { domains: string[] }          — one or more domains claimed
 *   404  { error: "No domains available" } — queue is empty / all locked
 *   500  { error: string }              — unexpected database error
 */
export async function GET() {
  // Acquire a dedicated client so we can manage the transaction manually.
  const client = await pool.connect();

  try {
    // ── BEGIN ────────────────────────────────────────────────────────────
    await client.query("BEGIN");

    /**
     * Atomic UPDATE … RETURNING pattern:
     *
     *  1. The inner SELECT finds up to 50 rows where served = false,
     *     ordered by discovered_at ASC (oldest first), and locks them
     *     with FOR UPDATE SKIP LOCKED — any rows already locked by another
     *     concurrent transaction are silently skipped, guaranteeing each
     *     domain is delivered to exactly one caller.
     *
     *  2. The outer UPDATE flips served = true and stamps served_at = NOW()
     *     on those exact rows in a single round-trip.
     *
     *  3. RETURNING domain gives us the claimed domain strings directly,
     *     avoiding a second SELECT.
     */
    const sql = `
UPDATE "discovered_domains"
SET "served" = TRUE,
    "servedAt" = NOW()
WHERE "id" IN (
    SELECT "id"
    FROM "discovered_domains"
    WHERE "served" = FALSE
    ORDER BY "discoveredAt" ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
)
RETURNING "domain";
`;

    const result = await client.query<{ domain: string }>(sql);

    // ── COMMIT ───────────────────────────────────────────────────────────
    await client.query("COMMIT");

    const domains = result.rows.map((row) => row.domain);

    if (domains.length === 0) {
      return NextResponse.json(
        { error: "No domains available" },
        { status: 404 }
      );
    }

    // Fire-and-forget: trigger a refill check without blocking the response.
    void checkAndRefill();

    return NextResponse.json({ domains });
  } catch (err) {
    // ── ROLLBACK ─────────────────────────────────────────────────────────
    // Best-effort rollback; log but do not re-throw if it itself fails.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("[GET /api/domains] ROLLBACK failed:", rollbackErr);
    }

    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/domains] Database error:", message);

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // ── RELEASE ──────────────────────────────────────────────────────────
    // Always return the client to the pool, even if COMMIT or ROLLBACK threw.
    client.release();
  }
}
