import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCopy, evaluateDomain, checkList, findSpamPhrases, countLinks, capsRatio, parseTxtData, normalizeDomain, isValidEmail, isRoleAddress, score, SPAM_PHRASES } from "../lib/checks";
import { extractEmails } from "../lib/csv";

const status = (c: ReturnType<typeof checkCopy>, name: string) => c.findings.find((f) => f.check === name)!;
const CLEAN_BODY = "Hi Sam, I read your post on onboarding emails and had one question about how your team measures activation. Could we compare notes for fifteen minutes next week? Unsubscribe any time: https://example.com/unsubscribe";

test("spam list has about 40 entries", () => assert.ok(SPAM_PHRASES.length >= 40 && SPAM_PHRASES.length <= 50));
test("clean copy scores 100", () => {
  const c = checkCopy("Question about onboarding", CLEAN_BODY);
  assert.equal(c.score, 100);
  assert.ok(c.findings.every((f) => f.status === "pass"));
});
test("spammy copy fails with reasons", () => {
  const c = checkCopy("ACT NOW!!! FREE MONEY GUARANTEED", "CLICK HERE to BUY NOW. Limited time, 100% free gift. You are a WINNER! https://a.co https://b.co https://c.co");
  assert.ok(c.score < 40, `score ${c.score}`);
  const sp = status(c, "Spam-trigger phrases");
  assert.equal(sp.status, "fail");
  assert.equal(sp.deduction, 30);
  assert.ok(sp.records!.includes("act now") && sp.records!.includes("click here"));
  assert.equal(status(c, "ALL-CAPS ratio").status, "fail");
  assert.equal(status(c, "Unsubscribe mention").status, "fail");
  assert.equal(c.score, 100 - c.findings.reduce((s, f) => s + f.deduction, 0));
});
test("phrase matching respects word boundaries and curly quotes", () => {
  assert.deepEqual(findSpamPhrases("this isn’t spam, honest"), ["this isn't spam"]);
  assert.deepEqual(findSpamPhrases("a factual note about actions now"), []);
  assert.deepEqual(findSpamPhrases("Please ACT NOW"), ["act now"]);
});
test("subject length warns over 60", () => {
  assert.equal(status(checkCopy("x".repeat(60), CLEAN_BODY), "Subject length").status, "pass");
  const long = status(checkCopy("x".repeat(61), CLEAN_BODY), "Subject length");
  assert.equal(long.status, "warn");
  assert.equal(long.deduction, 5);
  assert.equal(status(checkCopy("", CLEAN_BODY), "Subject length").status, "fail");
});
test("link counting: anchors once, bare urls once", () => {
  assert.equal(countLinks('<a href="https://a.co">https://a.co</a> and https://b.co'), 2);
  assert.equal(countLinks("no links"), 0);
});
test("link ratio", () => {
  const body = "See https://a.co https://b.co https://c.co https://d.co now. Unsubscribe here.";
  assert.equal(status(checkCopy("Hi", body), "Link to text ratio").status, "fail");
  assert.equal(status(checkCopy("Hi", CLEAN_BODY), "Link to text ratio").status, "pass");
});
test("caps ratio ignores short words and urls", () => {
  assert.equal(capsRatio("I am OK with HTTPS://X.CO but THIS is LOUD").caps, 2);
  assert.equal(capsRatio("").ratio, 0);
});
test("unsubscribe detection", () => {
  assert.equal(status(checkCopy("Hi", "Just a short note. Reply STOP to opt out."), "Unsubscribe mention").status, "pass");
  assert.equal(status(checkCopy("Hi", "Just a short note."), "Unsubscribe mention").status, "fail");
});
test("image-only html", () => {
  const c = checkCopy("Hi", '<html><body><img src="a.png"><a href="https://x.co/unsubscribe">u</a></body></html>');
  assert.equal(status(c, "Image-only HTML").status, "fail");
  const ok = checkCopy("Hi", `<p>${CLEAN_BODY}</p><img src="a.png">`);
  assert.equal(status(ok, "Image-only HTML").status, "pass");
});

const ok = (records: string[]) => ({ ok: true as const, records });
const down = { ok: false as const, error: "timed out after 8s" };
const find = (fs: ReturnType<typeof evaluateDomain>, name: string) => fs.find((f) => f.check === name)!;

