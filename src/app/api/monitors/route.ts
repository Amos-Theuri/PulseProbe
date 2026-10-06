import { NextRequest, NextResponse } from "next/server";
import { getMonitors, createMonitor } from "@/lib/db/repository";
import { MonitorCreateSchema } from "@/types";
import { validateSafeUrl } from "@/lib/probe/ssrf";
import { runCheckForMonitor } from "@/lib/scheduler/dispatcher";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const monitors = await getMonitors();
    return NextResponse.json(monitors);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch monitors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const message = error instanceof Error ? error.message : "Failed to create monitor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
