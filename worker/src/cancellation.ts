/**
 * cancellation.ts
 *
 * Global cancellation controller for the worker pipeline.
 *
 * Wraps a native AbortController to provide a single point of
 * cancellation that propagates to:
 *   - All in-flight HTTP requests (via AbortSignal)
 *   - DNS lookups
 *   - Retry back-off sleeps
 *   - Queue operations
 *   - WARC stream reads
 *
 * cancel() is idempotent — safe to call from multiple workers,
 * signal handlers, or the target-reached check simultaneously.
 *
 * Usage:
 *   const ctl = new CancellationController();
 *   fetch(url, { signal: ctl.signal });
 *   ctl.cancel("target reached");
 */

export class CancellationController {
  private readonly ac: AbortController;
  private cancelled = false;
  private cancelReason = "";

  constructor() {
    this.ac = new AbortController();
  }

  /** The AbortSignal to pass into fetch(), dns, timers, etc. */
  get signal(): AbortSignal {
    return this.ac.signal;
  }

  /** Whether cancel() has been called. */
  get isCancelled(): boolean {
    return this.cancelled;
  }

  /** The reason string passed to the first cancel() call. */
  get reason(): string {
    return this.cancelReason;
  }

  /**
   * Cancel all operations.  Idempotent — subsequent calls are no-ops.
   *
   * @param reason  Human-readable reason for the cancellation.
   */
  cancel(reason: string): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.cancelReason = reason;
    this.ac.abort(new Error(reason));
  }
}
