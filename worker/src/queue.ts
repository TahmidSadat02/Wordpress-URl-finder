/**
 * queue.ts
 *
 * Bounded async queue with backpressure.
 *
 * This is the bridge between the WARC parser (producer) and the
 * verification workers (consumers).  It guarantees:
 *
 *  - **Constant memory**: the producer blocks when the queue is full,
 *    preventing unbounded buffering of candidate domains.
 *  - **Fan-out**: multiple consumers dequeue concurrently.
 *  - **Clean shutdown**: calling close() causes pending dequeue() calls
 *    to resolve with `null`, signalling workers to exit.
 *  - **Drain control**: pause(), resume(), clear() for coordinated
 *    shutdown when the verification target is reached.
 */

/**
 * A bounded FIFO queue that supports async enqueue (blocks when full)
 * and async dequeue (blocks when empty).
 */
export class BoundedQueue<T> {
  private readonly buffer: T[] = [];
  private readonly capacity: number;
  private closed = false;
  private paused = false;

  /** Resolvers waiting for space to enqueue. */
  private enqueuers: Array<() => void> = [];

  /** Resolvers waiting for an item to dequeue. */
  private dequeuers: Array<(value: T | null) => void> = [];

  /** High-water mark — tracks peak queue depth for metrics. */
  private peak = 0;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error("Queue capacity must be >= 1");
    this.capacity = capacity;
  }

  /** Current number of items in the queue. */
  get size(): number {
    return this.buffer.length;
  }

  /** Peak number of items ever held in the queue. */
  get peakSize(): number {
    return this.peak;
  }

  /**
   * Enqueue an item.  If the queue is at capacity, this call blocks
   * until a consumer dequeues something (backpressure).
   *
   * Throws if the queue has been closed.
   */
  async enqueue(item: T): Promise<void> {
    if (this.closed) throw new Error("Cannot enqueue into a closed queue");

    // If a consumer is already waiting, hand the item directly.
    if (this.dequeuers.length > 0) {
      const resolve = this.dequeuers.shift()!;
      resolve(item);
      return;
    }

    // If there's space, push immediately.
    if (this.buffer.length < this.capacity) {
      this.buffer.push(item);
      if (this.buffer.length > this.peak) {
        this.peak = this.buffer.length;
      }
      return;
    }

    // Otherwise, wait for space.
    await new Promise<void>((resolve) => {
      this.enqueuers.push(resolve);
    });

    // Re-check closed state after waking (close() wakes enqueuers).
    if (this.closed) throw new Error("Cannot enqueue into a closed queue");

    this.buffer.push(item);
    if (this.buffer.length > this.peak) {
      this.peak = this.buffer.length;
    }
  }

  /**
   * Dequeue an item.  If the queue is empty, this call blocks until
   * a producer enqueues something.
   *
   * Returns `null` when the queue is closed AND empty (no more items).
   */
  async dequeue(): Promise<T | null> {
    // If paused, wait until resumed or closed.
    while (this.paused && !this.closed) {
      await new Promise<T | null>((resolve) => {
        this.dequeuers.push(resolve);
      });
      // After waking, if we got an item passed directly, return it.
      // Otherwise loop and re-check paused state.
    }

    // Items available — return immediately and wake a blocked enqueuer.
    if (this.buffer.length > 0) {
      const item = this.buffer.shift()!;
      if (this.enqueuers.length > 0) {
        const resolve = this.enqueuers.shift()!;
        resolve();
      }
      return item;
    }

    // No items and closed — signal end.
    if (this.closed) return null;

    // Wait for an item.
    return new Promise<T | null>((resolve) => {
      this.dequeuers.push(resolve);
    });
  }

  /**
   * Pause dequeueing.  Workers calling dequeue() will block even if
   * items are available, until resume() or close() is called.
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume dequeueing after a pause.  Wakes all blocked dequeuers
   * so they can consume queued items.
   */
  resume(): void {
    this.paused = false;
    // Wake dequeuers so they re-enter the loop and find items.
    this.flushDequeuers();
  }

  /**
   * Discard all buffered items immediately.
   * Wakes any blocked enqueuers (they can re-check closed state).
   * The queue remains open unless close() is also called.
   */
  clear(): void {
    this.buffer.length = 0;

    // Wake blocked enqueuers — they'll find space (or a closed queue).
    for (const resolve of this.enqueuers) {
      resolve();
    }
    this.enqueuers = [];
  }

  /**
   * Close the queue.  No more enqueues are allowed.
   * All pending dequeue() calls resolve with `null`.
   * Remaining buffered items are discarded.
   */
  close(): void {
    this.closed = true;
    this.paused = false;

    // Discard remaining items.
    this.clear();

    // Wake all waiting consumers with null (end signal).
    for (const resolve of this.dequeuers) {
      resolve(null);
    }
    this.dequeuers = [];
  }

  /** Whether the queue has been closed. */
  isClosed(): boolean {
    return this.closed;
  }

  // ── Internal ──────────────────────────────────────────────────────

  /** Wake all blocked dequeuers with null so they re-check state. */
  private flushDequeuers(): void {
    for (const resolve of this.dequeuers) {
      resolve(null);
    }
    this.dequeuers = [];
  }
}
