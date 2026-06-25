"use client";

import { useState, useCallback } from "react";

/**
 * ActionButtons — "Copy All", "Download TXT", and "Load More" controls.
 *
 * Props:
 *  - domains:   the current domain list (for copy/download)
 *  - onLoadMore: callback to fetch another batch and append
 *  - loadingMore: whether a "Load More" fetch is currently in progress
 *
 * Each button is self-contained with its own transient state (e.g. "Copied!").
 */
interface ActionButtonsProps {
  domains: string[];
  onLoadMore: () => void;
  loadingMore: boolean;
}

export default function ActionButtons({
  domains,
  onLoadMore,
  loadingMore,
}: ActionButtonsProps) {
  const [allCopied, setAllCopied] = useState(false);

  /** Copy every domain (newline-separated) to the clipboard. */
  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(domains.join("\n"));
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    } catch {
      // Silent fallback
    }
  }, [domains]);

  /** Generate and download a domains.txt file. */
  const handleDownload = useCallback(() => {
    const content = domains.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domains.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [domains]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-3xl mt-6 animate-[fade-in_0.3s_ease-out_both]">
      {/* Copy All */}
      <button
        id="copy-all-btn"
        onClick={handleCopyAll}
        className={`
          inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-200 cursor-pointer
          ${
            allCopied
              ? "bg-green-500/15 text-green-500 border border-green-500/30"
              : "bg-surface border border-surface-border text-foreground hover:border-accent/40 hover:text-accent hover:bg-accent-muted"
          }
        `}
      >
        {allCopied ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
            Copied All!
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 9 6H7a1.5 1.5 0 0 1-1.5-1.5v-1Z" />
              <path fillRule="evenodd" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h7A1.5 1.5 0 0 1 13 6.5v6a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 12.5v-6Zm2 1.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5H8a.75.75 0 0 0 0-1.5H5.75Z" clipRule="evenodd" />
            </svg>
            Copy All
          </>
        )}
      </button>

      {/* Download TXT */}
      <button
        id="download-txt-btn"
        onClick={handleDownload}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-surface border border-surface-border text-foreground hover:border-accent/40 hover:text-accent hover:bg-accent-muted transition-all duration-200 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z" />
          <path d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
        </svg>
        Download TXT
      </button>

      {/* Load More */}
      <button
        id="load-more-btn"
        onClick={onLoadMore}
        disabled={loadingMore}
        className={`
          inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-200 cursor-pointer
          ${
            loadingMore
              ? "bg-accent/20 text-accent/60 border border-accent/10 cursor-not-allowed"
              : "bg-gradient-to-r from-accent to-purple-500 text-white hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.02] active:scale-95"
          }
        `}
      >
        {loadingMore ? (
          <>
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Loading…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" clipRule="evenodd" />
            </svg>
            Load More
          </>
        )}
      </button>
    </div>
  );
}
