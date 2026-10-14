import { NextResponse } from "next/server";
import { writeRoute } from "@/lib/api";
import { addSuppressions, listSuppressions } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ suppressions: await listSuppressions() });
}

export const POST = (req: Request) =>
  writeRoute(req, async (b) => {
    const { batch, created } = await addSuppressions(b);
    return NextResponse.json(batch ? { created } : created[0], { status: 201 });
  });
