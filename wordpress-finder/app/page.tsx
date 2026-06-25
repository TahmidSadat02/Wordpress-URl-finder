"use client";

/**
 * app/page.tsx — WordPress Finder Homepage
 *
 * Orchestrates the full domain-discovery workflow:
 *   1. "Get Domains"  → replaces state with fresh batch from the API
 *   2. "Load More"    → appends new domains, skipping duplicates
 *   3. Copy / Copy All / Download TXT — delegated to child components
 *
 * State is managed entirely with React hooks (useState, useCallback).
 */

import { useState, useCallback } from "react";

import Header from "@/components/Header";
import Loading from "@/components/Loading";
import EmptyState from "@/components/EmptyState";
import DomainTable from "@/components/DomainTable";
import ActionButtons from "@/components/ActionButtons";

/* ── Types ────────────────────────────────────────────────────────────── */
interface ApiSuccess {
  domains: string[];
}

interface ApiError {
  error: string;
}

/* ── Component ────────────────────────────────────────────────────────── */
export default function Home() {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * fetchDomains — Calls GET /api/domains.
   *
   * @param append  If true, merges into existing state (Load More).
   *                If false, replaces state entirely (Get Domains).
   */
  const fetchDomains = useCallback(async (append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await fetch("/api/domains");

      if (!res.ok) {
        const body: ApiError = await res.json().catch(() => ({
          error: `Server responded with ${res.status}`,
        }));
        throw new Error(body.error);
      }

      const data: ApiSuccess = await res.json();

      if (append) {
        // Append, ignoring duplicates already in state
        setDomains((prev) => {
          const existing = new Set(prev);
          const newDomains = data.domains.filter((d) => !existing.has(d));
          return [...prev, ...newDomains];
        });
      } else {
        setDomains(data.domains);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  /** Get Domains — replaces current list */
  const handleGetDomains = useCallback(() => fetchDomains(false), [fetchDomains]);

  /** Load More — appends new domains */
  const handleLoadMore = useCallback(() => fetchDomains(true), [fetchDomains]);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 sm:px-6 py-16 sm:py-20">
      {/* ── Header ─────────────────────────────────────────────── */}
      <Header />

      {/* ── Get Domains Button ─────────────────────────────────── */}
      <section aria-label="Fetch action" className="mb-10">
        <button
          id="get-domains-btn"
          onClick={handleGetDomains}
          disabled={loading}
          className={`
            group relative inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-semibold text-base
            transition-all duration-300 focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background
            cursor-pointer
            ${
              loading
                ? "bg-accent/30 text-accent/60 cursor-not-allowed"
                : "bg-gradient-to-r from-accent to-purple-500 text-white shadow-xl shadow-accent/25 hover:shadow-2xl hover:shadow-accent/30 hover:scale-[1.03] active:scale-95"
            }
          `}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Fetching…
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
              Get Domains
            </>
          )}
        </button>
      </section>

      {/* ── Error Alert ────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          id="error-message"
          className="flex items-start gap-3 max-w-xl w-full bg-danger-bg border border-danger-border text-danger rounded-2xl px-5 py-4 mb-8 text-sm animate-[slide-up_0.3s_ease-out_both]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            <strong className="font-semibold">Error:&nbsp;</strong>
            {error}
          </span>
        </div>
      )}

      {/* ── Loading Spinner ────────────────────────────────────── */}
      {loading && <Loading />}

      {/* ── Empty State ────────────────────────────────────────── */}
      {!loading && !error && domains.length === 0 && <EmptyState />}

      {/* ── Results Table ──────────────────────────────────────── */}
      {domains.length > 0 && (
        <>
          <DomainTable domains={domains} />
          <ActionButtons
            domains={domains}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
          />
        </>
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="mt-auto pt-16 text-muted-foreground text-xs text-center">
        WordPress Finder · Built with Next.js
      </footer>
    </main>
  );
}
