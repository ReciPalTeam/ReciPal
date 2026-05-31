import { db } from "../db";
import { hashtags, reelHashtags } from "@shared/schema";
import { sql, eq, and, inArray } from "drizzle-orm";

// Phase F decision: hashtags are freeform, parsed from anywhere in the reel description.
// Canonical form is lowercase; allowed chars are alphanumeric + underscore.
const HASHTAG_REGEX = /#([a-z0-9_]{1,30})/gi;

/** Extract a deduped, lowercased list of hashtag tokens (without the leading '#'). */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  // Reset lastIndex defensively (regex state is shared because of the /g flag).
  HASHTAG_REGEX.lastIndex = 0;
  while ((match = HASHTAG_REGEX.exec(text)) !== null) {
    seen.add(match[1].toLowerCase());
  }
  return Array.from(seen);
}

/**
 * Persist hashtags for a freshly-created reel:
 *   1. Upsert each tag in `hashtags` (insert with count=1, or +1 on conflict)
 *   2. Insert the (reel_id, tag) join row (no-op on conflict)
 *
 * Safe to call once per reel — `reel_hashtags` has a composite PK so duplicates are
 * blocked at the DB level even if this is invoked twice.
 */
export async function persistReelHashtags(
  reelId: number,
  description: string | null | undefined,
): Promise<string[]> {
  const tags = extractHashtags(description);
  if (tags.length === 0) return [];

  for (const tag of tags) {
    await db
      .insert(hashtags)
      .values({ tag, usageCount: 1 })
      .onConflictDoUpdate({
        target: hashtags.tag,
        set: { usageCount: sql`${hashtags.usageCount} + 1` },
      });
    await db
      .insert(reelHashtags)
      .values({ reelId, tag })
      .onConflictDoNothing();
  }
  return tags;
}

/**
 * Reconcile hashtags when a reel's description is EDITED (Phase H.20): diff the new tag set against
 * the reel's current `reel_hashtags`, then add new ones (+1 usage) and remove stale ones
 * (delete the join rows + decrement `usage_count`, floored at 0). Unlike `persistReelHashtags`
 * (additive only), this keeps `hashtags.usage_count` accurate across edits.
 */
export async function reconcileReelHashtags(
  reelId: number,
  description: string | null | undefined,
): Promise<string[]> {
  const newTags = extractHashtags(description);
  const existingRows = await db
    .select({ tag: reelHashtags.tag })
    .from(reelHashtags)
    .where(eq(reelHashtags.reelId, reelId));
  const existing = new Set(existingRows.map((r) => r.tag));
  const next = new Set(newTags);
  const added = newTags.filter((t) => !existing.has(t));
  const removed = [...existing].filter((t) => !next.has(t));

  for (const tag of added) {
    await db
      .insert(hashtags)
      .values({ tag, usageCount: 1 })
      .onConflictDoUpdate({ target: hashtags.tag, set: { usageCount: sql`${hashtags.usageCount} + 1` } });
    await db.insert(reelHashtags).values({ reelId, tag }).onConflictDoNothing();
  }
  if (removed.length > 0) {
    await db.delete(reelHashtags).where(and(eq(reelHashtags.reelId, reelId), inArray(reelHashtags.tag, removed)));
    await db
      .update(hashtags)
      .set({ usageCount: sql`GREATEST(${hashtags.usageCount} - 1, 0)` })
      .where(inArray(hashtags.tag, removed));
  }
  return newTags;
}
