import { createRateLimiter } from "./rate-limit";

/** Public API: 60 requests per minute per IP */
export const publicApiRateLimiter = createRateLimiter("public-api-v1", {
  maxRequests: 60,
  windowMs: 60 * 1000,
});
