-- Phase G of Reels + Chef Creator Platform.
-- Notifications generated on engagement events where actor != recipient.

CREATE TABLE IF NOT EXISTS public.notifications (
  id                  SERIAL PRIMARY KEY,
  recipient_user_id   INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id       INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,                                     -- 'like' | 'favorite' | 'save' | 'comment'
  reel_id             INTEGER REFERENCES public.reels(id) ON DELETE CASCADE,
  comment_id          INTEGER REFERENCES public.reel_comments(id) ON DELETE CASCADE,
  read_at             TIMESTAMP,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at
  ON public.notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(recipient_user_id) WHERE read_at IS NULL;

-- Toggle-off / toggle-on must converge on a single notification row per actor-per-reel-per-type.
-- Comments are exempt because we want every comment to surface as its own notification.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_toggle
  ON public.notifications(recipient_user_id, actor_user_id, reel_id, type)
  WHERE type IN ('like', 'favorite', 'save');
