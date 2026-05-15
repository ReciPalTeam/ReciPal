-- Remove the "favorite" engagement from reels. It overlapped with "save", which now
-- additionally adds the reel's linked recipe to user_favorite_recipes (the "My Meals"
-- collection on the Recipes tab) — making Favorite redundant.

-- Clean up any in-flight 'favorite' notifications before they orphan.
DELETE FROM public.notifications WHERE type = 'favorite';

DROP TABLE IF EXISTS public.reel_favorites;

ALTER TABLE public.reels DROP COLUMN IF EXISTS favorite_count;
