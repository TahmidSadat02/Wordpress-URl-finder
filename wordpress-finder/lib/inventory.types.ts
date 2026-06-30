/**
 * inventory.types.ts
 *
 * Shared type definitions for the inventory management system.
 *
 * These types are consumed by:
 *  - inventory.service.ts  (domain counts, checkpoint reading)
 *  - worker.manager.ts     (worker lifecycle status)
 *  - app/api/status/route.ts (API response shape)
 */

/* ── Worker Status ─────────────────────────────────────────────────── */

/** Human-readable label for the worker's current lifecycle state. */
export type WorkerStatusLabel = "idle" | "running" | "stopped";

/** Detailed status snapshot from the WorkerManager singleton. */
export interface WorkerManagerStatus {
  /** Whether the worker child process is currently alive. */
  isRunning: boolean;
  /** Human-readable lifecycle label. */
  status: WorkerStatusLabel;
  /** ISO timestamp of when the worker was last started, or null. */
  lastStartedAt: string | null;
  /** ISO timestamp of when the worker last exited, or null. */
  lastStoppedAt: string | null;
  /** Exit code from the last worker run, or null if never ran / still running. */
  lastExitCode: number | null;
  /** OS process ID of the running worker, or null. */
  pid: number | null;
}

/* ── Checkpoint ────────────────────────────────────────────────────── */

/**
 * Mirrors the checkpoint shape written by the worker process
 * (see worker/src/checkpoint.ts).
 */
export interface CheckpointData {
  /** The WARC segment file URL currently being streamed. */
  warcPath: string;
  /** The record offset index (1-based count) within the current segment. */
  recordOffset: number;
  /** Total verified domains count at the checkpoint. */
  verifiedCount: number;
  /** ISO timestamp when the checkpoint was saved. */
  timestamp: string;
}

/* ── Status API Response ───────────────────────────────────────────── */

/** Shape of the JSON payload returned by GET /api/status. */
export interface StatusResponse {
  /** Number of domains in the DB that have NOT been served yet. */
  remaining: number;
  /** Number of domains that have been served to callers. */
  served: number;
  /** Whether the worker is currently running a refill cycle. */
  refilling: boolean;
  /** Current worker lifecycle label. */
  workerStatus: WorkerStatusLabel;
  /** The REFILL_TARGET the worker will aim for when spawned. */
  verifiedTarget: number;
  /** Latest checkpoint data from the worker, or null if none exists. */
  lastCheckpoint: CheckpointData | null;
  /** Fraction of total domains that have been served (0–1). */
  verificationRate: number;
}
