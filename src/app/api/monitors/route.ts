import { NextRequest, NextResponse } from "next/server";
import { getMonitors, createMonitor } from "@/lib/db/repository";
import { MonitorCreateSchema } from "@/types";
import { validateSafeUrl } from "@/lib/probe/ssrf";
import { runCheckForMonitor } from "@/lib/scheduler/dispatcher";
import { checkRateLimit, getClientIp, sanitizeErrorMessage } from "@/lib/security/middleware";

export const dynamic = "force-dynamic";

/** Maximum number of monitors allowed */
const MAX_MONITORS = parseInt(process.env.MAX_MONITORS || "50", 10);

export async function GET() {
  try {
    const monitors = await getMonitors();
    return NextResponse.json(monitors);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to fetch monitors") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Auth check
  const apiKey = process.env.PULSEPROBE_API_KEY;
  if (apiKey) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (token !== apiKey) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
  }

  // Rate limit: 10 per minute
  const ip = getClientIp(req);
  const rateLimited = checkRateLimit(`monitors-create:${ip}`, {
    maxRequests: 10,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  try {
    const json = await req.json();
    const parsed = MonitorCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // H-3 FIX: Enforce maximum monitor count
    const existingMonitors = await getMonitors();
    if (existingMonitors.length >= MAX_MONITORS) {
      return NextResponse.json(
        {
          error: `Maximum monitor limit reached (${MAX_MONITORS}). Delete an existing monitor before adding a new one.`,
        },
        { status: 400 }
      );
    }

    // SSRF Check on the target URL
    const ssrfCheck = await validateSafeUrl(parsed.data.url);
    if (!ssrfCheck.safe) {
      return NextResponse.json(
        {
          error: "SSRF Protection Violation",
          message: ssrfCheck.reason,
        },
        { status: 403 }
      );
    }

    const created = await createMonitor(parsed.data);

    // Run an initial immediate probe asynchronously
    runCheckForMonitor(created.id, created.url, created.expectedStatus).catch(
      () => {}
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to create monitor") },
      { status: 500 }
    );
  }
}
