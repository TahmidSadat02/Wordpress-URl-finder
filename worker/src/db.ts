/**
 * db.ts
 *
 * Encapsulates all database operations via Prisma.
 *
 * Responsibilities:
 *  - Provide a singleton PrismaClient instance.
 *  - Bulk-insert discovered WordPress domains into PostgreSQL.
 *  - Handle duplicate domains gracefully via skipDuplicates.
 *  - Provide a clean disconnect method for shutdown.
 *
 * The rest of the worker never touches Prisma directly — all DB
 * access goes through the functions exported here.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Result of a bulk insert operation. */
export interface InsertResult {
  /** Number of domains passed in. */
  total: number;
  /** Number of new rows actually inserted. */
  inserted: number;
  /** Number of domains skipped because they already existed. */
  skipped: number;
}

/**
 * Extracts the hostname from a full origin URL.
 *
 * @example
 *   extractDomain("https://blog.example.com") // → "blog.example.com"
 *   extractDomain("https://example.com:8080") // → "example.com:8080"
 */
function extractDomain(originUrl: string): string | null {
  try {
    const parsed = new URL(originUrl);
    return parsed.hostname;
  } catch {
    return null;
  }
}

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

/**
 * Cleanly disconnects the Prisma Client.
 * Call this before process exit to release the connection pool.
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
