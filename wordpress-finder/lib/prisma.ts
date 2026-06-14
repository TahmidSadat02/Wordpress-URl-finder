/**
 * lib/prisma.ts
 *
 * Singleton PrismaClient for Next.js.
 *
 * WHY A SINGLETON?
 * Next.js hot-reloads modules in development, which would create a new
 * PrismaClient on every file save — each client opens its own connection
 * pool and quickly exhausts PostgreSQL's connection limit.
 *
 * The standard fix is to attach the client to `globalThis`, which
 * survives hot-reloads. In production, modules are only loaded once so
 * the guard is never triggered.
 *
 * Reference: https://www.prisma.io/docs/guides/nextjs
 */

import { PrismaClient } from "@prisma/client";

// Extend the global type so TypeScript knows about our cached instance.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export default prisma;
