import { NextResponse } from "next/server";
import { writeRoute } from "@/lib/api";
import { runListCheck } from "@/lib/core";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => writeRoute(req, async (b) => NextResponse.json(await runListCheck(b)));
