-- Phase B.1 of Reels + Chef Creator Platform.
-- Curated royalty-free music library. MP3 files in Storage; metadata here.

CREATE TABLE IF NOT EXISTS public.music_tracks (
  id                SERIAL PRIMARY KEY,
  title             TEXT      NOT NULL,
  artist            TEXT,
  vibe              TEXT,                                  -- 'upbeat' | 'chill' | 'cozy' | 'energetic' | 'cinematic' | 'acoustic'
  duration_s        INTEGER,
  file_url          TEXT      NOT NULL,                    -- Public URL to MP3 in Supabase Storage
  file_size_bytes   INTEGER,
  source            TEXT      NOT NULL DEFAULT 'pixabay',
  source_track_id   TEXT,
  tags              JSONB     NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_tracks_vibe        ON public.music_tracks(vibe);
CREATE INDEX IF NOT EXISTS idx_music_tracks_title_lower ON public.music_tracks(LOWER(title));

-- Storage bucket for the MP3 files.
INSERT INTO storage.buckets (id, name, public)
VALUES ('music-tracks', 'music-tracks', TRUE)
ON CONFLICT (id) DO NOTHING;
