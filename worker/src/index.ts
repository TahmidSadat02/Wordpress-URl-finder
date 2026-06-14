/**
 * index.ts — Entry point
 *
 * Thin bootstrap that hands off immediately to the runner.
 * Keeping this file minimal means:
 *   - The runner is fully testable in isolation.
 *   - CLI argument parsing can be added here without touching business logic.
 *
 * Usage:
 *   npm start          # runs via ts-node (development)
 *   npm run build      # compiles to dist/
 *   npm run run:compiled  # runs compiled output (faster for repeated runs)
 */

import { run } from "./runner";

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[FATAL] ${message}`);
  process.exit(1);
});
