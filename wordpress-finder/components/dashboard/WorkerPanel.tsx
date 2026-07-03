"use client";

/**
 * WorkerPanel — Displays detailed worker process status.
 *
 * Shows: state, WARC segment, record offset, checkpoint time,
 * progress, PID, runtime, and last exit code.
 * Unavailable metrics display "N/A".
 */

import type { DashboardResponse } from "@/lib/inventory.types";

interface WorkerPanelProps {
  data: DashboardResponse;
}

function formatDuration(startIso: string | null): string {
  if (!startIso) return "N/A";
  const elapsed = Date.now() - new Date(startIso).getTime();
  if (elapsed < 0) return "N/A";
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "N/A";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "N/A";
  }
}

function extractSegmentName(warcPath: string | undefined): string {
  if (!warcPath) return "N/A";
  const match = warcPath.match(/CC-MAIN-[^/]+/);
  const segmentMatch = warcPath.match(/([^/]+\.warc\.gz)$/);
  if (match && segmentMatch) return `${match[0]} / ${segmentMatch[1].slice(0, 30)}…`;
  if (segmentMatch) return segmentMatch[1];
  return warcPath.slice(-50);
}

interface DetailRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-surface-border/50 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default function WorkerPanel({ data }: WorkerPanelProps) {
  const { worker, checkpoint } = data;
  const isRunning = worker.isRunning;

  const progress = checkpoint
    ? Math.min(Math.round((checkpoint.verifiedCount / data.inventory.target) * 100), 100)
    : 0;

  return (
    <section aria-label="Worker status" className="w-full">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        Worker
      </h2>
      <div className="rounded-xl border border-surface-border bg-surface/60 backdrop-blur-sm p-5">
        {/* Status badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
          <span className={`text-sm font-semibold uppercase tracking-wider ${isRunning ? "text-green-500" : "text-muted"}`}>
            {worker.status}
          </span>
          {worker.pid && (
            <span className="text-xs font-mono text-muted bg-surface-hover rounded px-2 py-0.5">
              PID {worker.pid}
            </span>
          )}
        </div>

        {/* Progress bar (only when running) */}
        {isRunning && checkpoint && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Detail rows */}
        <div className="space-y-0">
          <DetailRow
            label="WARC Segment"
            value={extractSegmentName(checkpoint?.warcPath)}
            mono
          />
          <DetailRow
            label="Record Offset"
            value={checkpoint?.recordOffset?.toLocaleString() ?? "N/A"}
            mono
          />
          <DetailRow
            label="Verified Count"
            value={checkpoint?.verifiedCount?.toLocaleString() ?? "N/A"}
            mono
          />
          <DetailRow
            label="Checkpoint Time"
            value={formatTimestamp(checkpoint?.timestamp ?? null)}
          />
          <DetailRow
            label="Runtime"
            value={isRunning ? formatDuration(worker.lastStartedAt) : "N/A"}
          />
          <DetailRow
            label="Last Started"
            value={formatTimestamp(worker.lastStartedAt)}
          />
          <DetailRow
            label="Last Stopped"
            value={formatTimestamp(worker.lastStoppedAt)}
          />
          <DetailRow
            label="Last Exit Code"
            value={worker.lastExitCode !== null ? String(worker.lastExitCode) : "N/A"}
            mono
          />
        </div>
      </div>
    </section>
  );
}
