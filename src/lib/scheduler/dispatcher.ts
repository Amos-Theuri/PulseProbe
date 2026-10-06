import { getMonitors, recordPingResult } from "../db/repository";
import { executeProbe } from "../probe/engine";
import { eventHub } from "../realtime/event-bus";
import { ProbeResult } from "@/types";

let isRunningBatch = false;

/**
 * Executes a single probe check for a monitor, records results, and emits realtime SSE events.
 */
export async function runCheckForMonitor(
  monitorId: string,
  targetUrl: string,
  expectedStatus: number = 200
): Promise<ProbeResult> {
  const result = await executeProbe(monitorId, targetUrl, {
    expectedStatus,
  });

  await recordPingResult(result);

  // Broadcast realtime ping event to connected browsers
  eventHub.broadcast({
    type: "ping",
    data: result,
    timestamp: new Date().toISOString(),
  });

  return result;
}

/**
 * Dispatches checks across all active monitors respecting the concurrency limit.
 */
export async function dispatchScheduledChecks(): Promise<{
  checkedCount: number;
  results: ProbeResult[];
}> {
  if (isRunningBatch) {
    return { checkedCount: 0, results: [] };
  }

  isRunningBatch = true;
  try {
    const monitors = await getMonitors();
    const activeMonitors = monitors.filter((m) => m.active);

    const concurrencyLimit = parseInt(
      process.env.MONITOR_WORKER_CONCURRENCY || "5",
      10
    );

    const now = Date.now();
    // Only check monitors that are due for a check
    const dueMonitors = activeMonitors.filter((m) => {
      if (!m.lastCheckAt) return true;
      const lastMs = new Date(m.lastCheckAt).getTime();
      return now - lastMs >= m.intervalSeconds * 1000;
    });

    if (dueMonitors.length === 0) {
      return { checkedCount: 0, results: [] };
    }

    const results: ProbeResult[] = [];
    const queue = [...dueMonitors];

    // Concurrency pool execution
    const workers = Array.from({ length: concurrencyLimit }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          const res = await runCheckForMonitor(
            item.id,
            item.url,
            item.expectedStatus
          );
          results.push(res);
        } catch {
          // Continue with next target
        }
      }
    });

    await Promise.all(workers);

    return { checkedCount: results.length, results };
  } finally {
    isRunningBatch = false;
  }
}
