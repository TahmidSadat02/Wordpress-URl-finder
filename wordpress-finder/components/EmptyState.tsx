"use client";

/**
 * EmptyState — Placeholder shown before the first fetch.
 *
 * Provides a visual cue (a globe icon) and descriptive text to guide
 * the user toward clicking "Get Domains".
 */
export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-[fade-in_0.5s_ease-out_both]">
      {/* Globe icon */}
      <div className="w-16 h-16 rounded-2xl bg-surface border border-surface-border flex items-center justify-center mb-5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-8 h-8 text-muted-foreground"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.264.26-2.468.73-3.563"
          />
        </svg>
      </div>
      <p className="text-muted text-sm font-medium mb-1">No domains loaded yet</p>
      <p className="text-muted-foreground text-xs">
        Click &ldquo;Get Domains&rdquo; to start discovering WordPress sites.
      </p>
    </div>
  );
}
