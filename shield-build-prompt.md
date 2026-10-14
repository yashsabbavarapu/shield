# Build: Shield v1 (functionality only)

Read FIRST: `/home/hatch/workspace/goals/build-the-end-to-end-gtm-ai-application/files/shield-functional-spec.md` (the contract) and `/home/hatch/workspace/goals/build-the-end-to-end-gtm-ai-application/files/build-conventions.md` (stack, storage, write protection, API norms, acceptance — all binding).

## Build order
1. `lib/checks.ts`: copy checks (spam-trigger phrase list of ~40 classics, subject length, link-to-text ratio, ALL-CAPS ratio, unsubscribe mention, image-only HTML), domain checks via DNS-over-HTTPS (SPF, DMARC + policy, MX — Cloudflare `https://cloudflare-dns.com/dns-query`, 8s timeout, unreachable → "unknown"), list checks (format, role-address, duplicates). Scoring: 100 minus documented per-finding weights. Unit-test the pure parts.
2. `lib/store.ts` + `lib/seed.ts` (suppression list with a few entries; all `sample: true`). No seeded check results — checks run live.
3. API: `POST /api/checks/copy`, `POST /api/checks/domain`, `POST /api/checks/list`, `POST /api/suppressions`, `DELETE /api/suppressions/[id]`, `GET /api/suppressions`.
4. Pages: `/` (minimal), `/copy` (paste form → graded report, every deduction with its reason), `/domain` (form → findings with the actual DNS records shown), `/list` (CSV upload → per-email table with suppression hits), `/suppressions` (add/remove), `/log`.

## Acceptance
Per build-conventions.md, plus: curl the loop (copy check on spammy text → fails with reasons; domain check on a real domain → shows actual SPF/DMARC records; list check flags a suppressed email after adding it). Unit tests cover the copy heuristics. Commit, do NOT push. Report the Vercel setup (new project, KV, SHIELD_API_SECRET server-only).
