"use client";

import { useState, useCallback } from "react";

/**
 * DomainRow — A single domain entry inside the results table.
 *
 * Props:
 *  - domain:  the domain string to display
 *  - index:   1-based position in the list (shown as a badge)
 *
 * Features a copy-to-clipboard button with a brief "Copied!" tooltip.
 */
interface DomainRowProps {
  domain: string;
  index: number;
}

export default function DomainRow({ domain, index }: DomainRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: silently fail if clipboard API is not available
    }
  }, [domain]);

  return (
    <tr
      className="group border-b border-surface-border last:border-b-0 hover:bg-surface-hover transition-colors duration-150"
    >
      {/* Index badge */}
      <td className="py-3 px-4 w-12">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-muted text-accent text-xs font-mono font-bold">
          {index}
        </span>
      </td>

      {/* Domain */}
      <td className="py-3 px-4">
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono text-foreground/80 group-hover:text-accent transition-colors duration-150 truncate block max-w-[60vw] sm:max-w-none"
          title={domain}
        >
          {domain}
        </a>
      </td>

      {/* Copy button */}
      <td className="py-3 px-4 text-right w-24">
        <button
          onClick={handleCopy}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            transition-all duration-200 cursor-pointer
            ${
              copied
                ? "bg-green-500/15 text-green-500 border border-green-500/30"
                : "bg-surface border border-surface-border text-muted hover:text-accent hover:border-accent/30 hover:bg-accent-muted"
            }
          `}
          aria-label={`Copy ${domain}`}
        >
          {copied ? (
            <>
              {/* Checkmark icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
              Copied
            </>
          ) : (
            <>
              {/* Clipboard icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M10.986 3H12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h1.014A2.25 2.25 0 0 1 7.25 1h1.5a2.25 2.25 0 0 1 2.236 2ZM9.5 4v-.75a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75V4h3ZM4 7a.75.75 0 0 0 0 1.5h8A.75.75 0 0 0 12 7H4Zm0 3.5a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5H4Z" clipRule="evenodd" />
              </svg>
              Copy
            </>
          )}
        </button>
      </td>
    </tr>
  );
}
