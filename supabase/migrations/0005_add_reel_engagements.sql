-- Phase E of Reels + Chef Creator Platform.
-- Engagement tables: likes, favorites, saves (toggle pattern with composite PK);
-- shares (event log); comments (flat, soft-delete).

CREATE TABLE IF NOT EXISTS public.reel_likes (
  user_id     INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reel_id     INTEGER   NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, reel_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_likes_reel_id ON public.reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_likes_user_id ON public.reel_likes(user_id);

CREATE TABLE IF NOT EXISTS public.reel_favorites (
  user_id     INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reel_id     INTEGER   NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, reel_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_favorites_reel_id ON public.reel_favorites(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_favorites_user_id ON public.reel_favorites(user_id);

CREATE TABLE IF NOT EXISTS public.reel_saves (
  user_id     INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reel_id     INTEGER   NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, reel_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_saves_reel_id ON public.reel_saves(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_saves_user_id ON public.reel_saves(user_id);

CREATE TABLE IF NOT EXISTS public.reel_shares (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reel_id       INTEGER   NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  share_method  TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reel_shares_reel_id ON public.reel_shares(reel_id);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id          SERIAL PRIMARY KEY,
  reel_id     INTEGER   NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id     INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body        TEXT      NOT NULL,
  deleted_at  TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_id_created_at
  ON public.reel_comments(reel_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reel_comments_user_id ON public.reel_comments(user_id);
