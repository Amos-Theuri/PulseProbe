import { NextRequest, NextResponse } from "next/server";

/**
 * Simple API key authentication middleware.
 * Checks the Authorization header for a Bearer token matching PULSEPROBE_API_KEY.
 * If PULSEPROBE_API_KEY is not set, auth is bypassed (dev mode).
 */
export function withAuth(
  handler: (req: NextRequest, ctx: unknown) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: unknown): Promise<NextResponse> => {
    const apiKey = process.env.PULSEPROBE_API_KEY;

    // If no API key is configured, allow all requests (dev mode)
    if (!apiKey) {
      return handler(req, ctx);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required. Provide Authorization: Bearer <api-key>" },
        { status: 401 }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token !== apiKey) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 403 }
      );
    }

    return handler(req, ctx);
  };
}

/**
 * Client-side auth check: reads PULSEPROBE_API_KEY from a cookie
 * named "pulseprobe-api-key" and passes it in fetch headers.
 * For the browser dashboard, the key is set via the UI settings.
 */

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
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
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
