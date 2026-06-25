/**
 * checkpoint.ts
 *
 * Implements lightweight persistence for worker crawl state.
 *
 * Enables resuming crawling after abrupt shutdowns, crashes, or pauses
 * by saving the current WARC file URL, the record index/offset within
 * that file, the number of verified domains, and a timestamp.
 */

import * as fs from "fs";
import * as path from "path";
import { CHECKPOINT_FILE } from "./config";
import { log } from "./logger";

export interface CheckpointData {
  /** The WARC segment file URL currently being streamed. */
  warcPath: string;
  /** The record offset index (1-based count) within the current segment. */
  recordOffset: number;
  /** Total verified domains count at the checkpoint. */
  verifiedCount: number;
  /** ISO timestamp when the checkpoint was saved. */
  timestamp: string;
}

// Resolve path to the worker root directory if it is a relative path.
const CHECKPOINT_PATH = path.isAbsolute(CHECKPOINT_FILE)
  ? CHECKPOINT_FILE
  : path.resolve(__dirname, "..", CHECKPOINT_FILE);

/**
 * Persists the given checkpoint state to disk as JSON.
 */
export function saveCheckpoint(data: CheckpointData): void {
  try {
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    log.error("Failed to write checkpoint file", err);
  }
}

/**
 * Loads and validates the checkpoint file if it exists.
 * Returns null if no checkpoint exists or if parsing fails.
 */
export function loadCheckpoint(): CheckpointData | null {
  try {
    if (fs.existsSync(CHECKPOINT_PATH)) {
      const content = fs.readFileSync(CHECKPOINT_PATH, "utf8");
      const parsed = JSON.parse(content) as CheckpointData;
      
      // Basic type validation on the parsed object
      if (
        parsed &&
        typeof parsed.warcPath === "string" &&
        typeof parsed.recordOffset === "number" &&
        typeof parsed.verifiedCount === "number"
      ) {
        return parsed;
      }
    }
  } catch (err) {
    log.error("Failed to read/parse checkpoint file", err);
  }
  return null;
}

/**
 * Deletes the checkpoint file from disk (typically called upon successful completion).
 */
export function deleteCheckpoint(): void {
  try {
    if (fs.existsSync(CHECKPOINT_PATH)) {
      fs.unlinkSync(CHECKPOINT_PATH);
      log.info("Checkpoint file deleted successfully.");
    }
  } catch (err) {
    log.error("Failed to delete checkpoint file", err);
  }
}
