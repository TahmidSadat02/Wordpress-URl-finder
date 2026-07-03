"use client";

/**
 * InventoryPanel — Visual progress bar showing inventory levels.
 *
 * Color coding:
 *   Green  — remaining >= refillTarget (healthy)
 *   Yellow — remaining >= lowWaterMark but < refillTarget (acceptable)
 *   Red    — remaining < lowWaterMark (critical, refill needed)
 */

import type { DashboardResponse } from "@/lib/inventory.types";

interface InventoryPanelProps {
  data: DashboardResponse;
}

export default function InventoryPanel({ data }: InventoryPanelProps) {
  const { remaining, target } = data.inventory;
  const { lowWaterMark, refillTarget } = data.configuration;
  const served = data.stats.served;
  const total = data.stats.totalDomains;

  const fillPercentage = target > 0 ? Math.min((remaining / target) * 100, 100) : 0;

  // Color logic
  let barColor: string;
  let statusLabel: string;
  let statusColor: string;

  if (remaining >= refillTarget) {
    barColor = "from-emerald-500 to-emerald-400";
    statusLabel = "Healthy";
    statusColor = "text-emerald-500";
  } else if (remaining >= lowWaterMark) {
    barColor = "from-amber-500 to-yellow-400";
    statusLabel = "Acceptable";
    statusColor = "text-amber-500";
  } else {
    barColor = "from-red-500 to-rose-400";
    statusLabel = "Critical";
    statusColor = "text-red-500";
  }

  const percentRemaining = total > 0 ? ((remaining / total) * 100).toFixed(1) : "0.0";

  return (
    <section aria-label="Inventory status" className="w-full">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        Inventory
      </h2>
      <div className="rounded-xl border border-surface-border bg-surface/60 backdrop-blur-sm p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground tabular-nums">
              {remaining.toLocaleString()}
            </span>
            <span className="text-muted text-sm">
              / {target.toLocaleString()} target
            </span>
          </div>
          <span className={`text-sm font-semibold uppercase tracking-wider ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-4 bg-surface-hover rounded-full overflow-hidden mb-4">
          <div
            className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${fillPercentage}%` }}
          />
        </div>

        {/* Details */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Remaining</div>
            <div className="text-lg font-semibold text-foreground tabular-nums">
              {remaining.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Served</div>
            <div className="text-lg font-semibold text-foreground tabular-nums">
              {served.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-1">% Remaining</div>
            <div className="text-lg font-semibold text-foreground tabular-nums">
              {percentRemaining}%
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
