import { NextResponse } from "next/server";
import { listAudit } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ log: await listAudit() });
}
