import { NextRequest, NextResponse } from "next/server";

/**
 * Validates request authorization.
 * Supports:
 * 1. Authorization: Bearer <key>
 * 2. x-api-key: <key>
 * 3. Cookie: pulseprobe-api-key=<key>
 * If PULSEPROBE_API_KEY is not set on the server, auth is bypassed (dev mode).
 */
export function isAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.PULSEPROBE_API_KEY;
  if (!apiKey) {
    return true; // dev mode / auth not configured
  }

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  const customHeader = req.headers.get("x-api-key")?.trim();
  const cookieToken = req.cookies.get("pulseprobe-api-key")?.value?.trim();

  return (
    bearerToken === apiKey ||
    customHeader === apiKey ||
    cookieToken === apiKey
  );
}

/**
 * Simple API key authentication middleware wrapper.
 */
export function withAuth(
  handler: (req: NextRequest, ctx: unknown) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: unknown): Promise<NextResponse> => {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { error: "Authentication required. Provide valid API key via Authorization header, x-api-key, or cookie." },
        { status: 401 }
      );
    }
    return handler(req, ctx);
  };
}

/**
 * Validates a UUID v4 format string.
 */
export function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Simple in-memory rate limiter using a sliding window.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean stale entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/**
 * Checks rate limit for a given key (e.g., IP + route).
 * Returns null if allowed, or a NextResponse with 429 if exceeded.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): NextResponse | null {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return null;
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  return null;
}

/**
 * Extracts client IP from the request for rate limiting.
 * Prioritizes edge platform headers (Cloudflare, Vercel) to mitigate header spoofing.
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Sanitizes error messages for production responses.
 * In production, returns a generic message. In dev, returns the actual error.
 */
export function sanitizeErrorMessage(
  error: unknown,
  fallback: string = "Internal Server Error"
): string {
  if (process.env.NODE_ENV === "development") {
    return error instanceof Error ? error.message : String(error);
  }
  return fallback;
}
