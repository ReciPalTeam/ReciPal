import helmet from "helmet";
import type { Express, Request, Response, NextFunction } from "express";

/**
 * Phase M / WS-A3 — global security hardening.
 *
 * 1. helmet: security headers. CSP is enforced only in production (Vite dev needs
 *    eval/HMR); the allowlists cover the app's known external origins:
 *    - unpkg.com               -> ffmpeg-core wasm bundle (chef upload pipeline)
 *    - *.supabase.co           -> Storage public images (avatars, recipe/meal photos)
 *    - *.cloudflarestream.com  -> reel HLS playback + thumbnails
 *    - *.ingest.sentry.io      -> Sentry client events
 *    COOP/COEP are NOT set by helmet here — server/index.ts sets COOP same-origin +
 *    COEP credentialless manually (FFmpeg.wasm needs cross-origin isolation while
 *    still loading CDN/CDN-less media); helmet's defaults would conflict.
 *
 * 2. CSRF origin verification: session auth is cookie-based (sameSite=lax), so
 *    cross-site POSTs from a malicious page would carry the victim's cookie.
 *    Browsers ALWAYS attach an Origin header to cross-site state-changing requests,
 *    so rejecting mutating requests whose Origin/Referer host differs from the Host
 *    header blocks CSRF without per-request tokens (OWASP "verifying origin" pattern).
 *    Requests with NO Origin AND NO Referer (curl, native apps, same-origin GET nav)
 *    pass through — a browser cannot produce a cross-site mutation without Origin.
 *    Extra allowed origins (e.g. capacitor://localhost for the native shell) can be
 *    listed in ALLOWED_ORIGINS (comma-separated).
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function extraAllowedOrigins(): Set<string> {
  return new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function csrfOriginCheck(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING.has(req.method)) return next();

  const source = req.headers.origin ?? req.headers.referer;
  if (!source) return next(); // no browser-originated cross-site mutation lacks Origin

  let sourceHost: string;
  let sourceOrigin: string;
  try {
    const u = new URL(source);
    sourceHost = u.host.toLowerCase();
    sourceOrigin = u.origin.toLowerCase();
  } catch {
    return res.status(403).json({ error: "Invalid request origin" });
  }

  const host = (req.headers.host ?? "").toLowerCase();
  if (sourceHost === host) return next();
  if (extraAllowedOrigins().has(sourceOrigin)) return next();

  console.warn(`[security] blocked cross-origin ${req.method} ${req.path} from ${sourceOrigin} (host=${host})`);
  return res.status(403).json({ error: "Cross-origin request blocked" });
}

export function applySecurityHeaders(app: Express) {
  const isProd = process.env.NODE_ENV === "production";
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              "default-src": ["'self'"],
              "script-src": ["'self'", "https://unpkg.com", "'wasm-unsafe-eval'"],
              "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              "font-src": ["'self'", "https://fonts.gstatic.com"],
              "img-src": ["'self'", "data:", "blob:", "https://*.supabase.co", "https://*.cloudflarestream.com", "https://images.unsplash.com"],
              "media-src": ["'self'", "blob:", "https://*.cloudflarestream.com"],
              "connect-src": ["'self'", "blob:", "https://*.supabase.co", "https://*.cloudflarestream.com", "https://*.ingest.sentry.io", "https://unpkg.com"],
              "worker-src": ["'self'", "blob:"],
              "frame-ancestors": ["'self'"],
            },
          }
        : false,
      // index.ts owns COOP/COEP (FFmpeg.wasm cross-origin isolation)
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: isProd ? { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true } : false,
    }),
  );
  app.use(csrfOriginCheck);
}
