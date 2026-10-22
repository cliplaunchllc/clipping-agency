import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Import lazily — if instrumentation never ran, this module may not be loaded
  try {
    const { workerState } = await import("@/lib/lead-factory/worker");

    const now = Date.now();
    const secondsSinceTick = workerState.lastTickAt
      ? Math.floor((now - workerState.lastTickAt.getTime()) / 1000)
      : null;

    const healthy =
      workerState.started &&
      secondsSinceTick !== null &&
      secondsSinceTick < 60; // should tick every 15s — allow 4x grace

    return NextResponse.json({
      running: workerState.started,
      healthy,
      startedAt: workerState.startedAt,
      lastTickAt: workerState.lastTickAt,
      secondsSinceLastTick: secondsSinceTick,
      tickCount: workerState.tickCount,
      activeRuns: workerState.activeRuns,
      message: !workerState.started
        ? "Worker has not started — instrumentation.ts may not have run"
        : healthy
        ? `Worker is running (last tick ${secondsSinceTick}s ago)`
        : `Worker may be stalled (last tick ${secondsSinceTick}s ago)`,
    });
  } catch {
    return NextResponse.json({
      running: false,
      healthy: false,
      message: "Worker module not loaded — server may not support instrumentation.ts",
    });
  }
}
