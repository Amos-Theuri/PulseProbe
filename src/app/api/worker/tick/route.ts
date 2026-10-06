import { NextResponse } from "next/server";
import { dispatchScheduledChecks } from "@/lib/scheduler/dispatcher";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const summary = await dispatchScheduledChecks();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Worker dispatch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
