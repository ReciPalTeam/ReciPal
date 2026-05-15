-- Phase H: chef-authored recipes + reels.chef_recipe_id link + chef-recipe-photos bucket.

CREATE TABLE IF NOT EXISTS public.chef_recipes (
  id                    SERIAL PRIMARY KEY,
  chef_id               INTEGER NOT NULL REFERENCES public.chef_profiles(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  photo_url             TEXT,
  prep_time_minutes     INTEGER,
  cook_time_minutes     INTEGER,
  passive_time_minutes  INTEGER,
  total_time_minutes    INTEGER,
  servings              INTEGER,
  ingredients           JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  source                TEXT  NOT NULL DEFAULT 'manual',           -- 'manual' | 'gpt_extracted' | 'cloned_from_public'
  source_transcript     TEXT,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chef_recipes_chef_id ON public.chef_recipes(chef_id);
CREATE INDEX IF NOT EXISTS idx_chef_recipes_chef_created_at ON public.chef_recipes(chef_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_chef_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_chef_recipes_updated_at ON public.chef_recipes;
CREATE TRIGGER trigger_chef_recipes_updated_at
  BEFORE UPDATE ON public.chef_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_chef_recipes_updated_at();

-- Add link from reels to chef-authored recipe (separate from existing reels.recipe_id which
-- references the system public.recipes table). At most one of the two should be set.
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS chef_recipe_id INTEGER REFERENCES public.chef_recipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reels_chef_recipe_id
  ON public.reels(chef_recipe_id) WHERE chef_recipe_id IS NOT NULL;

-- Storage bucket for chef-recipe photos (uploaded directly OR frame-grabbed from the video).
INSERT INTO storage.buckets (id, name, public)
VALUES ('chef-recipe-photos', 'chef-recipe-photos', TRUE)
ON CONFLICT (id) DO NOTHING;
