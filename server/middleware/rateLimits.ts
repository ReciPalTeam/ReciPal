import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request } from "express";

/**
 * Rate-limit key: prefer the authenticated user id (so multiple roommates sharing a NAT
 * don't trip each other's limits), fall back to the canonical IP key when unauth.
 *
 * `ipKeyGenerator` is the helper express-rate-limit exposes to handle IPv6 normalization
 * correctly — using raw `req.ip` for IPv6 buckets misses the /64-prefix grouping that
 * stops trivial cycling.
 */
function userOrIpKey(req: Request, res: any): string {
  const user = (req as any).user as { id?: number } | undefined;
  if (user?.id) return `user:${user.id}`;
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

function jsonMessage(message: string): Options["handler"] {
  return (req, res) => {
    res.status(429).json({ error: message, retryAfter: res.getHeader("Retry-After") });
  };
}

/** Cost-heavy: per-reel FFmpeg + AcoustID + Cloudflare Stream call. */
export const reelUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: userOrIpKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonMessage("Too many uploads. Try again in an hour."),
});

/** Cost-heavy: OpenAI Whisper + GPT-4o-mini per call (~$0.013). */
export const extractRecipeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: userOrIpKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonMessage("Too many recipe extractions. Try again in an hour."),
});

/** Cost-heavy: GPT-4o vision per receipt scan (~$0.01–0.04). */
export const receiptScanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: userOrIpKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonMessage("Too many receipt scans. Try again in an hour."),
});

/** AI text endpoints (scaled-steps, classify, reconcile): gpt-4o-mini per call. */
export const aiTextLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  keyGenerator: userOrIpKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonMessage("Too many AI requests. Try again in an hour."),
});

/** Generic backstop on ALL mutating /api requests (per user). Generous enough that
 * real usage never trips it; stops bulk enumeration/deletion scripts cold. */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  keyGenerator: userOrIpKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonMessage("Too many requests. Slow down and try again shortly."),
});

/** Feed reads (reels + recipes feeds): anti-scraping throttle. */
export const feedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 400,
  keyGenerator: userOrIpKey,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonMessage("Too many feed requests. Try again shortly."),
});

/** Brute-force protection on login. Pure IP-based since pre-auth has no user. */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonMessage("Too many login attempts. Try again in a minute."),
});

/** Signup spam protection. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: jsonMessage("Too many signups from this network. Try again in an hour."),
});
