-- Phase A of Reels + Chef Creator Platform
-- chef_profiles:     activated chef accounts (one row per approved chef)
-- chef_applications: queue of pending applications (status flipped by admin)

CREATE TABLE IF NOT EXISTS public.chef_profiles (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER     NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  handle        TEXT        NOT NULL UNIQUE,
  display_name  TEXT        NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  is_approved   BOOLEAN     NOT NULL DEFAULT FALSE,
  applied_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
  approved_at   TIMESTAMP,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chef_profiles_user_id     ON public.chef_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_chef_profiles_handle      ON public.chef_profiles(handle);
CREATE INDEX IF NOT EXISTS idx_chef_profiles_is_approved ON public.chef_profiles(is_approved);

CREATE TABLE IF NOT EXISTS public.chef_applications (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER     NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bio            TEXT        NOT NULL,
  sample_links   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  reviewer_notes TEXT,
  reviewed_at    TIMESTAMP,
  submitted_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chef_applications_user_id ON public.chef_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_chef_applications_status  ON public.chef_applications(status);

-- A user can have at most one pending application at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chef_applications_one_pending_per_user
  ON public.chef_applications(user_id)
  WHERE status = 'pending';

-- Auto-bump updated_at on chef_profiles row updates.
CREATE OR REPLACE FUNCTION public.update_chef_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_chef_profiles_updated_at ON public.chef_profiles;
CREATE TRIGGER trigger_chef_profiles_updated_at
  BEFORE UPDATE ON public.chef_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chef_profiles_updated_at();
