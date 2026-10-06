import { NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getSystemStatus();
    return NextResponse.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
