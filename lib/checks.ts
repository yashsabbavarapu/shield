import type { Check, Finding, ListRow, Status, SuppressionReason } from "./types";

/** Documented deduction weights. Score = 100 minus the deductions of every finding. */
export const WEIGHTS = {
  copy: {
    spamPhrases: { perPhrase: 6, cap: 30, failAt: 3 },
    subjectEmpty: 15,
    subjectLong: 5,
    linkRatioWarn: 8,
    linkRatioFail: 15,
    capsWarn: 5,
    capsFail: 12,
    noUnsubscribe: 15,
    imageOnly: 20,
  },
  domain: {
    spfMissing: 30,
    spfMultiple: 15,
    spfOpen: 20,
    spfNeutral: 8,
    spfNoAll: 5,
    spfLookups: 5,
    dmarcMissing: 25,
    dmarcNone: 10,
    dmarcInvalid: 15,
    mxMissing: 30,
  },
  list: {
    // deduction = min(cap, round(share of rows affected in percent * factor))
    suppressed: { factor: 2, cap: 40 },
    invalid: { factor: 2, cap: 30 },
    role: { factor: 0.5, cap: 15 },
    duplicate: { factor: 0.5, cap: 10 },
  },
} as const;

export const THRESHOLDS = { subjectMax: 60, capsWarn: 0.1, capsFail: 0.25, linksPer100Warn: 5, linksPer100Fail: 10, minLinks: 3 };

export function score(findings: Finding[]): number {
  return Math.max(0, Math.min(100, 100 - findings.reduce((s, f) => s + f.deduction, 0)));
}

export function verdict(s: number): "Ready to send" | "Fix before sending" | "Do not send" {
  return s >= 80 ? "Ready to send" : s >= 60 ? "Fix before sending" : "Do not send";
}

const finding = (check: string, status: Status, detail: string, deduction = 0, extra: Partial<Finding> = {}): Finding => ({
  check,
  status,
  detail,
  deduction: status === "pass" ? 0 : deduction,
  ...extra,
});

// ---------------------------------------------------------------- copy

export const SPAM_PHRASES = [
  "act now", "act immediately", "limited time", "click here", "buy now", "order now", "apply now", "call now",
  "100% free", "free gift", "free money", "risk free", "no obligation", "no cost", "no strings attached",
  "you have been selected", "congratulations", "winner", "cash bonus", "fast cash", "make money", "earn extra cash",
  "extra income", "double your", "once in a lifetime", "urgent", "guaranteed", "satisfaction guaranteed",
  "no credit check", "lowest price", "special promotion", "exclusive deal", "this isn't spam", "dear friend",
  "increase sales", "work from home", "be your own boss", "what are you waiting for", "don't delete",
  "instant access", "miracle", "while supplies last", "save big", "while you sleep",
] as const;

