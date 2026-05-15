import { db } from "../db";
import { hashtags, reelHashtags } from "@shared/schema";
import { sql } from "drizzle-orm";

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
