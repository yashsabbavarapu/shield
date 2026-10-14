# Shield v1

Send-readiness checks for copy, domains and lists. Functional spec: `../files/shield-functional-spec.md`.

- `npm run dev` / `npm run build` / `npm start`, `npm test` (unit tests for the heuristics, scoring and CSV parsing).
- Scoring weights are in `lib/checks.ts` (`WEIGHTS`) and shown on each page.
- Writes (`POST`/`DELETE`) need the `x-shield-secret` header when `SHIELD_API_SECRET` is set; 30 writes/min per IP.
- Storage: Vercel KV when `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set, else in memory.
- Domain checks use Cloudflare DNS-over-HTTPS with an 8s timeout; a failed lookup is reported as unknown and deducts nothing.

API: `POST /api/checks/{copy,domain,list}`, `GET|POST /api/suppressions`, `DELETE /api/suppressions/[id]`, `GET /api/log`.
