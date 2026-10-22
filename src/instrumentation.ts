/**
 * Next.js instrumentation — runs once when the server starts.
 * Starts the Lead Factory background worker in the same process.
 */
export async function register() {
  // Skip Edge runtime — instrumentation.ts runs twice in Next.js (edge + nodejs).
  // Allow both "nodejs" and undefined (Railway may not set NEXT_RUNTIME).
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { startWorker } = await import("./lib/lead-factory/worker");
  startWorker();
}
