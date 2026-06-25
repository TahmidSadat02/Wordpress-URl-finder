"use client";

/**
 * Loading — Full-section spinner with animated dots.
 *
 * Shows a pulsing spinner and a "Fetching domains…" label.
 * Intended to fill the results area while the API request is in-flight.
 */
export default function Loading() {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 animate-[fade-in_0.3s_ease-out_both]"
      role="status"
      aria-label="Loading domains"
    >
      {/* Spinner ring */}
      <div className="relative w-12 h-12 mb-5">
        <div className="absolute inset-0 rounded-full border-2 border-surface-border" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
      </div>
      <p className="text-muted text-sm font-medium">Fetching domains…</p>
    </div>
  );
}
