-- Phase G follow-up: link reels to recipes so the player can show an "Open Recipe" CTA.
-- public.recipes uses string ids (UUIDs), so recipe_id is TEXT. No FK constraint — the
-- recipes table is managed via the Supabase JS client / pipeline, separate from the
-- Drizzle-managed reels lifecycle, and we don't want a cross-system FK that could block
-- recipe deletes for unrelated reasons.

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS recipe_id TEXT;

CREATE INDEX IF NOT EXISTS idx_reels_recipe_id ON public.reels(recipe_id) WHERE recipe_id IS NOT NULL;
