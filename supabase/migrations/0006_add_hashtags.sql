-- Phase F of Reels + Chef Creator Platform.
-- Hashtags emerge organically from reel descriptions (server-side parser at upload time).
-- tag is the canonical lowercased form; usage_count is denormalized for trending/ranking.

CREATE TABLE IF NOT EXISTS public.hashtags (
  tag           TEXT      PRIMARY KEY,
  usage_count   INTEGER   NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hashtags_usage_count ON public.hashtags(usage_count DESC);

CREATE TABLE IF NOT EXISTS public.reel_hashtags (
  reel_id     INTEGER   NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  tag         TEXT      NOT NULL REFERENCES public.hashtags(tag) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reel_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_reel_hashtags_tag ON public.reel_hashtags(tag);
