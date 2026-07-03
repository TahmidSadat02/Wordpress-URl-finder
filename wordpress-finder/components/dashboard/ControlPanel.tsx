"use client";

/**
 * ControlPanel — Action buttons for dashboard operations.
 *
 * Buttons: Refresh, Start Refill, Stop Worker.
 * Each button is disabled appropriately and prevents duplicate actions.
 */

import { useState, useCallback } from "react";
import type { DashboardResponse } from "@/lib/inventory.types";

interface ControlPanelProps {
  data: DashboardResponse;
  onRefresh: () => void;
}

export default function ControlPanel({ data, onRefresh }: ControlPanelProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isWorkerRunning = data.worker.isRunning;

  const handleWorkerAction = useCallback(
    async (action: "start" | "stop") => {
      setActionLoading(action);
      setActionMessage(null);

      try {
        const res = await fetch("/api/worker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        const result: { status?: string; message?: string; error?: string } =
          await res.json();

        if (!res.ok) {
          setActionMessage(`Error: ${result.error ?? "Unknown error"}`);
        } else {
          setActionMessage(result.message ?? "Action completed.");
          // Refresh dashboard data after a short delay
          setTimeout(onRefresh, 1000);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Request failed";
        setActionMessage(`Error: ${msg}`);
      } finally {
        setActionLoading(null);
      }
    },
    [onRefresh],
  );

  return (
    <section aria-label="Controls" className="w-full">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        Controls
      </h2>
      <div className="rounded-xl border border-surface-border bg-surface/60 backdrop-blur-sm p-5">
        <div className="flex flex-wrap gap-3">
          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="
              inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
              bg-surface-hover border border-surface-border
              text-foreground text-sm font-medium
              hover:bg-accent/10 hover:border-accent/30
              transition-all duration-200 cursor-pointer
              active:scale-95
            "
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          {/* Start Refill */}
          <button
            onClick={() => handleWorkerAction("start")}
            disabled={isWorkerRunning || actionLoading === "start"}
            className={`
              inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-200
              ${
                isWorkerRunning || actionLoading === "start"
                  ? "bg-emerald-500/10 text-emerald-500/40 border border-emerald-500/10 cursor-not-allowed"
                  : "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/30 cursor-pointer active:scale-95"
              }
            `}
          >
            {actionLoading === "start" ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
            Start Refill
          </button>

          {/* Stop Worker */}
          <button
            onClick={() => handleWorkerAction("stop")}
            disabled={!isWorkerRunning || actionLoading === "stop"}
            className={`
              inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-200
              ${
                !isWorkerRunning || actionLoading === "stop"
                  ? "bg-red-500/10 text-red-500/40 border border-red-500/10 cursor-not-allowed"
                  : "bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30 cursor-pointer active:scale-95"
              }
            `}
          >
            {actionLoading === "stop" ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
            )}
            Stop Worker
          </button>
        </div>

        {/* Action message */}
        {actionMessage && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${
            actionMessage.startsWith("Error")
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}>
            {actionMessage}
          </div>
        )}
      </div>
    </section>
  );
}
