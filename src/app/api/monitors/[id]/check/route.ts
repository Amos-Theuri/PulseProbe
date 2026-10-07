import { NextRequest, NextResponse } from "next/server";
import { getMonitorById } from "@/lib/db/repository";
import { runCheckForMonitor } from "@/lib/scheduler/dispatcher";
import { isValidUuid, checkRateLimit, getClientIp, sanitizeErrorMessage } from "@/lib/security/middleware";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const apiKey = process.env.PULSEPROBE_API_KEY;
  if (apiKey) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (token !== apiKey) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
  }

  try {
    const { id } = await params;

    // L-1 FIX: Validate UUID format
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid monitor ID format" }, { status: 400 });
    }

    // Rate limit per IP + monitor: max 5 manual checks per minute
    const ip = getClientIp(req);
    const rateLimited = checkRateLimit(`monitor-check:${ip}:${id}`, {
      maxRequests: 5,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;

    const monitor = await getMonitorById(id);
    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    const probeResult = await runCheckForMonitor(
      monitor.id,
      monitor.url,
      monitor.expectedStatus
    );

    return NextResponse.json({
      success: true,
      result: probeResult,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Probe check failed") },
      { status: 500 }
    );
  }
}
