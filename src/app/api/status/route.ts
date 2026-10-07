import { NextRequest, NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/db/repository";
import { checkRateLimit, getClientIp, sanitizeErrorMessage } from "@/lib/security/middleware";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Public status rate limit: 60 requests per minute per IP
  const ip = getClientIp(req);
  const rateLimited = checkRateLimit(`status-get:${ip}`, {
    maxRequests: 60,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  try {
    const summary = await getSystemStatus();
    return NextResponse.json(summary);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
