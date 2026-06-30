/**
 * worker.manager.ts
 *
 * Singleton manager that controls the lifecycle of exactly one
 * worker child process.
 *
 * Design decisions:
 *
 *  1. **Single instance** — uses the same `globalThis` caching pattern
 *     as lib/db.ts and lib/prisma.ts to survive Next.js hot-reloads
 *     in development while remaining a true singleton in production.
 *
 *  2. **Fire-and-forget** — `startWorker()` spawns the child and
 *     returns immediately.  The worker runs in the background and
 *     the manager listens for its `exit` event to update state.
 *
 *  3. **Idempotent** — calling `startWorker()` while a worker is
 *     already running is a no-op.
 *
 *  4. **Env forwarding** — the child inherits the current process
 *     environment with `TARGET` set to `REFILL_TARGET`, so the
 *     worker knows how many domains to collect.
 */

import { spawn, type ChildProcess } from "child_process";
import * as path from "path";
import { REFILL_TARGET } from "@/lib/inventory.config";
import type { WorkerManagerStatus, WorkerStatusLabel } from "@/lib/inventory.types";

/* ── Singleton class ───────────────────────────────────────────────── */

class WorkerManager {
  private childProcess: ChildProcess | null = null;
  private _isRunning: boolean = false;
  private lastStartedAt: Date | null = null;
  private lastStoppedAt: Date | null = null;
  private lastExitCode: number | null = null;

  /**
   * Spawn the worker as a child process in the background.
   *
   * If a worker is already running this is a no-op — the method
   * returns immediately without spawning a second instance.
   *
   * The child runs the compiled worker entry point:
   *   `node <workerDir>/dist/index.js`
   *
   * It inherits the current environment plus:
   *   - TARGET = REFILL_TARGET (how many domains to collect)
   *   - DATABASE_URL from the Next.js env
   */
  startWorker(): void {
    if (this._isRunning) {
      console.log("[WorkerManager] Worker is already running — skipping.");
      return;
    }

    const workerDir: string = path.resolve(process.cwd(), "..", "worker");
    const entryPoint: string = path.join(workerDir, "dist", "index.js");

    console.log(
      `[WorkerManager] Spawning worker: node ${entryPoint} (TARGET=${REFILL_TARGET})`,
    );

    const child: ChildProcess = spawn("node", [entryPoint], {
      cwd: workerDir,
      env: {
        ...process.env,
        TARGET: String(REFILL_TARGET),
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    this.childProcess = child;
    this._isRunning = true;
    this.lastStartedAt = new Date();
    this.lastExitCode = null;

    // Forward child stdout/stderr to the API server's console.
    child.stdout?.on("data", (data: Buffer) => {
      const text: string = data.toString().trimEnd();
      if (text) console.log(`[Worker] ${text}`);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text: string = data.toString().trimEnd();
      if (text) console.error(`[Worker:err] ${text}`);
    });

    // Clean up when the child exits for any reason.
    child.on("exit", (code: number | null, signal: string | null) => {
      this._isRunning = false;
      this.lastStoppedAt = new Date();
      this.lastExitCode = code;
      this.childProcess = null;

      console.log(
        `[WorkerManager] Worker exited — code=${code ?? "null"} signal=${signal ?? "none"}`,
      );
    });

    child.on("error", (err: Error) => {
      this._isRunning = false;
      this.lastStoppedAt = new Date();
      this.lastExitCode = -1;
      this.childProcess = null;

      console.error("[WorkerManager] Failed to spawn worker:", err.message);
    });
  }

  /**
   * Forcefully terminate the running worker process.
   *
   * Sends SIGTERM first; the worker's graceful-shutdown handler in
   * runner.ts will save a checkpoint and exit cleanly.
   */
  stopWorker(): void {
    if (!this._isRunning || !this.childProcess) {
      console.log("[WorkerManager] No worker is running — nothing to stop.");
      return;
    }

    console.log("[WorkerManager] Sending SIGTERM to worker…");
    this.childProcess.kill("SIGTERM");
  }

  /** Whether a worker child process is currently alive. */
  isRunning(): boolean {
    return this._isRunning;
  }

  /** Build a snapshot of the manager's state for API consumers. */
  getStatus(): WorkerManagerStatus {
    let status: WorkerStatusLabel;
    if (this._isRunning) {
      status = "running";
    } else if (this.lastStoppedAt !== null) {
      status = "stopped";
    } else {
      status = "idle";
    }

    return {
      isRunning: this._isRunning,
      status,
      lastStartedAt: this.lastStartedAt?.toISOString() ?? null,
      lastStoppedAt: this.lastStoppedAt?.toISOString() ?? null,
      lastExitCode: this.lastExitCode,
      pid: this.childProcess?.pid ?? null,
    };
  }
}

/* ── globalThis singleton ──────────────────────────────────────────── */

declare global {
  // eslint-disable-next-line no-var
  var __workerManager: WorkerManager | undefined;
}

const workerManager: WorkerManager =
  globalThis.__workerManager ?? new WorkerManager();

if (process.env.NODE_ENV !== "production") {
  globalThis.__workerManager = workerManager;
}

export { workerManager };
