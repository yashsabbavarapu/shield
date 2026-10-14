import { NextResponse } from "next/server";
import { AUTH_HEADER, clientIp, rateLimit, secretOk } from "./guard";
import { HttpError } from "./core";

/** Rate limit, then auth, then run the handler. Turns HttpError into a plain JSON error. */
export async function writeRoute(req: Request, run: (body: unknown) => Promise<NextResponse>, opts: { json?: boolean } = { json: true }) {
  try {
    const wait = await rateLimit(clientIp(req.headers));
    if (wait) return NextResponse.json({ error: "Too many requests. Limit is 30 per minute." }, { status: 429, headers: { "Retry-After": String(wait) } });
    if (!secretOk(req.headers.get(AUTH_HEADER))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    let body: unknown = undefined;
    if (opts.json) {
      try {
        body = await req.json();
      } catch {
        throw new HttpError(400, "Body must be valid JSON.");
      }
    }
    return await run(body);
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}
