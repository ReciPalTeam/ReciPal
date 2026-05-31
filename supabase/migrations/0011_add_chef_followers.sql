-- Phase H.17 — follow system: chef_followers + denormalized follower_count + follow notifications.

ALTER TABLE public.chef_profiles
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.chef_followers (
  user_id    integer   NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  chef_id    integer   NOT NULL REFERENCES public.chef_profiles(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chef_id)
);

-- following-feed lookup (chefs a user follows) + followers list (who follows a chef, newest first)
CREATE INDEX IF NOT EXISTS idx_chef_followers_user ON public.chef_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_chef_followers_chef ON public.chef_followers(chef_id, created_at DESC);

-- one "X followed you" notification per (recipient, actor); survives follow/unfollow toggling
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_follow
  ON public.notifications(recipient_user_id, actor_user_id) WHERE type = 'follow';

-- keep the denormalized counter consistent on (re-)apply
UPDATE public.chef_profiles cp
  SET follower_count = (SELECT COUNT(*) FROM public.chef_followers cf WHERE cf.chef_id = cp.id);
