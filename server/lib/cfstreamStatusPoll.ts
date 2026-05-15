import { db } from "../db";
import { reels } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Cloudflare Stream's POST /stream endpoint returns synchronously with the upload
 * acknowledged but the video usually still in `queued` or `inprogress` state. Processing
 * (HLS/DASH manifest generation, thumbnail rendering) finishes async ~10–30s later.
 *
 * The reels row is inserted with `status='processing'` at upload time and would never
 * transition to `published` without this poll — and `/api/chef/:handle/reels` filters
 * on `status='published'`, so processing reels are hidden from the chef's profile.
 *
 * pollUntilReady runs entirely in the same Node process. Single-instance Fly.io is
 * fine. Replace with a CF Stream webhook once we have a publicly reachable URL.
 */

const POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 60; // 60 * 5s = 5 minutes

interface CFStatusResponse {
  result?: { status?: { state?: string } };
  success?: boolean;
}

export function pollUntilReady(reelId: number, cfStreamUid: string): void {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!accountId || !apiToken) {
    console.warn(`[cf-poll] Missing CF credentials, skipping poll for reel ${reelId}`);
    return;
  }

  let attempts = 0;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${cfStreamUid}`;

  const interval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = (await res.json()) as CFStatusResponse;
      const state = data?.result?.status?.state;

      if (state === "ready") {
        await db
          .update(reels)
          .set({ status: "published", updatedAt: new Date() })
          .where(eq(reels.id, reelId));
        clearInterval(interval);
        console.log(`[cf-poll] Reel ${reelId} (uid=${cfStreamUid}) marked published after ${attempts} attempt(s)`);
        return;
      }

      if (state === "error" || attempts >= MAX_ATTEMPTS) {
        await db
          .update(reels)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(reels.id, reelId));
        clearInterval(interval);
        console.error(
          `[cf-poll] Reel ${reelId} (uid=${cfStreamUid}) marked failed: state=${state ?? "unknown"}, attempts=${attempts}`,
        );
      }
    } catch (err: any) {
      console.error(`[cf-poll] Polling error for reel ${reelId} (uid=${cfStreamUid}, attempt ${attempts}):`, err?.message ?? err);
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        // Best-effort: mark failed even on network errors past the cap.
        db
          .update(reels)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(reels.id, reelId))
          .catch(() => {});
      }
    }
  }, POLL_INTERVAL_MS);
}
