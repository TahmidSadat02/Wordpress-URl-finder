/**
 * inventory.service.ts
 *
 * Data-access layer for inventory monitoring.
 *
 * Queries the `discovered_domains` table via the existing pg Pool
 * (from lib/db.ts) to provide domain counts.  The service is
 * stateless — every call hits the database for a fresh count.
 *
 * Also reads the worker checkpoint file (if present) to surface
 * progress information via the status API.
 */

import * as fs from "fs";
import * as path from "path";
import pool from "@/lib/db";
import { LOW_WATER_MARK, REFILL_TARGET } from "@/lib/inventory.config";
import { workerManager } from "@/lib/worker.manager";
import type {
  CheckpointData,
  StatusResponse,
  WorkerManagerStatus,
} from "@/lib/inventory.types";

/* ── Checkpoint file location ──────────────────────────────────────── */

/**
 * Resolve the worker checkpoint file path.
 * The worker writes `checkpoint.json` to its own project root, which
 * sits as a sibling of the Next.js project under the common parent.
 */
const CHECKPOINT_PATH: string = path.resolve(
  process.cwd(),
  "..",
  "worker",
  "checkpoint.json",
);

/* ── Domain counts ─────────────────────────────────────────────────── */

/**
 * Returns the number of domains in the database that have **not**
 * been served to any caller yet.
 */
export async function getRemainingDomains(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "discovered_domains" WHERE "served" = FALSE`,
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Returns the number of domains that have already been served.
 */
export async function getServedDomains(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "discovered_domains" WHERE "served" = TRUE`,
  );
  return parseInt(result.rows[0].count, 10);
}

/* ── Refill decision ───────────────────────────────────────────────── */

/**
 * Determines whether the inventory is low enough to warrant
 * spawning the worker for a refill cycle.
 *
 * @returns `true` when remaining unserved domains are below the
 *          configured LOW_WATER_MARK threshold.
 */
export async function shouldRefill(): Promise<boolean> {
  const remaining = await getRemainingDomains();
  return remaining < LOW_WATER_MARK;
}

/* ── Worker status ─────────────────────────────────────────────────── */

/**
 * Reads the worker's checkpoint file from disk.
 * Returns `null` if the file doesn't exist or is malformed.
 */
function readCheckpoint(): CheckpointData | null {
  try {
    if (!fs.existsSync(CHECKPOINT_PATH)) return null;

    const raw: string = fs.readFileSync(CHECKPOINT_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);

    // Basic shape validation
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

/**
 * Aggregates worker lifecycle info and checkpoint data into
 * a single status object suitable for the WorkerManager.
 */
export function getWorkerStatus(): WorkerManagerStatus {
  return workerManager.getStatus();
}

/* ── Full status snapshot ──────────────────────────────────────────── */

/**
 * Builds the complete status payload returned by GET /api/status.
 *
 * Performs two COUNT queries in parallel for efficiency, then merges
 * with the in-memory worker status and on-disk checkpoint.
 */
export async function getFullStatus(): Promise<StatusResponse> {
  const [remaining, served] = await Promise.all([
    getRemainingDomains(),
    getServedDomains(),
  ]);

  const workerStatus = workerManager.getStatus();
  const checkpoint = readCheckpoint();
  const total = remaining + served;
  const verificationRate = total > 0 ? served / total : 0;

  return {
    remaining,
    served,
    refilling: workerStatus.isRunning,
    workerStatus: workerStatus.status,
    verifiedTarget: REFILL_TARGET,
    lastCheckpoint: checkpoint,
    verificationRate: Math.round(verificationRate * 10_000) / 10_000,
  };
}
