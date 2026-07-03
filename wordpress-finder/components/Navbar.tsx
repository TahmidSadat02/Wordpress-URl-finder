"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-surface-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple-500 text-white shadow-md shadow-accent/15 group-hover:scale-105 transition-transform duration-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM3.6 12c0-1.2.26-2.34.72-3.36L7.68 19.2A8.41 8.41 0 013.6 12zm8.4 8.4a8.43 8.43 0 01-2.4-.35l2.55-7.41 2.61 7.15a.37.37 0 00.03.06 8.45 8.45 0 01-2.79.55zm1.16-12.56c.51-.03.97-.08.97-.08.46-.06.4-.72-.06-.69 0 0-1.37.11-2.25.11-.83 0-2.22-.11-2.22-.11-.46-.03-.52.65-.06.68 0 0 .43.05.89.08l1.32 3.62-1.86 5.57-3.09-9.19c.51-.03.97-.08.97-.08.46-.06.4-.72-.06-.69 0 0-1.37.11-2.25.11-.16 0-.34 0-.53-.01A8.41 8.41 0 0112 3.6c2.17 0 4.15.82 5.64 2.17-.04 0-.07-.01-.11-.01-.83 0-1.42.72-1.42 1.5 0 .69.4 1.28.83 1.96.32.56.69 1.28.69 2.32 0 .72-.28 1.55-.64 2.71l-.84 2.81-3.09-9.22zm3.27 11.71l2.6-7.5c.48-1.21.64-2.17.64-3.03 0-.31-.02-.6-.06-.87A8.4 8.4 0 0120.4 12a8.41 8.41 0 01-4.17 7.55z" />
            </svg>
          </div>
          <span className="font-bold text-foreground tracking-tight hover:opacity-95 transition-opacity">
            WordPress{" "}
            <span className="bg-gradient-to-r from-accent to-purple-500 bg-clip-text text-transparent">
              Finder
            </span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex gap-1 bg-surface-hover/20 p-1 rounded-xl border border-surface-border/50">
          <Link
            href="/"
            className={`
              px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200
              ${
                pathname === "/"
                  ? "bg-accent text-white shadow-md shadow-accent/15"
                  : "text-muted hover:text-foreground hover:bg-surface-hover/60"
              }
            `}
          >
            Domain Finder
          </Link>
          <Link
            href="/dashboard"
            className={`
              px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200
              ${
                pathname === "/dashboard"
                  ? "bg-accent text-white shadow-md shadow-accent/15"
                  : "text-muted hover:text-foreground hover:bg-surface-hover/60"
              }
            `}
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </nav>
  );
}
