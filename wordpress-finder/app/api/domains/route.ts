/**
 * app/api/domains/route.ts
 *
 * GET /api/domains
 *
 * Fetches up to 50 unserved WordPress domains from PostgreSQL,
 * atomically marks them as served, and returns them as JSON.
 *
 * ─── Concurrency Safety ────────────────────────────────────────────────────
 *
 * The naive two-step approach (SELECT then UPDATE) creates a race condition:
 * two simultaneous requests can both read the same unserved rows before
 * either has marked them served — resulting in the same domain being
 * served twice.
 *
 * This route uses a SINGLE atomic SQL statement:
 *
 *   UPDATE discovered_domains
 *   SET served = true, served_at = NOW()
 *   WHERE id IN (
 *     SELECT id FROM discovered_domains
 *     WHERE served = false
 *     ORDER BY discovered_at ASC
 *     LIMIT 50
 *     FOR UPDATE SKIP LOCKED   ← key clause
 *   )
 *   RETURNING domain;
 *
 * FOR UPDATE: acquires a row-level exclusive lock on the selected rows.
 * SKIP LOCKED: any row already locked by a concurrent transaction is
 *   skipped entirely rather than waited on. This means:
 *   - Request A locks rows 1–50, Request B automatically skips them
 *     and picks rows 51–100 instead.
 *   - No waiting, no deadlocks, no duplicate serving.
 *   - This is the standard PostgreSQL pattern for concurrent job queues.
 *
 * ─── Why 50? ───────────────────────────────────────────────────────────────
 *
 * 50 domains per batch is a deliberate trade-off:
 *   - Small enough to keep HTTP payloads under ~2 KB and transactions short.
 *   - Short transactions mean row locks are held for milliseconds, not
 *     seconds — minimising lock contention under high concurrency.
 *   - Large enough to be useful for any consumer that needs a feed of
 *     fresh domains without hammering the endpoint repeatedly.
 *
 * ─── Response Format ───────────────────────────────────────────────────────
 *
 * Success (200):  { "domains": ["example.com", "blog.site.net", ...] }
 * Empty pool:     { "domains": [] }          (still 200 — pool empty is normal)
 * DB error:       { "error": "..." }         (500)
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** Maximum domains to serve in a single request. */
const BATCH_SIZE = 50;

/**
 * Shape of a row returned by the RETURNING clause.
 * Prisma $queryRaw returns unknown[], so we type-narrow manually.
 */
interface ServedRow {
  domain: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    /**
     * Single atomic statement:
     *   1. Sub-select picks up to BATCH_SIZE unserved rows, oldest first.
     *   2. FOR UPDATE SKIP LOCKED locks those rows and skips any already
     *      locked by a concurrent request — guaranteeing disjoint batches.
     *   3. The outer UPDATE marks them served in the same statement.
     *   4. RETURNING domain gives us the domains without a second query.
     *
     * Because SELECT and UPDATE are one operation, there is no window
     * between reading and writing — race conditions are structurally
     * impossible at the SQL level.
     */
    const rows = await prisma.$queryRaw<ServedRow[]>(
      Prisma.sql`
        UPDATE discovered_domains
        SET served = true, served_at = NOW()
        WHERE id IN (
          SELECT id
          FROM discovered_domains
          WHERE served = false
          ORDER BY discovered_at ASC
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING domain
      `
    );

    const domains = rows.map((r) => r.domain);

    return NextResponse.json({ domains });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/domains] Database error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
