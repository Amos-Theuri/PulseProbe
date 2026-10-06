import { NextRequest, NextResponse } from "next/server";
import {
  getMonitorById,
  updateMonitor,
  deleteMonitor,
} from "@/lib/db/repository";
import { MonitorUpdateSchema } from "@/types";
import { validateSafeUrl } from "@/lib/probe/ssrf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const monitor = await getMonitorById(id);
    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }
    return NextResponse.json(monitor);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteMonitor(id);
    if (!deleted) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Monitor deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
