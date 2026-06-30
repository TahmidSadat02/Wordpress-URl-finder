/**
 * GET /api/status
 *
 * Returns a comprehensive snapshot of the inventory system's state:
 *
 *   - remaining     — unserved domains available in the pool
 *   - served        — domains already delivered to callers
 *   - refilling     — whether the worker is currently running
 *   - workerStatus  — "idle" | "running" | "stopped"
 *   - verifiedTarget — REFILL_TARGET the worker aims for
 *   - lastCheckpoint — latest worker checkpoint data (or null)
 *   - verificationRate — fraction of total domains that have been served
 *
 * This endpoint is read-only and does not trigger any side-effects.
 */

import { NextResponse } from "next/server";
import { getFullStatus } from "@/lib/inventory.service";
import type { StatusResponse } from "@/lib/inventory.types";

export async function GET(): Promise<NextResponse<StatusResponse | { error: string }>> {
  try {
    const status: StatusResponse = await getFullStatus();
    return NextResponse.json(status);
  } catch (err: unknown) {
    const message: string =
      err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/status] Error:", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