test("domain: healthy", () => {
  const fs = evaluateDomain({ txt: ok(["v=spf1 include:_spf.google.com ~all", "google-site-verification=x"]), dmarc: ok(["v=DMARC1; p=reject; rua=mailto:d@x.co"]), mx: ok(["1 aspmx.l.google.com."]) });
  assert.equal(score(fs), 100);
  assert.deepEqual(find(fs, "SPF record").records, ["v=spf1 include:_spf.google.com ~all"]);
});
test("domain: nothing published", () => {
  const fs = evaluateDomain({ txt: ok([]), dmarc: ok([]), mx: ok([]) });
  assert.equal(score(fs), 100 - 30 - 25 - 30);
});
test("domain: spf variants", () => {
  const spf = (r: string[]) => find(evaluateDomain({ txt: ok(r), dmarc: ok(["v=DMARC1; p=none"]), mx: ok(["10 m."]) }), "SPF record");
  assert.equal(spf(["v=spf1 +all"]).deduction, 20);
  assert.equal(spf(["v=spf1 all"]).status, "fail");
  assert.equal(spf(["v=spf1 ?all"]).deduction, 8);
  assert.equal(spf(["v=spf1 ip4:1.2.3.4"]).deduction, 5);
  assert.equal(spf(["v=spf1 -all"]).status, "pass");
  assert.equal(spf(["v=spf1 -all", "v=spf1 ~all"]).deduction, 15);
  assert.equal(spf(["v=spf1 " + "include:a.co ".repeat(11) + "-all"]).deduction, 5);
});
test("domain: dmarc policy", () => {
  const dm = (r: string[]) => find(evaluateDomain({ txt: ok(["v=spf1 -all"]), dmarc: ok(r), mx: ok(["10 m."]) }), "DMARC policy");
  assert.equal(dm(["v=DMARC1; p=none; rua=mailto:a@b.co"]).deduction, 10);
  assert.equal(dm(["v=DMARC1; p=quarantine"]).status, "pass");
  assert.equal(dm(["v=DMARC1; rua=mailto:a@b.co"]).status, "fail");
});
test("domain: null MX fails", () => assert.equal(find(evaluateDomain({ txt: ok([]), dmarc: ok([]), mx: ok(["0 ."]) }), "MX records").status, "fail"));
test("domain: unreachable is unknown and deducts nothing", () => {
  const fs = evaluateDomain({ txt: down, dmarc: down, mx: down });
  assert.ok(fs.every((f) => f.unknown && f.deduction === 0));
  assert.equal(score(fs), 100);
});
test("txt chunk joining", () => assert.equal(parseTxtData('"v=spf1 include:a.co " "~all"'), "v=spf1 include:a.co ~all"));
test("domain normalization", () => {
  assert.equal(normalizeDomain(" HTTPS://Example.COM/path?q=1 "), "example.com");
  assert.equal(normalizeDomain("localhost"), null);
  assert.equal(normalizeDomain("a b.com"), null);
});

test("email validity and roles", () => {
  assert.ok(isValidEmail("a.b+tag@sub.example.com"));
  for (const bad of ["plain", "a@b", "a@@b.co", ".a@b.co", "a..b@b.co", "a b@b.co", "a@-b.co"]) assert.equal(isValidEmail(bad), false, bad);
  assert.ok(isRoleAddress("info@x.co") && isRoleAddress("support+x@x.co"));
  assert.equal(isRoleAddress("sam@x.co"), false);
});
test("list check flags suppressed, invalid, role, duplicate", () => {
  const c = checkList(["Sam@x.co", "sam@x.co", "info@x.co", "nope", "gone@x.co"], new Map([["gone@x.co", "bounce" as const]]));
  assert.deepEqual(c.rows!.map((r) => [r.valid, r.role, r.duplicate, r.suppressed]), [
    [true, false, false, null],
    [true, false, true, null],
    [true, true, false, null],
    [false, false, false, null],
    [true, false, false, "bounce"],
  ]);
  const d = Object.fromEntries(c.findings.map((f) => [f.check, f.deduction]));
  assert.deepEqual(d, { "Suppressed addresses": 40, "Invalid format": 30, "Role addresses": 10, Duplicates: 10 });
  assert.equal(c.score, 10);
});
test("clean list scores 100", () => assert.equal(checkList(["a@x.co", "b@y.co"], new Map()).score, 100));

test("csv: header column, quotes, BOM", () => {
  assert.deepEqual(extractEmails('﻿name,Email\n"Lee, Sam",sam@x.co\r\nAmy,amy@y.co\n\n'), ["sam@x.co", "amy@y.co"]);
});
test("csv: bare list and header-less rows", () => {
  assert.deepEqual(extractEmails("a@x.co\nb@y.co\n"), ["a@x.co", "b@y.co"]);
  assert.deepEqual(extractEmails("first,addr\nSam,sam@x.co"), ["sam@x.co"]);
  assert.deepEqual(extractEmails("a@x.co\nnot-an-email"), ["a@x.co", "not-an-email"]);
  assert.deepEqual(extractEmails(""), []);
});