const normalizeQuotes = (s: string) => s.replace(/[‘’]/g, "'");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function stripHtml(html: string): string {
  return html
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function findSpamPhrases(text: string): string[] {
  const t = normalizeQuotes(text).toLowerCase();
  return SPAM_PHRASES.filter((p) => new RegExp(`(^|[^a-z0-9])${escapeRe(p)}($|[^a-z0-9])`).test(t));
}

export function countLinks(rawBody: string): number {
  const anchors = (rawBody.match(/<a\s[^>]*href/gi) ?? []).length;
  const withoutAnchors = rawBody.replace(/<a\s[^>]*>[\s\S]*?<\/a>/gi, " ");
  const bare = (stripHtml(withoutAnchors).match(/https?:\/\/[^\s"'<>)]+/gi) ?? []).length;
  return anchors + bare;
}

export function wordCount(text: string): number {
  return (text.match(/[A-Za-z0-9'’]+/g) ?? []).length;
}

/** Share of words of 3+ letters that are written entirely in capitals. */
export function capsRatio(text: string): { ratio: number; caps: number; total: number } {
  const words = text.replace(/https?:\/\/\S+/gi, " ").match(/[A-Za-z]{3,}/g) ?? [];
  const caps = words.filter((w) => w === w.toUpperCase()).length;
  return { ratio: words.length ? caps / words.length : 0, caps, total: words.length };
}

const UNSUB_RE = /unsubscrib|opt[\s-]?out|stop receiving|manage (your )?(email )?(preferences|subscriptions?)|email preferences/i;

export function checkCopy(subject: string, body: string): Check {
  const w = WEIGHTS.copy;
  const findings: Finding[] = [];
  const visible = stripHtml(body);
  const all = `${subject}\n${visible}`;

  const phrases = findSpamPhrases(all);
  if (phrases.length === 0) findings.push(finding("Spam-trigger phrases", "pass", "None of the 44 listed trigger phrases appear."));
  else {
    const d = Math.min(w.spamPhrases.cap, phrases.length * w.spamPhrases.perPhrase);
    findings.push(
      finding(
        "Spam-trigger phrases",
        phrases.length >= w.spamPhrases.failAt ? "fail" : "warn",
        `${phrases.length} trigger phrase${phrases.length === 1 ? "" : "s"} found, ${w.spamPhrases.perPhrase} points each (max ${w.spamPhrases.cap}).`,
        d,
        { records: phrases },
      ),
    );
  }

  const len = subject.trim().length;
  if (len === 0) findings.push(finding("Subject length", "fail", "The subject is empty.", w.subjectEmpty));
  else if (len > THRESHOLDS.subjectMax)
    findings.push(finding("Subject length", "warn", `${len} characters. Subjects over ${THRESHOLDS.subjectMax} are cut off in most inboxes.`, w.subjectLong));
  else findings.push(finding("Subject length", "pass", `${len} characters, within the ${THRESHOLDS.subjectMax} limit.`));

  const links = countLinks(body);
  const words = wordCount(visible);
  const per100 = words ? (links / words) * 100 : links ? Infinity : 0;
  const per100Label = Number.isFinite(per100) ? per100.toFixed(1) : "no text";
  if (links >= THRESHOLDS.minLinks && per100 > THRESHOLDS.linksPer100Fail)
    findings.push(finding("Link to text ratio", "fail", `${links} links in ${words} words (${per100Label} per 100 words, limit ${THRESHOLDS.linksPer100Fail}).`, w.linkRatioFail));
  else if (links >= THRESHOLDS.minLinks && per100 > THRESHOLDS.linksPer100Warn)
    findings.push(finding("Link to text ratio", "warn", `${links} links in ${words} words (${per100Label} per 100 words, warn above ${THRESHOLDS.linksPer100Warn}).`, w.linkRatioWarn));
  else findings.push(finding("Link to text ratio", "pass", `${links} link${links === 1 ? "" : "s"} in ${words} words.`));

  const caps = capsRatio(all);
  const pct = (caps.ratio * 100).toFixed(0);
  if (caps.total >= 5 && caps.ratio > THRESHOLDS.capsFail)
    findings.push(finding("ALL-CAPS ratio", "fail", `${caps.caps} of ${caps.total} words are all capitals (${pct}%, limit ${THRESHOLDS.capsFail * 100}%).`, w.capsFail));
  else if (caps.total >= 5 && caps.ratio > THRESHOLDS.capsWarn)
    findings.push(finding("ALL-CAPS ratio", "warn", `${caps.caps} of ${caps.total} words are all capitals (${pct}%, warn above ${THRESHOLDS.capsWarn * 100}%).`, w.capsWarn));
  else findings.push(finding("ALL-CAPS ratio", "pass", `${caps.caps} of ${caps.total} words are all capitals (${pct}%).`));

  if (UNSUB_RE.test(visible) || /href=["'][^"']*unsubscribe/i.test(body)) findings.push(finding("Unsubscribe mention", "pass", "The body mentions unsubscribing or managing preferences."));
  else findings.push(finding("Unsubscribe mention", "fail", "No unsubscribe or opt-out wording found. Bulk senders need a visible way to opt out.", w.noUnsubscribe));

  const hasImg = /<img\b/i.test(body);
  if (hasImg && words < 10) findings.push(finding("Image-only HTML", "fail", `The HTML has images and only ${words} words of text. Image-only mail is filtered hard and unreadable with images off.`, w.imageOnly));
  else findings.push(finding("Image-only HTML", "pass", hasImg ? `Images are accompanied by ${words} words of text.` : "No images in the body."));

  return {
    id: newId("chk"),
    at: new Date().toISOString(),
    kind: "copy",
    subject: subject.trim().slice(0, 80) || "(no subject)",
    score: score(findings),
    findings,
  };
}

// ---------------------------------------------------------------- domain

export type Lookup = { ok: true; records: string[] } | { ok: false; error: string };
export interface Lookups { txt: Lookup; dmarc: Lookup; mx: Lookup }
export type Resolver = (name: string, type: "TXT" | "MX") => Promise<Lookup>;

const DOH = "https://cloudflare-dns.com/dns-query";
const TYPE_NUM = { TXT: 16, MX: 15 } as const;

export function parseTxtData(data: string): string {
  const chunks = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? "").replace(/\\(.)/g, "$1"));
  return chunks.length ? chunks.join("") : data;
}

export const dohResolver: Resolver = async (name, type) => {
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `resolver returned HTTP ${res.status}` };
    const j = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] };
    if (j.Status === 3) return { ok: true, records: [] };
    if (j.Status !== 0) return { ok: false, error: `resolver returned DNS status ${j.Status}` };
    const records = (j.Answer ?? []).filter((a) => a.type === TYPE_NUM[type]).map((a) => (type === "TXT" ? parseTxtData(a.data) : a.data));
    return { ok: true, records };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.name === "TimeoutError" ? "timed out after 8s" : err.message || "unreachable" };
  }
};

export function normalizeDomain(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : null;
}

const unknown = (check: string, why: string) => finding(check, "warn", `Unknown: the lookup failed (${why}). Nothing deducted.`, 0, { unknown: true });

export function evaluateDomain(lookups: Lookups): Finding[] {
  const w = WEIGHTS.domain;
  const findings: Finding[] = [];

  // SPF
  if (!lookups.txt.ok) findings.push(unknown("SPF record", lookups.txt.error));
  else {
    const spf = lookups.txt.records.filter((r) => /^v=spf1(\s|$)/i.test(r.trim()));
    if (spf.length === 0) findings.push(finding("SPF record", "fail", "No SPF record found. Receivers cannot tell which servers may send for this domain.", w.spfMissing));
    else if (spf.length > 1) findings.push(finding("SPF record", "fail", `${spf.length} SPF records found. Only one is allowed, so receivers treat this as a permanent error.`, w.spfMultiple, { records: spf }));
    else {
      const rec = spf[0] ?? "";
      const all = rec.match(/(?:^|\s)([+\-~?]?)all(?:\s|$)/i);
      const lookupsUsed = (rec.match(/(?:^|\s)[+\-~?]?(include:|a(?::|\/|\s|$)|mx(?::|\/|\s|$)|ptr|exists:)|redirect=/gi) ?? []).length;
      if (!all) findings.push(finding("SPF record", "warn", "SPF is present but has no `all` mechanism, so unlisted senders are not told how to be treated.", w.spfNoAll, { records: [rec] }));
      else if (all[1] === "" || all[1] === "+") findings.push(finding("SPF record", "fail", "SPF ends in `+all`, which authorizes every server on the internet.", w.spfOpen, { records: [rec] }));
      else if (all[1] === "?") findings.push(finding("SPF record", "warn", "SPF ends in `?all` (neutral), which gives receivers no instruction. Use `~all` or `-all`.", w.spfNeutral, { records: [rec] }));
      else if (lookupsUsed > 10) findings.push(finding("SPF record", "warn", `SPF has ${lookupsUsed} lookup-causing terms at the top level. The limit is 10 DNS lookups, includes count too.`, w.spfLookups, { records: [rec] }));
      else findings.push(finding("SPF record", "pass", `SPF present, ends in \`${all[1]}all\`.`, 0, { records: [rec] }));
    }
  }

  // DMARC
  if (!lookups.dmarc.ok) findings.push(unknown("DMARC record", lookups.dmarc.error));
  else {
    const dm = lookups.dmarc.records.filter((r) => /^v=DMARC1\b/i.test(r.trim()));
    if (dm.length === 0) findings.push(finding("DMARC record", "fail", "No DMARC record at _dmarc. Gmail and Yahoo require one for bulk senders.", w.dmarcMissing));
    else {
      const rec = dm[0] ?? "";
      const p = rec.match(/(?:^|;)\s*p\s*=\s*([a-z]+)/i)?.[1]?.toLowerCase();
      if (p === "reject" || p === "quarantine") findings.push(finding("DMARC policy", "pass", `DMARC present with policy p=${p}.`, 0, { records: [rec] }));
      else if (p === "none") findings.push(finding("DMARC policy", "warn", "DMARC present with p=none. It reports but does not protect against spoofing.", w.dmarcNone, { records: [rec] }));
      else findings.push(finding("DMARC policy", "fail", "DMARC record has no valid p= tag (expected none, quarantine or reject).", w.dmarcInvalid, { records: [rec] }));
    }
  }

  // MX
  if (!lookups.mx.ok) findings.push(unknown("MX records", lookups.mx.error));
  else {
    const mx = lookups.mx.records;
    const nullMx = mx.length === 1 && /^\d+\s+\.?$/.test((mx[0] ?? "").trim());
    if (mx.length === 0) findings.push(finding("MX records", "fail", "No MX records. The domain cannot receive replies or bounces.", w.mxMissing));
    else if (nullMx) findings.push(finding("MX records", "fail", "Null MX (`0 .`): the domain declares that it accepts no mail.", w.mxMissing, { records: mx }));
    else findings.push(finding("MX records", "pass", `${mx.length} MX record${mx.length === 1 ? "" : "s"} found.`, 0, { records: mx }));
  }

  return findings;
}

export async function checkDomain(domain: string, resolve: Resolver = dohResolver): Promise<Check> {
  const [txt, dmarc, mx] = await Promise.all([resolve(domain, "TXT"), resolve(`_dmarc.${domain}`, "TXT"), resolve(domain, "MX")]);
  const findings = evaluateDomain({ txt, dmarc, mx });
  return {
    id: newId("chk"),
    at: new Date().toISOString(),
    kind: "domain",
    subject: domain,
    score: score(findings),
    findings,
    incomplete: findings.some((f) => f.unknown) || undefined,
  };
}

// ---------------------------------------------------------------- list

export const ROLE_LOCALS = new Set([
  "info", "support", "admin", "administrator", "sales", "contact", "hello", "help", "office", "billing", "accounts", "accounting",
  "abuse", "postmaster", "webmaster", "hostmaster", "noreply", "no-reply", "donotreply", "do-not-reply", "marketing", "team",
  "jobs", "careers", "hr", "press", "media", "legal", "privacy", "security", "feedback", "enquiries", "inquiries", "mail", "service",
]);

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  const [local = ""] = email.split("@");
  return email.length <= 254 && local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") && EMAIL_RE.test(email);
}

export const isRoleAddress = (email: string) => ROLE_LOCALS.has((email.split("@")[0] ?? "").split("+")[0] ?? "");

export function analyzeList(emails: string[], suppressed: Map<string, SuppressionReason>): ListRow[] {
  const seen = new Set<string>();
  return emails.map((raw) => {
    const email = raw.trim().toLowerCase();
    const valid = isValidEmail(email);
    const duplicate = seen.has(email);
    seen.add(email);
    return { email, valid, role: valid && isRoleAddress(email), duplicate, suppressed: suppressed.get(email) ?? null };
  });
}

export function checkList(emails: string[], suppressed: Map<string, SuppressionReason>): Check {
  const w = WEIGHTS.list;
  const rows = analyzeList(emails, suppressed);
  const n = rows.length;
  const findings: Finding[] = [];
  const add = (check: string, hits: ListRow[], rule: { factor: number; cap: number }, status: Status, what: string, why: string) => {
    if (hits.length === 0) return findings.push(finding(check, "pass", `No ${what}.`));
    const share = (hits.length / n) * 100;
    const d = Math.min(rule.cap, Math.round(share * rule.factor));
    findings.push(
      finding(check, status, `${hits.length} of ${n} (${share.toFixed(1)}%) ${what}. ${why} Deduction: share x ${rule.factor}, max ${rule.cap}.`, d, {
        records: hits.slice(0, 10).map((r) => r.email).concat(hits.length > 10 ? [`and ${hits.length - 10} more`] : []),
      }),
    );
  };
  add("Suppressed addresses", rows.filter((r) => r.suppressed), w.suppressed, "fail", "addresses are on the suppression list", "Sending to them harms reputation and may breach opt-outs.");
  add("Invalid format", rows.filter((r) => !r.valid), w.invalid, "fail", "addresses are not valid email format", "They will bounce.");
  add("Role addresses", rows.filter((r) => r.role), w.role, "warn", "are role addresses (info@, support@ and similar)", "They reach shared inboxes and complain more often.");
  add("Duplicates", rows.filter((r) => r.duplicate), w.duplicate, "warn", "are repeats of an earlier row", "Recipients would get the same send twice.");
  return {
    id: newId("chk"),
    at: new Date().toISOString(),
    kind: "list",
    subject: `${n} address${n === 1 ? "" : "es"}`,
    score: score(findings),
    findings,
    rows,
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
