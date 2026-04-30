/**
 * Simple in-memory rate limiter for API endpoints.
 *
 * Uses a sliding window approach per IP address.
 * Not shared across serverless instances — acceptable for basic brute-force protection.
 * For production-grade rate limiting, consider Redis-backed solutions.
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Periodic cleanup to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const lastCleanupByStore = new Map<string, number>();

function cleanupExpired(storeName: string, store: Map<string, RateLimitEntry>): void {
  const now = Date.now();
  const lastCleanup = lastCleanupByStore.get(storeName) ?? 0;
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanupByStore.set(storeName, now);
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Create a rate limiter for a specific endpoint/group.
 *
 * @param name - Unique name for this limiter (e.g., "auth-login")
 * @param config - Rate limit configuration
 * @returns A function that checks rate limits and returns a 429 response if exceeded, or null if allowed
 */
export function createRateLimiter(name: string, config: RateLimitConfig) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }

  const store = stores.get(name)!;

  return function checkRateLimit(request: NextRequest): NextResponse | null {
    cleanupExpired(name, store);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + config.windowMs });
      return null;
    }

    if (entry.count >= config.maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Inténtelo más tarde." },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

    entry.count++;
    return null;
  };
}

// Pre-configured limiters for common use cases

/** Auth endpoints: 10 requests per 15 minutes per IP */
export const authRateLimiter = createRateLimiter("auth", {
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
});

/** Geocoding: 30 requests per minute per IP */
export const geocodeRateLimiter = createRateLimiter("geocode", {
  maxRequests: 30,
  windowMs: 60 * 1000,
});
