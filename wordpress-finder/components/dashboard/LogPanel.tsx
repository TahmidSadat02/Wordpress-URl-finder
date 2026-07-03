"use client";

/**
 * LogPanel — Scrollable live log display.
 *
 * Maintains an in-memory event log (max 100 entries, newest first)
 * fed by data changes from the dashboard auto-refresh cycle.
 * Each refresh that detects a state change produces a log entry.
 */

import { useRef, useEffect } from "react";

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

interface LogPanelProps {
  logs: LogEntry[];
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "--:--:--";
  }
}

const typeStyles: Record<LogEntry["type"], string> = {
  info: "text-blue-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

const typeBadge: Record<LogEntry["type"], string> = {
  info: "bg-blue-500/20 text-blue-400",
  success: "bg-emerald-500/20 text-emerald-400",
  warning: "bg-amber-500/20 text-amber-400",
  error: "bg-red-500/20 text-red-400",
};

export type { LogEntry };

export default function LogPanel({ logs }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new entries (newest first)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  return (
    <section aria-label="Live logs" className="w-full">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span className="text-xl">📋</span> Live Logs
        <span className="ml-auto text-xs font-normal text-muted">
          {logs.length} entries
        </span>
      </h2>
      <div
        ref={scrollRef}
        className="
          rounded-xl border border-surface-border bg-surface/60 backdrop-blur-sm
          h-64 overflow-y-auto font-mono text-xs
        "
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted">
            No events recorded yet. Waiting for system activity…
          </div>
        ) : (
          <div className="divide-y divide-surface-border/30">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-2 hover:bg-surface-hover/50 transition-colors">
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatTime(log.timestamp)}
                </span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${typeBadge[log.type]}`}>
                  {log.type}
                </span>
                <span className={`${typeStyles[log.type]} break-all`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
