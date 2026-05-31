-- Phase H.19.1 — reel view tracking: one row per (user, reel) = unique viewers.
-- reels.view_count is incremented on first view per user (self-views excluded); created_at = event log.

CREATE TABLE IF NOT EXISTS public.reel_views (
  user_id    integer   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reel_id    integer   NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reel_id)
);

-- per-reel lookups + views-over-time
CREATE INDEX IF NOT EXISTS idx_reel_views_reel ON public.reel_views(reel_id, created_at);
