/**
 * Lead Factory Background Worker
 * Started via Next.js instrumentation on server boot.
 * Polls for queued runs every 15 seconds and processes them.
 */

import { prisma } from "@/lib/prisma";
import { processLeadRun } from "./pipeline";

const processing = new Set<string>();

const POLL_MS   = 15_000;
const STUCK_MIN = 15;

// ─── Worker health state (readable by the status API) ────────────────────────
export const workerState = {
  started: false,
  startedAt: null as Date | null,
  lastTickAt: null as Date | null,
  tickCount: 0,
  activeRuns: [] as string[],
};

async function tick() {
  workerState.lastTickAt = new Date();
  workerState.tickCount++;
  workerState.activeRuns = [...processing];
  try {
    // Pick up queued runs (up to 3 at once)
    const queued = await prisma.leadRun.findMany({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      take: 3,
    });

    for (const run of queued) {
      if (processing.has(run.id)) continue;
      processing.add(run.id);
      console.log(`[worker] Starting run ${run.id} — "${run.prompt.slice(0, 60)}"`);

      processLeadRun(run.id)
        .catch(async (err) => {
          console.error(`[worker] Run ${run.id} failed:`, err);
          await prisma.leadRun
            .update({ where: { id: run.id }, data: { status: "failed", stage: String(err).slice(0, 200) } })
            .catch(() => {});
        })
        .finally(() => processing.delete(run.id));
    }

    // Re-queue runs stuck in active states for too long
    const stuckCutoff = new Date(Date.now() - STUCK_MIN * 60 * 1000);
    const stuck = await prisma.leadRun.findMany({
      where: {
        status: { in: ["planning", "discovering", "researching"] },
        updatedAt: { lt: stuckCutoff },
        id: { notIn: [...processing] },
      },
    });

    for (const run of stuck) {
      console.log(`[worker] Re-queuing stuck run ${run.id}`);
      await prisma.leadRun.update({
        where: { id: run.id },
        data: { status: "queued", stage: "Re-queued by worker…" },
      });
    }
  } catch (err) {
    console.error("[worker] tick error:", err);
  }
}

export function startWorker() {
  workerState.started = true;
  workerState.startedAt = new Date();
  console.log("[worker] Lead Factory worker started");
  // Delay first tick 5s so the server finishes booting before we hit the DB
  setTimeout(() => {
    tick();
    setInterval(tick, POLL_MS);
  }, 5000);
}
