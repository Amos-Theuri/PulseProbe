import { NextRequest, NextResponse } from "next/server";
import { getMonitorById } from "@/lib/db/repository";
import { runCheckForMonitor } from "@/lib/scheduler/dispatcher";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const message = error instanceof Error ? error.message : "Probe check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
