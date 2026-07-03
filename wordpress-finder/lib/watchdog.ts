import { getLowWaterMark } from "@/lib/inventory.config";
import { shouldRefill } from "@/lib/inventory.service";
import { workerManager } from "@/lib/worker.manager";

class InventoryWatchdog {
  private intervalId: NodeJS.Timeout | null = null;
  private isChecking: boolean = false;

  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    console.log("[Watchdog] Starting background inventory watchdog...");

    this.intervalId = setInterval(async () => {
      if (this.isChecking) return;
      this.isChecking = true;

      try {
        if (workerManager.isRunning()) {
          this.isChecking = false;
          return;
        }

        const needsRefill = await shouldRefill();
        if (needsRefill) {
          if (workerManager.isRunning()) {
            this.isChecking = false;
            return;
          }
          console.log(
            `[Watchdog] Inventory below LOW_WATER_MARK (${getLowWaterMark()}) — auto-starting worker.`
          );
          workerManager.startRefill();
        }
      } catch (err) {
        console.error("[Watchdog] Error in background inventory check:", err);
      } finally {
        this.isChecking = false;
      }
    }, 15_000); // Check every 15 seconds
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Watchdog] Background inventory watchdog stopped.");
    }
  }
}

declare global {
  var __watchdog: InventoryWatchdog | undefined;
}

const watchdog = globalThis.__watchdog ?? new InventoryWatchdog();

if (process.env.NODE_ENV !== "production") {
  globalThis.__watchdog = watchdog;
}

if (typeof window === "undefined") {
  watchdog.start();
}

export { watchdog };
