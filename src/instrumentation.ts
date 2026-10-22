/**
 * Next.js instrumentation — runs once when the server starts.
 * Starts the Lead Factory background worker in the same process.
 */
export async function register() {
  // Only run in Node.js runtime (not Edge), and only in production or when explicitly enabled
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startWorker } = await import("./lib/lead-factory/worker");
  startWorker();
}
