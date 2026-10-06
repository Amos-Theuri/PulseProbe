import { UptimeMetrics } from "@/types";

/**
 * Calculates uptime percentage according to the formula:
 * Uptime % = (Successful Pings / Total Pings) * 100
 *
 * Returns a number rounded to 2 decimal places (e.g. 99.95).
 * If total pings is 0, defaults to 100.00% if no downtime is recorded.
 */
export function calculateUptimePercentage(
  successfulPings: number,
  totalPings: number
): number {
  if (totalPings <= 0) {
    return 100.0;
  }
  const ratio = (successfulPings / totalPings) * 100;
  // Clamp between 0 and 100
  const clamped = Math.max(0, Math.min(100, ratio));
  return Number(clamped.toFixed(2));
}

export interface PingRecordSample {
  timestamp: Date | string;
  isHealthy: boolean;
  responseTimeMs: number;
}

/**
 * Computes uptime for 24h, 7d, and 30d sliding windows given ping log history.
 */
export function aggregateUptimeMetrics(
  pings: PingRecordSample[],
  referenceNow: Date = new Date()
): UptimeMetrics {
  const nowMs = referenceNow.getTime();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * ms24h;
  const ms30d = 30 * ms24h;

  let total24h = 0;
  let success24h = 0;
  let total7d = 0;
  let success7d = 0;
  let total30d = 0;
  let success30d = 0;

  for (const ping of pings) {
    const pingTime =
      typeof ping.timestamp === "string"
        ? new Date(ping.timestamp).getTime()
        : ping.timestamp.getTime();
    const age = nowMs - pingTime;

    if (age <= ms30d) {
      total30d++;
      if (ping.isHealthy) success30d++;

      if (age <= ms7d) {
        total7d++;
        if (ping.isHealthy) success7d++;

        if (age <= ms24h) {
          total24h++;
          if (ping.isHealthy) success24h++;
        }
      }
    }
  }

  return {
    uptime24h: calculateUptimePercentage(success24h, total24h),
    uptime7d: calculateUptimePercentage(success7d, total7d),
    uptime30d: calculateUptimePercentage(success30d, total30d),
    totalPings24h: total24h,
    successfulPings24h: success24h,
  };
}
