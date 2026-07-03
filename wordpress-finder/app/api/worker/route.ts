/**
 * POST /api/worker
 *
 * Worker control endpoint for start/stop operations.
 *
 * Request body:
 *   { "action": "start" }  — Start a refill cycle
 *   { "action": "stop" }   — Stop the running worker
 *
 * Responses:
 *   200  { status: string, message: string }
 *   400  { error: string }  — Invalid action
 *   500  { error: string }  — Server error
 */

import { NextResponse } from "next/server";
import { workerManager } from "@/lib/worker.manager";

interface WorkerControlRequest {
  action: "start" | "stop";
}

interface WorkerControlResponse {
  status: string;
  message: string;
}

export async function POST(
  request: Request,
): Promise<NextResponse<WorkerControlResponse | { error: string }>> {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("action" in body) ||
      typeof (body as WorkerControlRequest).action !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid request body. Expected { action: 'start' | 'stop' }" },
        { status: 400 },
      );
    }

    const { action } = body as WorkerControlRequest;

    if (action === "start") {
      if (workerManager.isRunning()) {
        return NextResponse.json({
          status: "already_running",
          message: "Worker is already running.",
        });
      }
      workerManager.startRefill();
      return NextResponse.json({
        status: "started",
        message: "Worker refill started.",
      });
    }

    if (action === "stop") {
      if (!workerManager.isRunning()) {
        return NextResponse.json({
          status: "not_running",
          message: "No worker is currently running.",
        });
      }
      workerManager.stopRefill();
      return NextResponse.json({
        status: "stopped",
        message: "Worker stop signal sent.",
      });
    }

    return NextResponse.json(
      { error: `Invalid action: "${String(action)}". Use "start" or "stop".` },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/worker] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
