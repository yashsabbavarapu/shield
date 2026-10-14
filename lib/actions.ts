"use server";
// Server actions are the UI's write path: they run on the server, so SHIELD_API_SECRET never reaches the client.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { clientIp, rateLimit } from "./guard";
import { HttpError, addSuppressions, removeSuppression, runCopyCheck, runDomainCheck, runListCheck } from "./core";
import type { Check, SuppressionEntry } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>, path?: string): Promise<Result<T>> {
  try {
    const wait = await rateLimit(clientIp(headers()));
    if (wait) return { ok: false, error: `Too many requests. Try again in ${wait}s.` };
    const data = await fn();
    if (path) revalidatePath(path);
    revalidatePath("/log");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Internal error." };
  }
}

export const copyAction = (subject: string, body: string): Promise<Result<Check>> => run(() => runCopyCheck({ subject, body }));
export const domainAction = (domain: string): Promise<Result<Check>> => run(() => runDomainCheck({ domain }));
export const listAction = (emails: string[]): Promise<Result<Check>> => run(() => runListCheck({ emails }));
export const addSuppressionAction = (email: string, reason: string): Promise<Result<SuppressionEntry>> =>
  run(async () => (await addSuppressions({ email, reason })).created[0]!, "/suppressions");
export const removeSuppressionAction = (id: string): Promise<Result<SuppressionEntry>> => run(() => removeSuppression(id), "/suppressions");
