import { NextRequest, NextResponse } from "next/server";
import { dispatchScheduledChecks } from "@/lib/scheduler/dispatcher";
import { checkRateLimit, getClientIp, sanitizeErrorMessage } from "@/lib/security/middleware";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Auth check: require API key for worker triggers
  const apiKey = process.env.PULSEPROBE_API_KEY;
  if (apiKey) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (token !== apiKey) {
      return NextResponse.json(
        { error: "Authentication required for worker endpoints" },
        { status: 401 }
      );
    }
  }

  // Rate limit: 2 requests per minute
  const ip = getClientIp(req);
  const rateLimited = checkRateLimit(`worker-tick:${ip}`, {
    maxRequests: 2,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  try {
    const summary = await dispatchScheduledChecks();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Worker dispatch failed") },
      { status: 500 }
    );
  }
}

// H-1 FIX: GET export removed — worker tick should only be triggered via POST
