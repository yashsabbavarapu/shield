import { NextResponse } from "next/server";
import { writeRoute } from "@/lib/api";
import { runDomainCheck } from "@/lib/core";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => writeRoute(req, async (b) => NextResponse.json(await runDomainCheck(b)));
