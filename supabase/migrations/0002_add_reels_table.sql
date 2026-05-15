-- Phase B of Reels + Chef Creator Platform.
-- reels: chef-uploaded short videos. Video lives on Cloudflare Stream (cf_stream_uid).
-- fingerprint_status is set inline at upload time; clean videos are forwarded to CF Stream,
-- flagged videos never persist (no row inserted at all). 'pending' is only used during
-- migration / backfill scenarios.

CREATE TABLE IF NOT EXISTS public.reels (
  id                    SERIAL PRIMARY KEY,
  chef_id               INTEGER     NOT NULL REFERENCES public.chef_profiles(id) ON DELETE CASCADE,
  cf_stream_uid         TEXT        NOT NULL UNIQUE,
  playback_url          TEXT        NOT NULL,
  thumbnail_url         TEXT,
  title                 TEXT,
  description           TEXT,
  duration_s            INTEGER,
  status                TEXT        NOT NULL DEFAULT 'processing',  -- 'uploading' | 'processing' | 'published' | 'failed'
  fingerprint_status    TEXT        NOT NULL,                       -- 'clean' | 'flagged' | 'pending'
  fingerprint_provider  TEXT,                                       -- 'chromaprint' | 'acrcloud'
  flagged_track         TEXT,
  flagged_artist        TEXT,
  like_count            INTEGER     NOT NULL DEFAULT 0,
  favorite_count        INTEGER     NOT NULL DEFAULT 0,
  save_count            INTEGER     NOT NULL DEFAULT 0,
  share_count           INTEGER     NOT NULL DEFAULT 0,
  comment_count         INTEGER     NOT NULL DEFAULT 0,
  view_count            INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reels_chef_id          ON public.reels(chef_id);
CREATE INDEX IF NOT EXISTS idx_reels_status           ON public.reels(status);
CREATE INDEX IF NOT EXISTS idx_reels_fingerprint     ON public.reels(fingerprint_status);
CREATE INDEX IF NOT EXISTS idx_reels_created_at      ON public.reels(created_at DESC);

-- Public read filter target: status='published' AND fingerprint_status='clean'.
CREATE INDEX IF NOT EXISTS idx_reels_public_feed
  ON public.reels(created_at DESC)
  WHERE status = 'published' AND fingerprint_status = 'clean';

CREATE OR REPLACE FUNCTION public.update_reels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reels_updated_at ON public.reels;
CREATE TRIGGER trigger_reels_updated_at
  BEFORE UPDATE ON public.reels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reels_updated_at();
