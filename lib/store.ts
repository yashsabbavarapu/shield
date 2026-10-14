import { kv } from "@vercel/kv";
import type { AuditEntry, SuppressionEntry } from "./types";
import { buildSeed } from "./seed";

/**
 * Storage adapter. Vercel KV when KV_REST_API_URL / KV_REST_API_TOKEN are set,
 * otherwise an in-memory Map (resets on restart). Both seed once with sample rows.
 */
export interface Store {
  readonly kind: "kv" | "memory";
  listSuppressions(): Promise<SuppressionEntry[]>;
  getSuppressionByEmail(email: string): Promise<SuppressionEntry | null>;
  addSuppressions(entries: SuppressionEntry[]): Promise<void>;
  removeSuppression(id: string): Promise<SuppressionEntry | null>;
  listAudit(): Promise<AuditEntry[]>;
  appendAudit(entry: AuditEntry): Promise<void>;
}

const newest = <T>(rows: T[], key: (r: T) => string) => rows.sort((a, b) => key(b).localeCompare(key(a)));

class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private byId = new Map<string, SuppressionEntry>();
  private audit: AuditEntry[] = [];

  constructor() {
    for (const s of buildSeed()) this.byId.set(s.id, s);
  }
  async listSuppressions() {
    return newest([...this.byId.values()], (s) => s.added_at);
  }
  async getSuppressionByEmail(email: string) {
    return [...this.byId.values()].find((s) => s.email === email) ?? null;
  }
  async addSuppressions(entries: SuppressionEntry[]) {
    for (const e of entries) this.byId.set(e.id, e);
  }
  async removeSuppression(id: string) {
    const e = this.byId.get(id) ?? null;
    this.byId.delete(id);
    return e;
  }
  async listAudit() {
    return [...this.audit].reverse();
  }
  async appendAudit(entry: AuditEntry) {
    this.audit.push(entry);
  }
}

const SUPP = "shield:suppressions"; // hash: id -> entry
const EMAILS = "shield:suppression-emails"; // hash: email -> id
const AUDIT = "shield:audit"; // list, newest first
const SEEDED = "shield:seeded";

type Kv = typeof import("@vercel/kv").kv;

class KvStore implements Store {
  readonly kind = "kv" as const;
  private ready: Promise<void>;

  constructor(private kv: Kv) {
    this.ready = this.seedOnce();
  }

  private async seedOnce() {
    // SET NX: only the first instance to reach an empty database seeds it.
    if ((await this.kv.set(SEEDED, "1", { nx: true })) === null) return;
    await this.addSuppressions(buildSeed());
  }

  async listSuppressions() {
    await this.ready;
    const all = await this.kv.hgetall<Record<string, SuppressionEntry>>(SUPP);
    return newest(Object.values(all ?? {}), (s) => s.added_at);
  }
  async getSuppressionByEmail(email: string) {
    await this.ready;
    const id = await this.kv.hget<string>(EMAILS, email);
    return id ? ((await this.kv.hget<SuppressionEntry>(SUPP, id)) ?? null) : null;
  }
  async addSuppressions(entries: SuppressionEntry[]) {
    if (entries.length === 0) return;
    await Promise.all([
      this.kv.hset(SUPP, Object.fromEntries(entries.map((e) => [e.id, e]))),
      this.kv.hset(EMAILS, Object.fromEntries(entries.map((e) => [e.email, e.id]))),
    ]);
  }
  async removeSuppression(id: string) {
    await this.ready;
    const e = await this.kv.hget<SuppressionEntry>(SUPP, id);
    if (!e) return null;
    await Promise.all([this.kv.hdel(SUPP, id), this.kv.hdel(EMAILS, e.email)]);
    return e;
  }
  async listAudit() {
    await this.ready;
    return this.kv.lrange<AuditEntry>(AUDIT, 0, 499);
  }
  async appendAudit(entry: AuditEntry) {
    await this.ready;
    await this.kv.lpush(AUDIT, entry);
  }
}

export const kvConfigured = () => Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const g = globalThis as unknown as { __shieldStore?: Store };

/** One store per server instance (survives dev hot reloads). */
export function getStore(): Store {
  if (!g.__shieldStore) g.__shieldStore = kvConfigured() ? new KvStore(kv) : new MemoryStore();
  return g.__shieldStore;
}
