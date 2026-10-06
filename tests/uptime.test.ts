import { describe, it, expect } from "vitest";
import {
  calculateUptimePercentage,
  aggregateUptimeMetrics,
  PingRecordSample,
} from "../src/lib/probe/uptime";

describe("Uptime Aggregation Engine", () => {
  describe("calculateUptimePercentage", () => {
    it("should return 100% when there are zero pings", () => {
      expect(calculateUptimePercentage(0, 0)).toBe(100.0);
    });

    it("should return 100% when all pings succeed", () => {
      expect(calculateUptimePercentage(50, 50)).toBe(100.0);
    });

    it("should return 0% when all pings fail", () => {
      expect(calculateUptimePercentage(0, 50)).toBe(0.0);
    });

    it("should accurately compute fractional uptime percentages", () => {
      // 99 out of 100 -> 99.00%
      expect(calculateUptimePercentage(99, 100)).toBe(99.0);

      // 999 out of 1000 -> 99.90%
      expect(calculateUptimePercentage(999, 1000)).toBe(99.9);

      // 1 out of 3 -> 33.33%
      expect(calculateUptimePercentage(1, 3)).toBe(33.33);
    });
  });

  describe("aggregateUptimeMetrics", () => {
    it("should aggregate sliding window metrics across 24h, 7d, and 30d", () => {
      const now = new Date("2026-10-06T20:00:00Z");
      const msHour = 60 * 60 * 1000;
      const msDay = 24 * msHour;

      const pings: PingRecordSample[] = [
        // 2 hours ago: healthy
        {
          timestamp: new Date(now.getTime() - 2 * msHour),
          isHealthy: true,
          responseTimeMs: 45,
        },
        // 10 hours ago: failed
        {
          timestamp: new Date(now.getTime() - 10 * msHour),
          isHealthy: false,
          responseTimeMs: 5000,
        },
        // 3 days ago: healthy
        {
          timestamp: new Date(now.getTime() - 3 * msDay),
          isHealthy: true,
          responseTimeMs: 55,
        },
        // 15 days ago: healthy
        {
          timestamp: new Date(now.getTime() - 15 * msDay),
          isHealthy: true,
          responseTimeMs: 60,
        },
        // 45 days ago (outside 30d window): failed
        {
          timestamp: new Date(now.getTime() - 45 * msDay),
          isHealthy: false,
          responseTimeMs: 5000,
        },
      ];

      const metrics = aggregateUptimeMetrics(pings, now);

      // 24h window has 2 pings (1 success, 1 failure) -> 50%
      expect(metrics.totalPings24h).toBe(2);
      expect(metrics.successfulPings24h).toBe(1);
      expect(metrics.uptime24h).toBe(50.0);

      // 7d window has 3 pings (2 success, 1 failure) -> 66.67%
      expect(metrics.uptime7d).toBe(66.67);

      // 30d window has 4 pings (3 success, 1 failure) -> 75.00%
      expect(metrics.uptime30d).toBe(75.0);
    });
  });
});
