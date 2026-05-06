import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Sliding-window rate limiters keyed by route tier.
// If Upstash env vars are absent (local dev), all checks pass.

const redisAvailable =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

function makeLimiter(requests: number, windowSeconds: number) {
  if (!redisAvailable) return null;
  return new Ratelimit({
    redis:     Redis.fromEnv(),
    limiter:   Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    analytics: false,
  });
}

// Transaction-building routes — tightest limit (prevents wallet drain loops)
export const txLimiter      = makeLimiter(5,  60);  // 5 / min
// Quote + read routes
export const quoteLimiter   = makeLimiter(20, 60);  // 20 / min
// Balance / position reads
export const readLimiter    = makeLimiter(30, 60);  // 30 / min

/**
 * Returns 429 Response if the caller is rate-limited, otherwise null.
 * Pass a unique prefix per route so limits don't share counters.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  ip: string,
  prefix: string,
): Promise<Response | null> {
  if (!limiter) return null;

  const { success, limit, remaining, reset } = await limiter.limit(`${prefix}:${ip}`);

  if (!success) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type":    "application/json",
        "X-RateLimit-Limit":     String(limit),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset":     String(reset),
        "Retry-After":           String(Math.ceil((reset - Date.now()) / 1000)),
      },
    });
  }
  return null;
}
