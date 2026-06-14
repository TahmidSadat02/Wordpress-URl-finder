"use client";

/**
 * app/page.tsx — WordPress Finder Homepage
 *
 * This is the sole page of the application.
 * It is a Client Component ("use client") because it manages local React
 * state (loading, error, urls) and handles a user-triggered fetch.
 *
 * State:
 *   loading  – true while the API call is in-flight; disables the button
 *              and shows a spinner indicator.
 *   error    – stores an error message string when the fetch fails.
 *   urls     – array of WordPress URL strings returned by the API.
 *
 * Data flow:
 *   Button click → fetchUrls() → GET /api/wordpress
 *                → success: set urls[]
 *                → failure: set error string
 */

import { useState } from "react";

type FetchState = {
  loading: boolean;
  error: string | null;
  urls: string[];
};

export default function Home() {
  const [state, setState] = useState<FetchState>({
    loading: false,
    error: null,
    urls: [],
  });

  /**
   * fetchUrls
   * Calls the internal API route, handles loading/error/success transitions,
   * and updates component state accordingly.
   */
  async function fetchUrls() {
    setState({ loading: true, error: null, urls: [] });

    try {
      const response = await fetch("/api/wordpress");

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status} ${response.statusText}`
        );
      }

      const data: { urls: string[] } = await response.json();
      setState({ loading: false, error: null, urls: data.urls });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setState({ loading: false, error: message, urls: [] });
    }
  }

  const { loading, error, urls } = state;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center px-4 py-16">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="text-center mb-12 max-w-xl">
        {/* WordPress logo badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-6 shadow-lg shadow-blue-600/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="w-9 h-9"
            aria-hidden="true"
          >
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM3.6 12c0-1.2.26-2.34.72-3.36L7.68 19.2A8.41 8.41 0 013.6 12zm8.4 8.4a8.43 8.43 0 01-2.4-.35l2.55-7.41 2.61 7.15a.37.37 0 00.03.06 8.45 8.45 0 01-2.79.55zm1.16-12.56c.51-.03.97-.08.97-.08.46-.06.4-.72-.06-.69 0 0-1.37.11-2.25.11-.83 0-2.22-.11-2.22-.11-.46-.03-.52.65-.06.68 0 0 .43.05.89.08l1.32 3.62-1.86 5.57-3.09-9.19c.51-.03.97-.08.97-.08.46-.06.4-.72-.06-.69 0 0-1.37.11-2.25.11-.16 0-.34 0-.53-.01A8.41 8.41 0 0112 3.6c2.17 0 4.15.82 5.64 2.17-.04 0-.07-.01-.11-.01-.83 0-1.42.72-1.42 1.5 0 .69.4 1.28.83 1.96.32.56.69 1.28.69 2.32 0 .72-.28 1.55-.64 2.71l-.84 2.81-3.09-9.22zm3.27 11.71l2.6-7.5c.48-1.21.64-2.17.64-3.03 0-.31-.02-.6-.06-.87A8.4 8.4 0 0120.4 12a8.41 8.41 0 01-4.17 7.55z" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
          WordPress Finder
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed">
          Fetch WordPress URLs from indexed web data.
        </p>
      </header>

      {/* ── Action Button ───────────────────────────────────────── */}
      <section aria-label="Fetch action" className="mb-10">
        <button
          id="fetch-wordpress-urls-btn"
          onClick={fetchUrls}
          disabled={loading}
          className={`
            inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-semibold text-base
            transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950
            ${
              loading
                ? "bg-blue-700/50 text-blue-300 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-600/25"
            }
          `}
        >
          {loading ? (
            <>
              {/* Spinner */}
              <svg
                className="animate-spin h-5 w-5 text-blue-300"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Loading...
            </>
          ) : (
            <>
              {/* Search icon */}
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
              Fetch WordPress URLs
            </>
          )}
        </button>
      </section>

      {/* ── Error State ─────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          id="error-message"
          className="flex items-start gap-3 max-w-xl w-full bg-red-950/60 border border-red-700/50 text-red-300 rounded-xl px-5 py-4 mb-8 text-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 shrink-0 mt-0.5 text-red-400"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            <strong className="font-semibold">Request failed:</strong> {error}
          </span>
        </div>
      )}

      {/* ── Results Section ─────────────────────────────────────── */}
      {urls.length > 0 && (
        <section
          aria-label="WordPress URL results"
          id="results-section"
          className="w-full max-w-2xl"
        >
          {/* Results header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
              Results
            </h2>
            <span className="text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full px-3 py-1">
              {urls.length} URLs found
            </span>
          </div>

          {/* URL list */}
          <ul className="space-y-2">
            {urls.map((url, index) => (
              <li
                key={url}
                className="group flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3.5 hover:border-blue-600/50 hover:bg-gray-800/60 transition-all duration-150"
              >
                {/* Index badge */}
                <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 group-hover:bg-blue-600/20 text-gray-500 group-hover:text-blue-400 text-xs font-mono font-bold transition-colors duration-150">
                  {index + 1}
                </span>

                {/* URL link */}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm font-mono text-gray-300 group-hover:text-white truncate transition-colors duration-150"
                  title={url}
                >
                  {url}
                </a>

                {/* External link icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 shrink-0 text-gray-600 group-hover:text-blue-400 transition-colors duration-150"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                    clipRule="evenodd"
                  />
                  <path
                    fillRule="evenodd"
                    d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Empty State (shown before first fetch) ──────────────── */}
      {!loading && !error && urls.length === 0 && (
        <p className="text-gray-600 text-sm mt-4">
          Click the button above to discover WordPress sites.
        </p>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="mt-auto pt-16 text-gray-700 text-xs text-center">
        WordPress Finder · Phase 1 · Mock data
      </footer>
    </main>
  );
}
