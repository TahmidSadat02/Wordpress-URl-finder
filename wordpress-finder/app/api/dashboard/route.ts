/**
 * GET /api/dashboard
 *
 * Unified dashboard endpoint that returns all system data in a single
 * request. Reuses existing service functions to avoid duplicating
 * database queries.
 *
 * Response shape: DashboardResponse (see lib/inventory.types.ts)
 */

import { NextResponse } from "next/server";
import { getRemainingDomains, getServedDomains } from "@/lib/inventory.service";
import { workerManager } from "@/lib/worker.manager";
import { getLowWaterMark, getRefillTarget } from "@/lib/inventory.config";
import * as fs from "fs";
import * as path from "path";
import type { CheckpointData, DashboardResponse } from "@/lib/inventory.types";

/**
 * Read the worker checkpoint file from disk.
 * Returns null if the file doesn't exist or is malformed.
 */
function readCheckpoint(): CheckpointData | null {
  try {
    const checkpointPath = path.resolve(process.cwd(), "..", "worker", "checkpoint.json");
    if (!fs.existsSync(checkpointPath)) return null;

    const raw: string = fs.readFileSync(checkpointPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "warcPath" in parsed &&
      "recordOffset" in parsed &&
      "verifiedCount" in parsed &&
      "timestamp" in parsed &&
      typeof (parsed as CheckpointData).warcPath === "string" &&
      typeof (parsed as CheckpointData).recordOffset === "number" &&
      typeof (parsed as CheckpointData).verifiedCount === "number" &&
      typeof (parsed as CheckpointData).timestamp === "string"
    ) {
      return parsed as CheckpointData;
    }
  } catch {
    // Checkpoint file is missing, corrupt, or unreadable — that's OK.
  }
  return null;
}

export async function GET(): Promise<NextResponse<DashboardResponse | { error: string }>> {
  try {
    const [remaining, served] = await Promise.all([
      getRemainingDomains(),
      getServedDomains(),
    ]);

    const total = remaining + served;
    const verificationRate = total > 0 ? Math.round((served / total) * 10_000) / 10_000 : 0;
    const workerStatus = workerManager.getStatus();
    const checkpoint = readCheckpoint();
    const target = getRefillTarget();
    const percentage = target > 0 ? Math.round((remaining / target) * 10_000) / 10_000 : 0;

    const response: DashboardResponse = {
      stats: {
        totalDomains: total,
        remaining,
        served,
        verificationRate,
      },
      worker: workerStatus,
      inventory: {
        remaining,
        target,
        percentage: Math.min(percentage, 1),
      },
      checkpoint,
      configuration: {
        lowWaterMark: getLowWaterMark(),
        refillTarget: target,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/dashboard] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
