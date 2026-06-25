/**
 * db.ts
 *
 * Encapsulates all database operations via Prisma.
 *
 * Responsibilities:
 *  - Provide a singleton PrismaClient instance.
 *  - Insert individual verified domains (streaming inserts).
 *  - Bulk-insert discovered WordPress domains (legacy, kept for compat).
 *  - Handle duplicate domains gracefully.
 *  - Count existing domains (for resume-from-existing).
 *  - Provide a clean disconnect method for shutdown.
 *
 * The rest of the worker never touches Prisma directly — all DB
 * access goes through the functions exported here.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ── Types ──────────────────────────────────────────────────────────── */

/** Result of a bulk insert operation. */
export interface InsertResult {
  /** Number of domains passed in. */
  total: number;
  /** Number of new rows actually inserted. */
  inserted: number;
  /** Number of domains skipped because they already existed. */
  skipped: number;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

/**
 * Extracts the hostname from a full origin URL.
 *
 * @example
 *   extractDomain("https://blog.example.com") // → "blog.example.com"
 */
function extractDomain(originUrl: string): string | null {
  try {
    return new URL(originUrl).hostname;
  } catch {
    return null;
  }
}

/* ── Single-domain insert (used by verification workers) ────────────── */

/**
 * Insert a single verified domain into the database.
 *
 * Uses Prisma's `upsert` to atomically handle duplicates:
 *  - If the domain doesn't exist → INSERT → returns "inserted"
 *  - If the domain already exists → no-op → returns "duplicate"
 *
 * @param domain    - The bare hostname (e.g. "example.com")
 * @param sourceWarc - The WARC file URL this domain was discovered in
 * @returns "inserted" | "duplicate"
 */
export async function insertDomain(
  domain: string,
  sourceWarc: string
): Promise<"inserted" | "duplicate"> {
  try {
    await prisma.discoveredDomain.create({
      data: { domain, sourceWarc },
    });
    return "inserted";
  } catch (err: unknown) {
    // Prisma P2002 = unique constraint violation (duplicate domain).
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return "duplicate";
    }
    throw err;
  }
}

/* ── Count existing domains (for resume) ────────────────────────────── */

/**
 * Returns the total number of domains currently in the database.
 * Used at startup to resume from existing progress.
 */
export async function countDomains(): Promise<number> {
  return prisma.discoveredDomain.count();
}

/* ── Bulk insert (kept for backwards compatibility) ─────────────────── */

/**
 * Inserts an array of WordPress origin URLs into the
 * `discovered_domains` table.
 *
 * Domains are extracted from the origin URLs (scheme + host → hostname).
 * Duplicates are silently skipped via Prisma's `skipDuplicates`.
 *
 * @param urls       - Array of origin URLs (e.g., "https://example.com").
 * @param sourceWarc - The WARC file URL these domains were discovered in.
 * @returns Summary of how many were inserted vs skipped.
 */
export async function insertDomains(
  urls: string[],
  sourceWarc: string
): Promise<InsertResult> {
  // Deduplicate domains and filter out any that fail to parse.
  const domainSet = new Map<string, string>();
  for (const url of urls) {
    const domain = extractDomain(url);
    if (domain && !domainSet.has(domain)) {
      domainSet.set(domain, url);
    }
  }

  const data = Array.from(domainSet.keys()).map((domain) => ({
    domain,
    sourceWarc,
  }));

  const total = data.length;

  if (total === 0) {
    return { total: 0, inserted: 0, skipped: 0 };
  }

  // createMany with skipDuplicates is supported on PostgreSQL.
  const result = await prisma.discoveredDomain.createMany({
    data,
    skipDuplicates: true,
  });

  const inserted = result.count;
  const skipped = total - inserted;

  return { total, inserted, skipped };
}

/* ── Cleanup ────────────────────────────────────────────────────────── */

/**
 * Cleanly disconnects the Prisma Client.
 * Call this before process exit to release the connection pool.
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
