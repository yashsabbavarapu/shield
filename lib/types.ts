export type Status = "pass" | "warn" | "fail";

export interface Finding {
  check: string;
  status: Status;
  detail: string;
  /** Points subtracted from 100 for this finding. Always shown next to the reason. */
  deduction: number;
  /** Actual DNS records or matched items backing the finding. */
  records?: string[];
  /** The lookup could not be completed; nothing was deducted. */
  unknown?: boolean;
}

export interface ListRow {
  email: string;
  valid: boolean;
  role: boolean;
  duplicate: boolean;
  suppressed: SuppressionReason | null;
}

export interface Check {
  id: string;
  at: string;
  kind: "copy" | "domain" | "list";
  subject: string;
  score: number;
  findings: Finding[];
  /** True when at least one lookup was unknown, so the score covers only what could be checked. */
  incomplete?: boolean;
  rows?: ListRow[];
}

export type SuppressionReason = "bounce" | "unsub" | "complaint";

export interface SuppressionEntry {
  id: string;
  email: string;
  reason: SuppressionReason;
  added_at: string;
  sample?: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  summary: string;
}
