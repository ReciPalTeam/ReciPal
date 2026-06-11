-- Phase M / WS-A4 — drop unused authenticated-role SELECT policies on the recipe catalog.
-- Neither app issues Supabase Auth JWTs (Express sessions + service-role only), so these
-- five leftover policies were pure recipe-theft surface: anyone who self-registered a
-- Supabase Auth user could bulk-read the whole catalog via PostgREST. With them gone,
-- no PostgREST role (anon OR authenticated) can read anything; both apps are unaffected
-- (they connect via the service-role key / owner DATABASE_URL, which bypass RLS).
-- Applied to the live DB 2026-06-11.
DROP POLICY IF EXISTS "ingredient_nutrients_select_authenticated" ON public.ingredient_nutrients;
DROP POLICY IF EXISTS "ingredients_select_authenticated" ON public.ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_select_authenticated" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_nutrition_totals_select_authenticated" ON public.recipe_nutrition_totals;
DROP POLICY IF EXISTS "recipes_select_authenticated" ON public.recipes;
