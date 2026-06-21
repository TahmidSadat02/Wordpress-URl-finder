import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from environment variables");
}

declare global {
  var __pool: Pool | undefined;
}

const pool = globalThis.__pool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__pool = pool;
}

export default pool;
