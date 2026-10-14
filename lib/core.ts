import { checkCopy, checkDomain, checkList, normalizeDomain, isValidEmail, newId } from "./checks";
import { getStore } from "./store";
import type { AuditEntry, Check, SuppressionEntry, SuppressionReason } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export const LIMITS = { subject: 500, body: 200_000, emails: 5000, batch: 1000 } as const;
const REASONS: SuppressionReason[] = ["bounce", "unsub", "complaint"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

async function audit(action: string, summary: string) {
  const entry: AuditEntry = { id: newId("log"), at: new Date().toISOString(), action, summary };
  await getStore().appendAudit(entry);
}

export async function runCopyCheck(input: unknown): Promise<Check> {
  if (!isObj(input) || typeof input.subject !== "string" || typeof input.body !== "string") throw new HttpError(400, "Send {subject: string, body: string}.");
  if (input.subject.length > LIMITS.subject) throw new HttpError(400, `Subject is over ${LIMITS.subject} characters.`);
  if (input.body.length > LIMITS.body) throw new HttpError(400, `Body is over ${LIMITS.body} characters.`);
  if (!input.subject.trim() && !input.body.trim()) throw new HttpError(400, "Subject and body are both empty.");
  const check = checkCopy(input.subject, input.body);
  await audit("check.copy", `Copy check "${check.subject}" scored ${check.score}.`);
  return check;
}

export async function runDomainCheck(input: unknown): Promise<Check> {
  if (!isObj(input) || typeof input.domain !== "string") throw new HttpError(400, "Send {domain: string}.");
  const domain = normalizeDomain(input.domain);
  if (!domain) throw new HttpError(400, `"${input.domain.slice(0, 80)}" is not a valid domain name.`);
  const check = await checkDomain(domain);
  await audit("check.domain", `Domain check ${domain} scored ${check.score}${check.incomplete ? " (incomplete)" : ""}.`);
  return check;
}

export async function runListCheck(input: unknown): Promise<Check> {
  if (!isObj(input) || !Array.isArray(input.emails) || !input.emails.every((e) => typeof e === "string")) throw new HttpError(400, "Send {emails: string[]}.");
  const emails = input.emails as string[];
  if (emails.length === 0) throw new HttpError(400, "The list is empty.");
  if (emails.length > LIMITS.emails) throw new HttpError(400, `The list is over ${LIMITS.emails} addresses.`);
  const supp = new Map((await getStore().listSuppressions()).map((s) => [s.email, s.reason]));
  const check = checkList(emails, supp);
  await audit("check.list", `List check of ${check.subject} scored ${check.score}.`);
  return check;
}

export const listSuppressions = () => getStore().listSuppressions();

/** Single `{email, reason}`, `{entries: [...]}` or a bare array. All-or-nothing; 409 on any duplicate email. */
export async function addSuppressions(input: unknown): Promise<{ batch: boolean; created: SuppressionEntry[] }> {
  const batch = Array.isArray(input) || (isObj(input) && "entries" in input);
  const items: unknown[] = Array.isArray(input) ? input : isObj(input) && Array.isArray(input.entries) ? input.entries : [input];
  if (items.length === 0) throw new HttpError(400, "No entries given.");
  if (items.length > LIMITS.batch) throw new HttpError(400, `A batch is limited to ${LIMITS.batch} entries.`);
  const parsed: { email: string; reason: SuppressionReason }[] = [];
  items.forEach((it, i) => {
    const at = batch ? ` (entry ${i + 1})` : "";
    if (!isObj(it) || typeof it.email !== "string") throw new HttpError(400, `Each entry needs an email string${at}.`);
    const email = it.email.trim().toLowerCase();
    if (!isValidEmail(email)) throw new HttpError(400, `"${it.email.slice(0, 80)}" is not a valid email address${at}.`);
    if (typeof it.reason !== "string" || !REASONS.includes(it.reason as SuppressionReason)) throw new HttpError(400, `reason must be one of ${REASONS.join(", ")}${at}.`);
    parsed.push({ email, reason: it.reason as SuppressionReason });
  });

  const store = getStore();
  const seen = new Set<string>();
  const existing: SuppressionEntry[] = [];
  for (const p of parsed) {
    if (seen.has(p.email)) throw new HttpError(409, `${p.email} appears more than once in the batch.`, { email: p.email });
    seen.add(p.email);
    const found = await store.getSuppressionByEmail(p.email);
    if (found) existing.push(found);
  }
  if (existing.length) throw new HttpError(409, `Already suppressed: ${existing.map((e) => e.email).join(", ")}.`, { existing: batch ? existing : existing[0] });

  const at = new Date().toISOString();
  const created = parsed.map((p) => ({ id: newId("sup"), email: p.email, reason: p.reason, added_at: at }));
  await store.addSuppressions(created);
  await audit("suppression.add", created.length === 1 ? `Suppressed ${created[0]!.email} (${created[0]!.reason}).` : `Suppressed ${created.length} addresses.`);
  return { batch, created };
}

export async function removeSuppression(id: string): Promise<SuppressionEntry> {
  const removed = await getStore().removeSuppression(id);
  if (!removed) throw new HttpError(404, "No suppression entry with that id.");
  await audit("suppression.remove", `Removed ${removed.email} from the suppression list.`);
  return removed;
}

export const listAudit = () => getStore().listAudit();
