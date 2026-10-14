import { NextResponse } from "next/server";
import { writeRoute } from "@/lib/api";
import { runCopyCheck } from "@/lib/core";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => writeRoute(req, async (b) => NextResponse.json(await runCopyCheck(b)));
