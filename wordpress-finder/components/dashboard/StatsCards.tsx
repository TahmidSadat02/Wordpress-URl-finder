"use client";

/**
 * StatsCards — Grid of key statistics with live values.
 *
 * Displays 8 metric cards: Total Domains, Remaining, Served,
 * Verification Rate, Worker Status, Current Target, LOW_WATER_MARK,
 * and REFILL_TARGET.
 */

import type { DashboardResponse } from "@/lib/inventory.types";

interface StatsCardsProps {
  data: DashboardResponse;
}

interface StatCard {
  label: string;
  value: string | number;
  color: string;
}

export default function StatsCards({ data }: StatsCardsProps) {
  const cards: StatCard[] = [
    {
      label: "Total Domains",
      value: data.stats.totalDomains.toLocaleString(),
      color: "from-blue-500/20 to-blue-600/10 border-blue-500/20",
    },
    {
      label: "Remaining",
      value: data.stats.remaining.toLocaleString(),
      color: data.stats.remaining > data.configuration.lowWaterMark
        ? "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20"
        : "from-amber-500/20 to-amber-600/10 border-amber-500/20",
    },
    {
      label: "Served",
      value: data.stats.served.toLocaleString(),
      color: "from-violet-500/20 to-violet-600/10 border-violet-500/20",
    },
    {
      label: "Verification Rate",
      value: `${(data.stats.verificationRate * 100).toFixed(1)}%`,
      color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/20",
    },
    {
      label: "Worker Status",
      value: data.worker.status.charAt(0).toUpperCase() + data.worker.status.slice(1),
      color: data.worker.isRunning
        ? "from-green-500/20 to-green-600/10 border-green-500/20"
        : "from-slate-500/20 to-slate-600/10 border-slate-500/20",
    },
    {
      label: "Current Target",
      value: data.inventory.target.toLocaleString(),
      color: "from-rose-500/20 to-rose-600/10 border-rose-500/20",
    },
    {
      label: "LOW_WATER_MARK",
      value: data.configuration.lowWaterMark.toLocaleString(),
      color: "from-amber-500/20 to-amber-600/10 border-amber-500/20",
    },
    {
      label: "REFILL_TARGET",
      value: data.configuration.refillTarget.toLocaleString(),
      color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/20",
    },
  ];

  return (
    <section aria-label="System statistics" className="w-full">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        Statistics
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`
              relative rounded-xl border bg-gradient-to-br p-4
              backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]
              ${card.color}
            `}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {card.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
