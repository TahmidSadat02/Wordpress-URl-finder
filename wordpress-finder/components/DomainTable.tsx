"use client";

import DomainRow from "./DomainRow";

/**
 * DomainTable — Renders a responsive table of discovered domains.
 *
 * Props:
 *  - domains: the string array of domain names to display
 *
 * Delegates each row to <DomainRow /> for copy-per-domain functionality.
 * Also displays a counter badge in the table header.
 */
interface DomainTableProps {
  domains: string[];
}

export default function DomainTable({ domains }: DomainTableProps) {
  return (
    <div className="w-full max-w-3xl animate-[slide-up_0.4s_ease-out_both]">
      {/* Section heading + counter */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-widest">
          Discovered Domains
        </h2>
        <span className="text-xs font-medium bg-accent-muted text-accent border border-accent/20 rounded-full px-3 py-1">
          {domains.length} {domains.length === 1 ? "domain" : "domains"}
        </span>
      </div>

      {/* Table card */}
      <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-xl shadow-black/5 dark:shadow-black/20">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-surface-border bg-surface-hover/50">
              <th className="py-2.5 px-4 text-[11px] font-semibold text-muted uppercase tracking-wider w-12">
                #
              </th>
              <th className="py-2.5 px-4 text-[11px] font-semibold text-muted uppercase tracking-wider">
                Domain
              </th>
              <th className="py-2.5 px-4 text-[11px] font-semibold text-muted uppercase tracking-wider text-right w-24">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {domains.map((domain, i) => (
              <DomainRow key={domain} domain={domain} index={i + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
