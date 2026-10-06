import { ProbeErrorCategory, ProbeResult } from "@/types";
import { validateSafeUrl } from "./ssrf";

export interface ProbeOptions {
  timeoutMs?: number;
  expectedStatus?: number;
  allowPrivate?: boolean;
  userAgent?: string;
}

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
 * Executes an authentic network probe against the given target URL.
 * Measures high-resolution response duration, enforces SSRF safeguards,
 * and classifies errors into structured categories.
 */
export async function executeProbe(
  monitorId: string,
  targetUrl: string,
  options: ProbeOptions = {}
): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? parseInt(process.env.PROBE_DEFAULT_TIMEOUT_MS || "5000", 10);
  const expectedStatus = options.expectedStatus ?? 200;
  const timestamp = new Date().toISOString();

  // 1. SSRF Safety Verification
  const ssrfCheck = await validateSafeUrl(targetUrl, {
    allowPrivate: options.allowPrivate ?? false,
  });

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

  // 2. High-resolution HTTP/HTTPS Probe
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const startMonotonic = performance.now();

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": options.userAgent ?? "PulseProbe-Beacon/1.0 (+https://pulseprobe.dev)",
        "Accept": "*/*",
      },
    });

    // Read a minimal chunk of body to measure true TTFB / completion
    await response.arrayBuffer();

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
  }
}
