/** Parse CSV text into rows of cells. Handles quoted cells, doubled quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Pull the email column out of a CSV. A header named email / e-mail / email address picks the column;
 * otherwise each row uses its first cell containing "@", falling back to its first cell.
 */
export function extractEmails(text: string): string[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0]!.map((c) => c.trim().toLowerCase());
  const col = header.findIndex((h) => ["email", "e-mail", "email address", "email_address", "emailaddress"].includes(h));
  if (col >= 0) return rows.slice(1).map((r) => (r[col] ?? "").trim()).filter(Boolean);
  const looksLikeHeader = rows[0]!.every((c) => !c.includes("@")) && rows.length > 1 && rows.slice(1).some((r) => r.some((c) => c.includes("@")));
  return (looksLikeHeader ? rows.slice(1) : rows)
    .map((r) => (r.find((c) => c.includes("@")) ?? r[0] ?? "").trim())
    .filter(Boolean);
}
