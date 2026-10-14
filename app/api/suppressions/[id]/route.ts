import { NextResponse } from "next/server";
import { writeRoute } from "@/lib/api";
import { removeSuppression } from "@/lib/core";

export const dynamic = "force-dynamic";

export const DELETE = (req: Request, { params }: { params: { id: string } }) =>
  writeRoute(req, async () => NextResponse.json(await removeSuppression(params.id)), { json: false });
