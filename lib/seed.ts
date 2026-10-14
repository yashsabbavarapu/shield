import type { SuppressionEntry } from "./types";

/** Sample suppression rows. Every row is tagged `sample: true`. No check results are seeded. */
export function buildSeed(): SuppressionEntry[] {
  const rows: [string, SuppressionEntry["reason"], string][] = [
    ["jordan.lee@example.com", "bounce", "2026-09-02T09:14:00Z"],
    ["priya.nair@example.org", "unsub", "2026-09-05T15:40:00Z"],
    ["sam.ortiz@example.net", "complaint", "2026-09-11T11:02:00Z"],
    ["dana.kim@example.com", "unsub", "2026-09-18T08:27:00Z"],
    ["ravi.shah@example.org", "bounce", "2026-09-24T13:55:00Z"],
    ["old.contact@example.net", "bounce", "2026-10-01T10:05:00Z"],
  ];
  return rows.map(([email, reason, added_at], i) => ({ id: `sup_seed${i + 1}`, email, reason, added_at, sample: true }));
}
