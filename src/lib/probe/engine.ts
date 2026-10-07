import http from "node:http";
import https from "node:https";
import net from "node:net";
import { ProbeErrorCategory, ProbeResult } from "@/types";
import { validateSafeUrl, isPrivateIp } from "./ssrf";

export interface ProbeOptions {
  timeoutMs?: number;
  expectedStatus?: number;
  allowPrivate?: boolean;
  userAgent?: string;
}

/** Maximum response body bytes to read (1 MB) to prevent OOM from large responses */
const MAX_RESPONSE_BODY_BYTES = 1024 * 1024;

/**
 * Categorizes an error thrown during a probe execution.
 */
export function categorizeError(error: unknown): {
  category: ProbeErrorCategory;
  message: string;
} {
  if (!error) {
    return { category: "UNKNOWN_ERROR", message: "Unknown probe error occurred" };
  }

  const errStr = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const errCode = (error as { code?: string })?.code?.toUpperCase() ?? "";

  if (
    errCode === "ETIMEDOUT" ||
    errStr.includes("timeout") ||
    errStr.includes("timedout") ||
    errStr.includes("timed out") ||
    errStr.includes("etimedout") ||
    errStr.includes("aborted")
  ) {
    return { category: "TIMEOUT", message: "Request timed out" };
  }

  if (
    errCode === "ENOTFOUND" ||
    errCode === "EAI_AGAIN" ||
    errStr.includes("enotfound") ||
    errStr.includes("getaddrinfo")
  ) {
    return { category: "DNS_ERROR", message: "DNS resolution failed (ENOTFOUND)" };
  }

  if (
    errCode.includes("CERT") ||
    errStr.includes("certificate") ||
    errStr.includes("ssl") ||
    errStr.includes("tls") ||
    errStr.includes("unable to verify")
  ) {
    return { category: "SSL_ERROR", message: "SSL/TLS handshake or certificate error" };
  }

  if (errCode === "ECONNREFUSED" || errCode === "ECONNRESET" || errStr.includes("econnrefused")) {
    return { category: "NETWORK_ERROR", message: "Connection refused or reset by host" };
  }

  return { category: "NETWORK_ERROR", message: error instanceof Error ? error.message : String(error) };
}

/**
 * Creates HTTP(S) agent that validates resolved IP at connect-time to
 * prevent DNS rebinding TOCTOU attacks. If the socket connects to a
 * private/reserved IP, the connection is destroyed immediately.
 *
 * This is the second layer of SSRF defense — the first layer is
 * pre-flight DNS resolution in validateSafeUrl().
 */
function createSsrfSafeAgent(
  protocol: "http:" | "https:",
  allowPrivate: boolean
): http.Agent | https.Agent {
  const agentOptions = {
    // Don't keep connections alive across probes
    keepAlive: false,
    maxSockets: 1,
  };

  const AgentClass = protocol === "https:" ? https.Agent : http.Agent;
  const agent = new AgentClass(agentOptions);

  // Intercept socket creation to re-validate the resolved IP
  const origCreateConnection = agent.createConnection.bind(agent);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent.createConnection = function (options: any, callback: any) {
    const socket = origCreateConnection(options, callback) as net.Socket;

    socket.once("connect", () => {
      const remoteAddress = socket.remoteAddress;
      if (remoteAddress && !allowPrivate && isPrivateIp(remoteAddress)) {
        socket.destroy(
          new Error(
            `SSRF: DNS rebinding detected — socket connected to private IP ${remoteAddress}`
          )
        );
      }
    });

    // For TLS sockets, also check on 'secureConnect'
    socket.once("secureConnect", () => {
      const remoteAddress = socket.remoteAddress;
      if (remoteAddress && !allowPrivate && isPrivateIp(remoteAddress)) {
        socket.destroy(
          new Error(
            `SSRF: DNS rebinding detected — TLS connected to private IP ${remoteAddress}`
          )
        );
      }
    });

    return socket;
  };

  return agent;
}

/**
 * Reads a limited number of bytes from a Response body to prevent OOM
 * from very large responses. Returns after reading the first chunk or
 * MAX_RESPONSE_BODY_BYTES, whichever is smaller.
 */
