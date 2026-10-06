import { z } from "zod";

// Error categorization for network probes
export type ProbeErrorCategory =
  | "SSRF_FORBIDDEN"
  | "DNS_ERROR"
  | "TIMEOUT"
  | "SSL_ERROR"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

// Monitor validation schemas
export const MonitorCreateSchema = z.object({
  name: z.string().trim().min(2, "Monitor name must be at least 2 characters").max(100),
  url: z
    .string()
    .trim()
    .url("Must be a valid URL with http:// or https://")
    .refine(
      (val) => val.startsWith("http://") || val.startsWith("https://"),
      "Only HTTP and HTTPS protocols are currently supported"
    ),
  intervalSeconds: z
    .number()
    .int()
    .min(5, "Interval must be at least 5 seconds")
    .max(86400, "Interval must not exceed 24 hours")
    .default(60),
  expectedStatus: z
    .number()
    .int()
    .min(100)
    .max(599)
    .default(200),
  active: z.boolean().default(true),
});

export const MonitorUpdateSchema = MonitorCreateSchema.partial();

export type MonitorCreateInput = z.infer<typeof MonitorCreateSchema>;
export type MonitorUpdateInput = z.infer<typeof MonitorUpdateSchema>;

// Probe result interface
export interface ProbeResult {
  monitorId: string;
  statusCode: number | null;
  responseTimeMs: number;
  isHealthy: boolean;
  errorMessage: string | null;
  errorCategory: ProbeErrorCategory | null;
  timestamp: string; // ISO string
}

// Sparkline point
export interface SparklinePoint {
  timestamp: string;
  responseTimeMs: number;
  isHealthy: boolean;
  statusCode: number | null;
}

// Uptime metrics
export interface UptimeMetrics {
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  totalPings24h: number;
  successfulPings24h: number;
}

// Monitor with aggregated statistics for dashboard
export interface MonitorWithStats {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  expectedStatus: number;
  active: boolean;
  lastCheckAt: string | null;
  consecutiveFails: number;
  createdAt: string;
  updatedAt: string;
  isHealthy: boolean;
  currentLatencyMs: number | null;
  uptime: UptimeMetrics;
  sparkline: SparklinePoint[];
  activeIncident: IncidentDisplay | null;
}

export interface IncidentDisplay {
  id: string;
  monitorId: string;
  monitorName?: string;
  status: "OPEN" | "ACK" | "RESOLVED";
  startedAt: string;
  resolvedAt: string | null;
  reason: string;
}

export interface SystemStatusSummary {
  overallStatus: "OPERATIONAL" | "DEGRADED" | "MAJOR_OUTAGE";
  totalMonitors: number;
  healthyMonitors: number;
  failingMonitors: number;
  openIncidents: number;
  averageLatencyMs: number;
  monitors: MonitorWithStats[];
  recentIncidents: IncidentDisplay[];
}
