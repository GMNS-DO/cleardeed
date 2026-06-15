/**
 * In-memory rate limiter (token bucket) — A.4.2.
 *
 * Protects free/paid routes from accidental double-clicks and scripted
 * bot abuse. Per-IP, per-route bucket. Each bucket refills at the
 * configured rate (refillPerSec) up to a max of `capacity`.
 *
 * Why in-memory and not DB-backed?
 * - Rate limit check is on the hot path of every request; a DB read
 *   per request would add 5-20 ms of latency.
 * - The limiter is best-effort. A 30-second memory window (cleanupMs)
 *   keeps the Map bounded.
 * - On a Vercel serverless function, the in-memory state persists for
 *   the lifetime of the warm container. The next cold start resets,
 *   which is acceptable for a 10-reports-per-IP-per-hour limit.
 *   Two buyers behind the same NAT will share a bucket, also
 *   acceptable for launch.
 *
 * Usage:
 *   const { limited, retryAfter } = checkRateLimit({
 *     ip: req.headers.get('x-forwarded-for') ?? 'unknown',
 *     route: 'preview',
 *     capacity: 10,        // 10 requests
 *     refillPerSec: 1/6,   // refills 1 token per 6 seconds
 *   });
 *   if (limited) {
 *     return new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(retryAfter) } });
 *   }
 */
type Bucket = { tokens: number; lastRefill: number };
const buckets = new Map<string, Bucket>();
const cleanupMs = 5 * 60 * 1000;
let lastCleanup = Date.now();

export interface RateLimitInput {
  ip: string;
  route: string;
  capacity: number;
  refillPerSec: number;
}

export interface RateLimitResult {
  limited: boolean;
  retryAfter: number; // seconds until next token
  remaining: number;  // tokens left after this check
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const { ip, route, capacity, refillPerSec } = input;
  const key = `${route}:${ip}`;
  const now = Date.now();

  // Periodic cleanup of stale buckets to bound memory
  if (now - lastCleanup > cleanupMs) {
    const cutoff = now - cleanupMs;
    for (const [k, b] of buckets) {
      if (b.lastRefill < cutoff) buckets.delete(k);
    }
    lastCleanup = now;
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefill: now };
    buckets.set(key, bucket);
  } else {
    // Refill: add tokens proportional to time elapsed
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    const refill = elapsedSec * refillPerSec;
    bucket.tokens = Math.min(capacity, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { limited: false, retryAfter: 0, remaining: Math.floor(bucket.tokens) };
  }

  // Not enough tokens. How many seconds until we have ≥1?
  const deficit = 1 - bucket.tokens;
  const retryAfter = Math.ceil(deficit / refillPerSec);
  return { limited: true, retryAfter, remaining: 0 };
}

/**
 * Extract the client IP from common proxy headers.
 * Falls back to 'unknown' so all un-attributable traffic shares
 * one bucket (the most conservative default).
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
