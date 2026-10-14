// Write protection: SHIELD_API_SECRET (server-only) gates every write route via the `x-shield-secret` header.
// Unset (local dev): writes are open and the UI says so. The UI's own writes are server actions, so the secret
// never reaches the client. GET routes stay open. Writes are also limited to 30/min per IP.
import { timingSafeEqual } from "node:crypto";
import { kv } from "@vercel/kv";
import { kvConfigured } from "./store";

export const AUTH_HEADER = "x-shield-secret";
export const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;

export const writesAuthenticated = () => Boolean(process.env.SHIELD_API_SECRET);

export function secretOk(given: string | null): boolean {
  const secret = process.env.SHIELD_API_SECRET;
  if (!secret) return true;
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const hits = new Map<string, number[]>();

/** Returns seconds to wait when over the limit, else 0. KV-backed when configured so it holds across instances. */
export async function rateLimit(ip: string): Promise<number> {
  const now = Date.now();
  if (kvConfigured()) {
    const bucket = Math.floor(now / WINDOW_MS);
    const key = `shield:rl:${ip}:${bucket}`;
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, 120);
    return n > RATE_LIMIT ? Math.max(1, Math.ceil(((bucket + 1) * WINDOW_MS - now) / 1000)) : 0;
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return Math.max(1, Math.ceil(((recent[0] ?? now) + WINDOW_MS - now) / 1000));
  }
  recent.push(now);
  hits.set(ip, recent);
  return 0;
}

export const clientIp = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
