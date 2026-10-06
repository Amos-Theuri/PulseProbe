import dns from "node:dns/promises";
import net from "node:net";

export interface SsrfCheckResult {
  safe: boolean;
  reason?: string;
  resolvedIps?: string[];
}

/**
 * Checks if an IPv4 address is in private, loopback, link-local, or reserved ranges.
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => parseInt(part, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed is unsafe
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (Private RFC 1918)
  if (b0 === 10) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata: e.g. 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;

  // 192.168.0.0/16 (Private RFC 1918)
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 (Network benchmark tests)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use)
  if (b0 >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in private, loopback, link-local, or unique-local ranges.
 */
export function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 loopback
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  // :: unspecified
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;

  // IPv4-mapped IPv6 (::ffff:192.168.1.1 or ::ffff:c0a8:0101)
  if (normalized.startsWith("::ffff:") || normalized.startsWith("0:0:0:0:0:ffff:")) {
    const rawIpv4 = normalized.replace(/^.*ffff:/, "");
    if (net.isIPv4(rawIpv4)) {
      return isPrivateIpv4(rawIpv4);
    }
  }

  // fc00::/7 (Unique Local Address) -> fc00 to fdff
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // fe80::/10 (Link-Local) -> fe80 to febf
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  // ff00::/8 (Multicast)
  if (normalized.startsWith("ff")) return true;

  return false;
}

/**
 * Validates a target URL against SSRF attacks by inspecting protocol, hostname,
 * and performing DNS resolution to verify all target IPs.
 */
export async function validateSafeUrl(
  urlStr: string,
  options: { allowPrivate?: boolean } = {}
): Promise<SsrfCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }

  // Protocol check
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      safe: false,
      reason: `Unsupported protocol: ${parsed.protocol}. Only http: and https: are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Forbidden hostnames
  const forbiddenHostnames = [
    "localhost",
    "metadata.google.internal",
    "instance-data",
  ];

  if (
    forbiddenHostnames.includes(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    if (!options.allowPrivate) {
      return {
        safe: false,
        reason: `Target hostname "${hostname}" is a private or internal domain`,
      };
    }
  }

  // If hostname is directly an IP literal
  if (net.isIP(hostname)) {
    const isPrivate =
      net.isIPv4(hostname) ? isPrivateIpv4(hostname) : isPrivateIpv6(hostname);

    if (isPrivate && !options.allowPrivate) {
      return {
        safe: false,
        reason: `Direct IP target "${hostname}" belongs to a private, loopback, or reserved subnet`,
        resolvedIps: [hostname],
      };
    }
    return { safe: true, resolvedIps: [hostname] };
  }

  // Perform DNS resolution to check actual resolved addresses
  try {
    const records = await dns.lookup(hostname, { all: true });
    const resolvedIps = records.map((r) => r.address);

    if (resolvedIps.length === 0) {
      return { safe: false, reason: "Host resolution returned no IP records (ENOTFOUND)" };
    }

    if (!options.allowPrivate) {
      for (const ip of resolvedIps) {
        const isPrivate =
          net.isIPv4(ip) ? isPrivateIpv4(ip) : isPrivateIpv6(ip);

        if (isPrivate) {
          return {
            safe: false,
            reason: `Target host "${hostname}" resolves to private/reserved IP: ${ip}`,
            resolvedIps,
          };
        }
      }
    }

    return { safe: true, resolvedIps };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      safe: false,
      reason: `DNS lookup failed for ${hostname}: ${errorMsg}`,
    };
  }
}