async function readLimitedBody(response: Response): Promise<void> {
  if (!response.body) return;

  const reader = response.body.getReader();
  let bytesRead = 0;

  try {
    while (bytesRead < MAX_RESPONSE_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/**
 * Executes an authentic network probe against the given target URL.
 * Measures high-resolution response duration, enforces SSRF safeguards
 * at both DNS-resolution time AND connect time (preventing DNS rebinding),
 * and classifies errors into structured categories.
 */
export async function executeProbe(
  monitorId: string,
  targetUrl: string,
  options: ProbeOptions = {}
): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? parseInt(process.env.PROBE_DEFAULT_TIMEOUT_MS || "5000", 10);
  const expectedStatus = options.expectedStatus ?? 200;
  const allowPrivate = options.allowPrivate ?? false;
  const timestamp = new Date().toISOString();

  // 1. SSRF Layer 1: Pre-flight DNS resolution and validation
  const ssrfCheck = await validateSafeUrl(targetUrl, { allowPrivate });

  if (!ssrfCheck.safe) {
    return {
      monitorId,
      statusCode: null,
      responseTimeMs: 0,
      isHealthy: false,
      errorMessage: `Blocked by SSRF protection: ${ssrfCheck.reason}`,
      errorCategory: "SSRF_FORBIDDEN",
      timestamp,
    };
  }

  // 2. Build URL for the probe — use the pinned IP from DNS resolution
  //    to eliminate the TOCTOU window. Set Host header to original hostname.
  const parsedUrl = new URL(targetUrl);
  const pinnedIp = ssrfCheck.resolvedIps?.[0];
  let probeUrl = targetUrl;
  const headers: Record<string, string> = {
    "User-Agent": options.userAgent ?? "PulseProbe-Beacon/1.0 (+https://pulseprobe.dev)",
    "Accept": "*/*",
  };

  // If we resolved a hostname (not a direct IP literal), pin the fetch to the resolved IP
  if (pinnedIp && !net.isIP(parsedUrl.hostname)) {
    // Replace hostname with the resolved IP in the URL
    const pinnedUrl = new URL(targetUrl);
    pinnedUrl.hostname = net.isIPv6(pinnedIp) ? `[${pinnedIp}]` : pinnedIp;
    probeUrl = pinnedUrl.toString();
    // Set the Host header to the original hostname for proper TLS SNI & virtual hosting
    headers["Host"] = parsedUrl.host;
  }

  // 3. SSRF Layer 2: Connect-time IP validation via custom agent
  //    This catches any DNS rebinding that might slip through
  const agent = createSsrfSafeAgent(
    parsedUrl.protocol as "http:" | "https:",
    allowPrivate
  );

  // 4. High-resolution HTTP/HTTPS Probe
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const startMonotonic = performance.now();

  try {
    const response = await fetch(probeUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers,
      // @ts-expect-error Node.js fetch supports dispatcher/agent option
      agent,
    });

    // Read limited body to measure true completion, prevent OOM
    await readLimitedBody(response);

    const endMonotonic = performance.now();
    const durationMs = Number((endMonotonic - startMonotonic).toFixed(2));

    const isHealthy = response.status === expectedStatus;
    const errorMessage = isHealthy
      ? null
      : `Expected status ${expectedStatus}, received ${response.status}`;

    return {
      monitorId,
      statusCode: response.status,
      responseTimeMs: durationMs,
      isHealthy,
      errorMessage,
      errorCategory: isHealthy ? null : "HTTP_ERROR",
      timestamp,
    };
  } catch (error: unknown) {
    const endMonotonic = performance.now();
    const durationMs = Number((endMonotonic - startMonotonic).toFixed(2));
    const { category, message } = categorizeError(error);

    // Reclassify DNS rebinding detection as SSRF
    const errMsg = error instanceof Error ? error.message : "";
    if (errMsg.includes("SSRF: DNS rebinding")) {
      return {
        monitorId,
        statusCode: null,
        responseTimeMs: durationMs,
        isHealthy: false,
        errorMessage: errMsg,
        errorCategory: "SSRF_FORBIDDEN",
        timestamp,
      };
    }

    return {
      monitorId,
      statusCode: null,
      responseTimeMs: durationMs,
      isHealthy: false,
      errorMessage: message,
      errorCategory: category,
      timestamp,
    };
  } finally {
    clearTimeout(timer);
    agent.destroy();
  }
}
