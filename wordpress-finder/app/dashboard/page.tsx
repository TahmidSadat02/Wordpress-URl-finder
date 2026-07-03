"use client";

/**
 * /dashboard — Operations/Admin Dashboard
 *
 * Real-time monitoring and control center for the WordPress Finder system.
 * Auto-refreshes every 5 seconds. Displays statistics, worker status,
 * inventory levels, control buttons, and live event logs.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { DashboardResponse } from "@/lib/inventory.types";
import StatsCards from "@/components/dashboard/StatsCards";
import WorkerPanel from "@/components/dashboard/WorkerPanel";
import InventoryPanel from "@/components/dashboard/InventoryPanel";
import ControlPanel from "@/components/dashboard/ControlPanel";
import LogPanel from "@/components/dashboard/LogPanel";
import type { LogEntry } from "@/components/dashboard/LogPanel";

const REFRESH_INTERVAL = 5_000; // 5 seconds
const MAX_LOG_ENTRIES = 100;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const prevDataRef = useRef<DashboardResponse | null>(null);
  const logIdRef = useRef(0);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const entry: LogEntry = {
      id: ++logIdRef.current,
      timestamp: new Date().toISOString(),
      message,
      type,
    };
    setLogs((prev) => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        const body: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const newData: DashboardResponse = await res.json();
      const prev = prevDataRef.current;

      // Generate log entries on state changes
      if (prev) {
        if (prev.worker.status !== newData.worker.status) {
          if (newData.worker.status === "running") {
            addLog("Worker started — refill cycle in progress.", "success");
          } else if (newData.worker.status === "stopped") {
            addLog(`Worker stopped (exit code: ${newData.worker.lastExitCode ?? "N/A"}).`, "warning");
          }
        }

        const remainingDiff = newData.stats.remaining - prev.stats.remaining;
        if (remainingDiff > 0 && newData.worker.isRunning) {
          addLog(`+${remainingDiff} new domains verified and inserted.`, "success");
        }

        if (prev.stats.served !== newData.stats.served) {
          const servedDiff = newData.stats.served - prev.stats.served;
          if (servedDiff > 0) {
            addLog(`${servedDiff} domains served to clients.`, "info");
          }
        }

        if (
          newData.stats.remaining < newData.configuration.lowWaterMark &&
          prev.stats.remaining >= prev.configuration.lowWaterMark
        ) {
          addLog(
            `Inventory dropped below LOW_WATER_MARK (${newData.configuration.lowWaterMark}). Refill expected.`,
            "warning",
          );
        }

        if (newData.checkpoint && prev.checkpoint) {
          if (newData.checkpoint.recordOffset !== prev.checkpoint.recordOffset) {
            addLog(
              `Checkpoint updated: offset ${newData.checkpoint.recordOffset.toLocaleString()}, verified ${newData.checkpoint.verifiedCount.toLocaleString()}.`,
              "info",
            );
          }
        }
      } else {
        addLog("Dashboard connected. Auto-refresh active (5s interval).", "success");
      }

      prevDataRef.current = newData;
      setData(newData);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch dashboard data";
      setError(msg);
      addLog(`API error: ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  return (
    <main className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="mb-8 animate-[fade-in_0.5s_ease-out_both]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple-500 shadow-lg shadow-accent/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="white"
                className="w-7 h-7"
                aria-hidden="true"
              >
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM3.6 12c0-1.2.26-2.34.72-3.36L7.68 19.2A8.41 8.41 0 013.6 12zm8.4 8.4a8.43 8.43 0 01-2.4-.35l2.55-7.41 2.61 7.15a.37.37 0 00.03.06 8.45 8.45 0 01-2.79.55zm1.16-12.56c.51-.03.97-.08.97-.08.46-.06.4-.72-.06-.69 0 0-1.37.11-2.25.11-.83 0-2.22-.11-2.22-.11-.46-.03-.52.65-.06.68 0 0 .43.05.89.08l1.32 3.62-1.86 5.57-3.09-9.19c.51-.03.97-.08.97-.08.46-.06.4-.72-.06-.69 0 0-1.37.11-2.25.11-.16 0-.34 0-.53-.01A8.41 8.41 0 0112 3.6c2.17 0 4.15.82 5.64 2.17-.04 0-.07-.01-.11-.01-.83 0-1.42.72-1.42 1.5 0 .69.4 1.28.83 1.96.32.56.69 1.28.69 2.32 0 .72-.28 1.55-.64 2.71l-.84 2.81-3.09-9.22zm3.27 11.71l2.6-7.5c.48-1.21.64-2.17.64-3.03 0-.31-.02-.6-.06-.87A8.4 8.4 0 0120.4 12a8.41 8.41 0 01-4.17 7.55z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                WordPress Finder{" "}
                <span className="bg-gradient-to-r from-accent to-purple-500 bg-clip-text text-transparent">
                  Dashboard
                </span>
              </h1>
              <p className="text-sm text-muted">Operations &amp; monitoring center</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* System status badge */}
            <div className={`
              inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
              ${data?.worker.isRunning
                ? "bg-green-500/15 text-green-500 border border-green-500/30"
                : "bg-slate-500/15 text-muted border border-surface-border"
              }
            `}>
              <div className={`w-2 h-2 rounded-full ${data?.worker.isRunning ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
              {data?.worker.isRunning ? "System Active" : "System Idle"}
            </div>

            {/* Last update */}
            {data && (
              <span className="text-xs text-muted-foreground">
                Updated {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Error Alert ────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 w-full bg-danger-bg border border-danger-border text-danger rounded-xl px-4 py-3 mb-6 text-sm animate-[slide-up_0.3s_ease-out_both]"
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span><strong>Error:&nbsp;</strong>{error}</span>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin h-10 w-10 text-accent mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-muted">Loading dashboard…</p>
          </div>
        </div>
      )}

      {/* ── Dashboard Content ──────────────────────────────────── */}
      {data && (
        <div className="space-y-6 animate-[fade-in_0.4s_ease-out_both]">
          {/* Statistics Cards */}
          <StatsCards data={data} />

          {/* Two-column layout for Worker + Inventory */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WorkerPanel data={data} />
            <InventoryPanel data={data} />
          </div>

          {/* Controls */}
          <ControlPanel data={data} onRefresh={fetchDashboard} />

          {/* Live Logs */}
          <LogPanel logs={logs} />
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="mt-auto pt-8 text-muted-foreground text-xs text-center">
        <a href="/" className="hover:text-accent transition-colors">
          ← Back to Domain Finder
        </a>
        {" · "}
        WordPress Finder Dashboard · Phase 8
      </footer>
    </main>
  );
}
