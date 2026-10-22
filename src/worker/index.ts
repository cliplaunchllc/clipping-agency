/**
 * Lead Factory Background Worker
 *
 * Polls the database for queued lead runs and processes them.
 * Runs as a separate Railway service — independent of the web server.
 * Survives tab closes, server restarts, and redeployments.
 */

import { PrismaClient } from "@prisma/client";
import { processLeadRun } from "../lib/lead-factory/pipeline";

const prisma = new PrismaClient();

// Runs currently being processed by this worker instance
const processing = new Set<string>();

const POLL_INTERVAL_MS = 15_000; // check every 15 seconds
const STUCK_TIMEOUT_MIN = 15;    // reset runs stuck in active state for 15+ min

async function tick() {
  try {
    // ── 1. Pick up queued runs ──────────────────────────────────────────────
    const queued = await prisma.leadRun.findMany({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      take: 3, // process up to 3 runs concurrently
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
        .finally(() => {
          processing.delete(run.id);
        });
    }

    // ── 2. Recover stuck runs (active for >15 min without update) ──────────
    const stuckCutoff = new Date(Date.now() - STUCK_TIMEOUT_MIN * 60 * 1000);
    const stuck = await prisma.leadRun.findMany({
      where: {
        status: { in: ["planning", "discovering", "researching"] },
        updatedAt: { lt: stuckCutoff },
        id: { notIn: [...processing] },
      },
    });

    for (const run of stuck) {
      console.log(`[worker] Re-queuing stuck run ${run.id} (last updated ${run.updatedAt.toISOString()})`);
      await prisma.leadRun.update({
        where: { id: run.id },
        data: { status: "queued", stage: "Re-queued by worker…" },
      });
    }

  } catch (err) {
    console.error("[worker] tick error:", err);
  }
}

async function main() {
  console.log("[worker] Lead Factory worker started");

  // Run immediately on start, then on interval
  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
