import { NextRequest, NextResponse } from "next/server";
import {
  getMonitorById,
  updateMonitor,
  deleteMonitor,
} from "@/lib/db/repository";
import { MonitorUpdateSchema } from "@/types";
import { validateSafeUrl } from "@/lib/probe/ssrf";
import { isValidUuid, sanitizeErrorMessage } from "@/lib/security/middleware";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // L-1 FIX: Validate UUID format
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid monitor ID format" }, { status: 400 });
    }

    const monitor = await getMonitorById(id);
    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }
    return NextResponse.json(monitor);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid monitor ID format" }, { status: 400 });
    }

    const json = await req.json();
    const parsed = MonitorUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (parsed.data.url) {
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
    }

    const updated = await updateMonitor(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid monitor ID format" }, { status: 400 });
    }

    const deleted = await deleteMonitor(id);
    if (!deleted) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Monitor deleted" });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}
