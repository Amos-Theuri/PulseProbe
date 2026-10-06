import { prisma } from "./client";
import {
  MonitorCreateInput,
  MonitorUpdateInput,
  MonitorWithStats,
  ProbeResult,
  IncidentDisplay,
  SystemStatusSummary,
} from "@/types";
import { aggregateUptimeMetrics } from "../probe/uptime";
import crypto from "node:crypto";

// Fallback in-memory store for local testing prior to database migration
interface InternalMonitor {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  expectedStatus: number;
  active: boolean;
  lastCheckAt: Date | null;
  consecutiveFails: number;
  createdAt: Date;
  updatedAt: Date;
}

interface InternalPingLog {
  id: string;
  monitorId: string;
  statusCode: number | null;
  responseTimeMs: number;
  timestamp: Date;
  isHealthy: boolean;
  errorMessage: string | null;
}

interface InternalIncident {
  id: string;
  monitorId: string;
  status: "OPEN" | "ACK" | "RESOLVED";
  startedAt: Date;
  resolvedAt: Date | null;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

declare global {
  // eslint-disable-next-line no-var
  var memoryDb:
    | {
        monitors: Map<string, InternalMonitor>;
        pingLogs: InternalPingLog[];
        incidents: Map<string, InternalIncident>;
        isPrismaWorking: boolean | null;
      }
    | undefined;
}

if (!globalThis.memoryDb) {
  const initialMonitors = new Map<string, InternalMonitor>();
  const initialPingLogs: InternalPingLog[] = [];
  const initialIncidents = new Map<string, InternalIncident>();

  // Seed standard reliable public endpoints as default initial targets
  const m1Id = crypto.randomUUID();
  initialMonitors.set(m1Id, {
    id: m1Id,
    name: "Cloudflare DNS Beacon",
    url: "https://1.1.1.1/cdn-cgi/trace",
    intervalSeconds: 30,
    expectedStatus: 200,
    active: true,
    lastCheckAt: null,
    consecutiveFails: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const m2Id = crypto.randomUUID();
  initialMonitors.set(m2Id, {
    id: m2Id,
    name: "GitHub API Status",
    url: "https://api.github.com/zen",
    intervalSeconds: 60,
    expectedStatus: 200,
    active: true,
    lastCheckAt: null,
    consecutiveFails: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  globalThis.memoryDb = {
    monitors: initialMonitors,
    pingLogs: initialPingLogs,
    incidents: initialIncidents,
    isPrismaWorking: null,
  };
}

const mem = globalThis.memoryDb;

/**
 * Checks if the configured Prisma PostgreSQL database is reachable.
 */
export async function isDatabaseConnected(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    mem.isPrismaWorking = true;
    return true;
  } catch {
    mem.isPrismaWorking = false;
    return false;
  }
}

export async function getMonitors(): Promise<InternalMonitor[]> {
  const hasDb = await isDatabaseConnected();
  if (hasDb) {
    try {
      const records = await prisma.monitor.findMany({
        orderBy: { createdAt: "desc" },
      });
      return records.map((r) => ({
        ...r,
        lastCheckAt: r.lastCheckAt,
      }));
    } catch {
      // Fallback if table not yet migrated
    }
  }
  return Array.from(mem.monitors.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export async function getMonitorById(id: string): Promise<InternalMonitor | null> {
  const hasDb = await isDatabaseConnected();
  if (hasDb) {
    try {
      return await prisma.monitor.findUnique({ where: { id } });
    } catch {
      // Fallback
    }
  }
  return mem.monitors.get(id) ?? null;
}

export async function createMonitor(data: MonitorCreateInput): Promise<InternalMonitor> {
  const hasDb = await isDatabaseConnected();
  const id = crypto.randomUUID();
  const now = new Date();

  if (hasDb) {
    try {
      return await prisma.monitor.create({
        data: {
          id,
          name: data.name,
          url: data.url,
          intervalSeconds: data.intervalSeconds,
          expectedStatus: data.expectedStatus,
          active: data.active,
          consecutiveFails: 0,
        },
      });
    } catch {
      // Fallback
    }
  }

  const newMonitor: InternalMonitor = {
    id,
    name: data.name,
    url: data.url,
    intervalSeconds: data.intervalSeconds,
    expectedStatus: data.expectedStatus,
    active: data.active,
    lastCheckAt: null,
    consecutiveFails: 0,
    createdAt: now,
    updatedAt: now,
  };
  mem.monitors.set(id, newMonitor);
  return newMonitor;
}

export async function updateMonitor(
  id: string,
  data: MonitorUpdateInput
): Promise<InternalMonitor | null> {
  const hasDb = await isDatabaseConnected();
  if (hasDb) {
    try {
      return await prisma.monitor.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
    } catch {
      // Fallback
    }
  }

  const existing = mem.monitors.get(id);
  if (!existing) return null;

  const updated: InternalMonitor = {
    ...existing,
    ...data,
    updatedAt: new Date(),
  };
  mem.monitors.set(id, updated);
  return updated;
}

export async function deleteMonitor(id: string): Promise<boolean> {
  const hasDb = await isDatabaseConnected();
  if (hasDb) {
    try {
      await prisma.monitor.delete({ where: { id } });
      return true;
    } catch {
      // Fallback
    }
  }

  return mem.monitors.delete(id);
}

export async function recordPingResult(result: ProbeResult): Promise<void> {
  const hasDb = await isDatabaseConnected();
  const now = new Date(result.timestamp);
  const failThreshold = parseInt(process.env.INCIDENT_FAIL_THRESHOLD || "3", 10);

  if (hasDb) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Insert Ping Log
        await tx.pingLog.create({
          data: {
            monitorId: result.monitorId,
            statusCode: result.statusCode,
            responseTimeMs: result.responseTimeMs,
            isHealthy: result.isHealthy,
            errorMessage: result.errorMessage,
            timestamp: now,
          },
        });

        // 2. Fetch Monitor
        const monitor = await tx.monitor.findUnique({
          where: { id: result.monitorId },
        });
        if (!monitor) return;

        let consecutiveFails = monitor.consecutiveFails;

        if (result.isHealthy) {
          consecutiveFails = 0;
          // Resolve any open incident
          await tx.incident.updateMany({
            where: { monitorId: result.monitorId, status: "OPEN" },
            data: { status: "RESOLVED", resolvedAt: now },
          });
        } else {
          consecutiveFails += 1;
          // Trigger incident if threshold reached and no open incident exists
          if (consecutiveFails >= failThreshold) {
            const openIncident = await tx.incident.findFirst({
              where: { monitorId: result.monitorId, status: "OPEN" },
            });
            if (!openIncident) {
              await tx.incident.create({
                data: {
                  monitorId: result.monitorId,
                  status: "OPEN",
                  startedAt: now,
                  reason:
                    result.errorMessage ||
                    `Monitor reached ${consecutiveFails} consecutive check failures`,
                },
              });
            }
          }
        }

        // 3. Update Monitor state
        await tx.monitor.update({
          where: { id: result.monitorId },
          data: {
            lastCheckAt: now,
            consecutiveFails,
          },
        });
      });
      return;
    } catch {
      // Fallback to memory
    }
  }

  // In-memory fallback
  const log: InternalPingLog = {
    id: crypto.randomUUID(),
    monitorId: result.monitorId,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    timestamp: now,
    isHealthy: result.isHealthy,
    errorMessage: result.errorMessage,
  };
  mem.pingLogs.push(log);
  // Cap logs in memory to 2000
  if (mem.pingLogs.length > 2000) {
    mem.pingLogs.splice(0, mem.pingLogs.length - 2000);
  }

  const mon = mem.monitors.get(result.monitorId);
  if (mon) {
    mon.lastCheckAt = now;
    if (result.isHealthy) {
      mon.consecutiveFails = 0;
      // Close open incident
      for (const inc of mem.incidents.values()) {
        if (inc.monitorId === result.monitorId && inc.status === "OPEN") {
          inc.status = "RESOLVED";
          inc.resolvedAt = now;
          inc.updatedAt = now;
        }
      }
    } else {
      mon.consecutiveFails += 1;
      if (mon.consecutiveFails >= failThreshold) {
        let hasOpen = false;
        for (const inc of mem.incidents.values()) {
          if (inc.monitorId === result.monitorId && inc.status === "OPEN") {
            hasOpen = true;
            break;
          }
        }
        if (!hasOpen) {
          const incId = crypto.randomUUID();
          mem.incidents.set(incId, {
            id: incId,
            monitorId: result.monitorId,
            status: "OPEN",
            startedAt: now,
            resolvedAt: null,
            reason:
              result.errorMessage ||
              `Monitor reached ${mon.consecutiveFails} consecutive check failures`,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  }
}

export async function getSystemStatus(): Promise<SystemStatusSummary> {
  const hasDb = await isDatabaseConnected();
  const monitors = await getMonitors();
  const monitorStatsList: MonitorWithStats[] = [];

  let totalLatency = 0;
  let latencyCount = 0;
  let healthyCount = 0;
  let failingCount = 0;

  for (const m of monitors) {
    let pings: Array<{
      timestamp: Date;
      isHealthy: boolean;
      responseTimeMs: number;
      statusCode: number | null;
    }> = [];
    let openIncident: IncidentDisplay | null = null;

    if (hasDb) {
      try {
        const dbPings = await prisma.pingLog.findMany({
          where: { monitorId: m.id },
          orderBy: { timestamp: "desc" },
          take: 60,
        });
        pings = dbPings.map((p) => ({
          timestamp: p.timestamp,
          isHealthy: p.isHealthy,
          responseTimeMs: p.responseTimeMs,
          statusCode: p.statusCode,
        }));

        const dbInc = await prisma.incident.findFirst({
          where: { monitorId: m.id, status: "OPEN" },
          orderBy: { startedAt: "desc" },
        });
        if (dbInc) {
          openIncident = {
            id: dbInc.id,
            monitorId: dbInc.monitorId,
            status: dbInc.status as "OPEN" | "ACK" | "RESOLVED",
            startedAt: dbInc.startedAt.toISOString(),
            resolvedAt: dbInc.resolvedAt ? dbInc.resolvedAt.toISOString() : null,
            reason: dbInc.reason,
          };
        }
      } catch {
        // Fallback
      }
    }

    if (pings.length === 0) {
      pings = mem.pingLogs
        .filter((p) => p.monitorId === m.id)
        .slice(-60)
        .reverse();

      for (const inc of mem.incidents.values()) {
        if (inc.monitorId === m.id && inc.status === "OPEN") {
          openIncident = {
            id: inc.id,
            monitorId: inc.monitorId,
            status: inc.status,
            startedAt: inc.startedAt.toISOString(),
            resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
            reason: inc.reason,
          };
          break;
        }
      }
    }

    const latestPing = pings[0];
    const isHealthy = latestPing ? latestPing.isHealthy : true;
    const currentLatencyMs = latestPing ? latestPing.responseTimeMs : null;

    if (latestPing) {
      if (latestPing.isHealthy) healthyCount++;
      else failingCount++;

      totalLatency += latestPing.responseTimeMs;
      latencyCount++;
    } else {
      healthyCount++;
    }

    const uptime = aggregateUptimeMetrics(pings);

    const sparkline = pings
      .slice(0, 30)
      .reverse()
      .map((p) => ({
        timestamp: p.timestamp.toISOString(),
        responseTimeMs: p.responseTimeMs,
        isHealthy: p.isHealthy,
        statusCode: p.statusCode,
      }));

    monitorStatsList.push({
      id: m.id,
      name: m.name,
      url: m.url,
      intervalSeconds: m.intervalSeconds,
      expectedStatus: m.expectedStatus,
      active: m.active,
      lastCheckAt: m.lastCheckAt ? m.lastCheckAt.toISOString() : null,
      consecutiveFails: m.consecutiveFails,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      isHealthy,
      currentLatencyMs,
      uptime,
      sparkline,
      activeIncident: openIncident,
    });
  }

  // Get recent incidents
  const recentIncidents: IncidentDisplay[] = [];
  if (hasDb) {
    try {
      const dbIncs = await prisma.incident.findMany({
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { monitor: { select: { name: true } } },
      });
      for (const i of dbIncs) {
        recentIncidents.push({
          id: i.id,
          monitorId: i.monitorId,
          monitorName: i.monitor.name,
          status: i.status as "OPEN" | "ACK" | "RESOLVED",
          startedAt: i.startedAt.toISOString(),
          resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
          reason: i.reason,
        });
      }
    } catch {
      // Fallback
    }
  }

  if (recentIncidents.length === 0) {
    const list = Array.from(mem.incidents.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 10);
    for (const i of list) {
      const mon = mem.monitors.get(i.monitorId);
      recentIncidents.push({
        id: i.id,
        monitorId: i.monitorId,
        monitorName: mon?.name ?? "Unknown Target",
        status: i.status,
        startedAt: i.startedAt.toISOString(),
        resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
        reason: i.reason,
      });
    }
  }

  let overallStatus: "OPERATIONAL" | "DEGRADED" | "MAJOR_OUTAGE" = "OPERATIONAL";
  if (failingCount > 0) {
    if (failingCount >= Math.ceil(monitors.length / 2)) {
      overallStatus = "MAJOR_OUTAGE";
    } else {
      overallStatus = "DEGRADED";
    }
  }

  const averageLatencyMs =
    latencyCount > 0 ? Number((totalLatency / latencyCount).toFixed(2)) : 0;

  return {
    overallStatus,
    totalMonitors: monitors.length,
    healthyMonitors: healthyCount,
    failingMonitors: failingCount,
    openIncidents: recentIncidents.filter((i) => i.status === "OPEN").length,
    averageLatencyMs,
    monitors: monitorStatsList,
    recentIncidents,
  };
}
