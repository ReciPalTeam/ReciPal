# Changelog

All notable changes to ReciPal are recorded here. Format loosely follows [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/); each entry tags the internal **Phase**
label so it can be cross-referenced to the plan file at
`~/.claude/plans/we-want-to-add-steady-snowflake.md`.

Phases group functionally-related work. Sub-phases (H.1, H.2…) are pre-commit checkpoints
within a phase. Anything under **Unreleased** is in the working tree but not yet committed
to `main`.

---

## Unreleased

### Phase H.14 — Recover unlinked ingredient_ids: descriptor-aware re-match (Pass 1)
- **DB relink (no API, accuracy-first)** Added `scripts/relink-descriptor-ingredients.ts` —
  strips a leading non-alphanumeric junk prefix + removes ONLY cosmetic preparation/state
  words that never change nutrition (chopped, grated, shredded, minced, diced, sliced,
  julienned, crushed, freshly, finely, coarsely, thinly, roughly, melted, softened, crumbled,
  packed, lukewarm, chilled, cold, warm, squeezed), then **exact-matches** the cleaned candidate
  against `canonical_name` and writes the `ingredient_id`. Idempotent; audit-logs every pairing.
- Deliberately does NOT strip identity/nutrition-changing words (whole, lean, ground, dried,
  smoked, roasted, toasted, canned, frozen, salted, unsalted, fresh, ripe, cooked, cracked) — so
  "whole milk" never collapses to "milk", "unsalted butter" stays distinct. Bare "hot"/"ice" are
  excluded too (would over-strip "hot sauce"→"sauce", "ice cream"→"cream" in future re-runs).
- **Result: `null_ingredient_id` 944 → 647** (**297 rows / 143 distinct names** linked, **0** wrong
  links — every pairing pre-validated in read-only SQL). Recovered rows now resolve nutrition
  (verified: parmesan/garlic/onion/whole-milk rows join `ingredient_nutrients`).
- Residual ~647 (≈500 distinct): compound multi-ingredient lines ("kosher salt and freshly
  ground black pepper"), brand/novel single ingredients ("duke's mayonnaise", "louisiana hot
  sauce"), and amount-in-name junk ("squeeze of lime") — Pass 2 (FatSecret enrichment) territory,
  gated on review.

### Phase H.13 — Post-bulk-resync recovery + RP2 delete-from-both (done)
- Re-ran `scripts/backfill-recipe-ingredient-ids.ts` — recovered ~120 `ingredient_id` links the
  H.12 `name_hash` re-sync missed (matches on `canonical_name`, catching stale-`name_hash` catalog
  rows). null_ingredient_id ~1,064 → ~944.
- **(RP2 repo, `fad256a`)** `POST /api/recipes/bulk-delete` now also calls
  `deleteRecipesFromSupabase` so deleting from the RP2 recipes page removes the recipe from BOTH
  the RP2 DB and Supabase (recipes + recipe_ingredients + storage objects).

## Released

### 2026-05-30 — Phase H.12: bulk re-sync all syncable RP2 recipes (RP2 `script/bulk-resync-all.ts`)
- Re-ran current RP2 ingestion over **414** syncable recipes (2 skipped: no image; 0 errors).
  Live catalog **272 → 469** recipes. **null_amount 90 → 0**, **junk display_text 17 → 0** across all
  rows. Cleared ReciPal scaling caches (`recipe_steps_variants` / `recipe_ingredients_variants`).
- `null_ingredient_id` rose 455 → 1,064 (expected): +197 new recipes' uncataloged ingredients +
  exact-`name_hash`-only linking. ~120 recoverable (H.13); ~944 are names with no canonical row
  (need ingredient-catalog enrichment — backlog). RP2 `script/bulk-resync-all.ts` is uncommitted.

### 2026-05-30 — Phase H.11: RP2 ingestion fix + ReciPal classifier oils pre-check (`58ea50f` + RP2 `a78a35c`)
- RP2 (`Recipe-Pal-2`, `a78a35c`): cache-independent `ingredient_id` link via `name_hash`,
  category-default amounts written at the source (verbatim mirror of `shared/ingredient-intel.ts`),
  clean `display_text`, units normalized.
- ReciPal (`58ea50f`): classifier definite-oils pre-check ("olive oil" → Oils, not Canned).

### 2026-05-30 — Phase H.10: backfill recipe_ingredient canonical IDs + de-junk display_text (`f002f36`)
- **DB backfill** Linked 519 of 972 NULL-`ingredient_id` `recipe_ingredients` rows to the
  canonical `ingredients` catalog — 478 exact + 41 reviewed-good fuzzy (plurals,
  "shredded mozzarella" → "shredded mozzarella cheese", etc.). 453 left NULL on purpose:
  445 unmatchable by name (brand/compound phrases → RP2/FatSecret pass) + 8 reverted
  false-positives.
- **DB cleanup** Stripped spurious leading numbers from 24 true-junk null-amount `display_text`
  rows ("1 butter" → "butter"). `display_text` is non-rendered post-H.9, so this is
  data-correctness only.
- **Fixed (self-corrected)** An initial over-broad de-junk that corrupted 19 legit rows
  ("1 teaspoon salt" → "teaspoon salt", "0.5 teaspoon Pepper" → "teaspoon Pepper") and 8
  dangerous fuzzy id matches ("salted butter" → "unsalted butter" ×3, "chopped cilantro" →
  a garnish-compound catalog entry ×5) — all reverted. Hardened the script: exact-only
  auto-write, fuzzy candidates logged for manual review, unit-aware de-junk, idempotent
  (verified safe to re-run — re-corrupts nothing).
- **Added** `scripts/backfill-recipe-ingredient-ids.ts` — reuses `matchIngredientByName`
  (`server/lib/ingredient-helpers.ts`). No app runtime code changed.

### 2026-05-30 — Phase H.9: recipe ingredient integrity + hooks-crash fix (`c61ae13`)
- **Added** `shared/ingredient-intel.ts` — single source of truth for the 14-group food
  taxonomy, the `getIngredientFoodGroup` classifier, `normalizeIngredientName`, plus new
  H.9 logic: `DEFAULT_AMOUNT_BY_CATEGORY` (salt/pepper → 0.5 tsp, etc.), `SEASONING_CATEGORIES`,
  `applyIngredientDefault()`, and `scaleMultiplierForIngredient()`. Imported by both client +
  server (`@shared/ingredient-intel`), ending the prior client/server classifier duplication.
- **Added** definite-seasoning pre-check in the classifier so "black pepper", "ground pepper",
  "kosher salt", "celery salt", etc. classify as Spices & Seasonings (previously the broad
  produce keyword "pepper" misrouted them → fixed for both defaulting and Instacart mapping).
- **Changed** `client/src/lib/demo-store.ts` + `client/src/lib/ingredient-categories.ts` — now
  re-export the classifier / food groups from the shared module (no behavior change for clients).
- **Changed** `server/lib/recipeDb.ts` — recipe_ingredients SELECT now fetches `ingredient_id`
  + `display_text`; the mapper applies `applyIngredientDefault` so every ingredient carries a
  real numeric amount + unit (NULL "to taste" salt/pepper → 0.5 tsp). Removed the duplicate
  local `normalizeIngredientName` (now imported from shared).
- **Changed** `server/scaledSteps.ts` — ingredient scaling is now **pure math** (GPT removed
  from amounts): bulk ingredients linear, Spices & Seasonings sub-linear via `0.5 + 0.5*ratio`
  (1.5x at double). The LLM (downgraded GPT-4o → **gpt-4o-mini**) now rewrites ONLY step
  prose + times, given the math-scaled amounts as read-only context. Never coerces null→0.
  Ingredients are recomputed fresh each call (cheap) so stale variant-cache rows can't surface
  the old "0"; only the LLM step output is cached by `(recipe_id, servings)`.
- **Changed** `client/src/pages/recipe/[id].tsx` — servings stepper now steps by **exactly ±1**
  (was stepping by `min_servings || servings`, causing "random" jumps + asymmetric +/-).
  Ingredient amounts render as fractions formatted from the decimal via `formatIngredientAmount`
  (never raw decimals, never "0"). Added a "season to taste" hint when scaled.
- **Changed** `client/src/lib/mock-data.ts` — Recipe ingredient type gains optional
  `ingredient_id` + `display_text`.
- **Fixed** Rules-of-Hooks crash on direct `/recipe/:id` cold load ("Rendered more hooks than
  during the previous render"). 8 cook-flow hooks (`useMemo`/`useEffect`/`useState`) ran AFTER
  the `if (loading)` / `if (!recipe)` early returns, so the hook count changed across the
  loading→loaded transition. Hoisted them above the early returns with `recipe`-null-safety;
  non-hook derived values stay below. Direct recipe links (shareable URLs) now render without
  crashing. (Pre-existing bug, first noted in H.6; fixed here.)
- **DB cleanup** Cleared `recipe_steps_variants` (23 rows) + `recipe_ingredients_variants`
  (4 rows) — stale caches from the pre-H.9 LLM-scaling path. They regenerate on next scale with
  the new math-scaled/dampened amounts (verified: regen produces 0.75 tsp pepper at 2x; 2nd call
  hits the steps cache, ~2.5x faster).
- **Verified** (Playwright + API): salt/pepper default to 1/2 tsp (not "0"); 20/29 ingredients
  carry `ingredient_id`; black pepper scales 0.5→0.75 tsp at 2x (dampened) while pork ribs
  2→4 and brown sugar scale linearly; stepper goes 4→5→6→5; direct cold-load renders without
  hooks crash; Instacart files untouched.

### 2026-05-28 — Phase H.8: structured ingredient pipeline (`6b24619`)
Pushed on top of a partner's 10 dark-mode commits via a clean rebase (zero file overlap).

- **Added** `server/lib/ingredient-helpers.ts` — shared `parseAmount`, `parseUnit`,
  `UNIT_TO_GRAMS`, `ingredientToGrams`, `matchIngredientByName`. Extracted from
  `chefRecipeNutrition.ts` so the nutrition and normalization pipelines have one source.
- **Added** `server/lib/normalize-ingredients.ts` — `normalizeIngredient(raw)` runs each
  ingredient through three stages (parseAmount + vague-phrase fallback → InstacartUnit
  normalization → canonical-name match against `public.ingredients`). Returns
  `{ name, amount, unit, canonicalIngredientId, normalizationConfidence }`. Concurrency 5
  for the list version.
- **Added** `VAGUE_AMOUNT_DEFAULTS` table — maps "pinch/dash" → 0.25 tsp, "to taste" → 1
  tsp, "a few" → 3 each, "a handful" → 0.25 cup, "some" → 1 tbsp.
- **Added** `scripts/normalize-existing-chef-ingredients.ts` — one-shot re-normalization of
  existing `chef_recipes` rows. Idempotent. Prints before/after diff per row. Ran against
  prod, fixed 2 of 2 rows.
- **Changed** `server/lib/recipe-extraction.ts` — system prompt rewritten to forbid
  "to taste" / "a few" / empty strings, instruct GPT to estimate sensible numeric defaults,
  and strip brand names. JSON schema regex-locks `amount` to `^[0-9]+(\\.[0-9]+)?$` and
  enum-locks `unit` to 23 canonical values + `""`. Model upgraded from `gpt-4o-mini` to
  `gpt-4o` for better vague-amount inference.
- **Changed** `server/routes.ts` — wired `normalizeIngredients()` into all three chef-recipe
  write paths: the SSE `/api/reels/extract-recipe` (after GPT, before SSE emit),
  `POST /api/chef-recipes`, and `PUT /api/chef-recipes/:id`.
- **Changed** `server/lib/chefRecipeNutrition.ts` — now imports helpers from
  `ingredient-helpers.ts` (no behavior change).
- **Changed** `/reels` feed layout split into three rows — top strip (`bg-[#FDFCFB]`, matches
  header), scrolling reel area, bottom strip (`bg-white`, matches action bar). Header
  `border-b` + action-bar `border-t` drop on `/reels` only so the feed blends into the chrome.
  (Earlier increments of this shipped in `5bc63bc` + `2ad941c`.)
- **DB migration**: `chef_recipes` ids 10 + 11 had their `ingredients` JSONB normalized in
  place (e.g. `{ russet potatoes, "", "a few large" }` → `{ russet potatoes, "each", "3" }`).

### 2026-05-15 — Phase H ship: reels, chef recipes, creator polish (`af3ef94`)
Bulk-commit of Phases H through H.7. Touched 92 files, +13,340/-267 lines. Follow-up
micro-fixes for the reel feed shipped in `5bc63bc` and `2ad941c`.

- **Added** Chef Creator system end-to-end: chef profile, application flow, approved-chef
  gating, public profile page (`/chef/:handle`), Creator Page (`/chef/me`) with public/stats
  toggle and Settings sheet.
- **Added** Reels feed (`/reels`) with snap-scroll, like/comment/save/share, mute toggle,
  comments sheet, share sheet, "Open Recipe" CTA that routes to chef-recipe or system
  recipe depending on which is attached.
- **Added** Chef recipe CRUD (`chef_recipes` table + `/api/chef-recipes/*` endpoints) with
  GPT extraction from video (`/api/reels/extract-recipe` SSE), photo upload (1:1 square
  crop), and detail page (`/chef-recipe/:id`) mirroring the public recipe detail layout.
- **Added** Reel upload flow at `/chef/upload`: video pick → recipe choice (existing /
  generate) → trim editor (TikTok-style filmstrip + multi-segment cuts) → music picker
  (Pixabay-sourced library) → FFmpeg.wasm processing → fingerprint dedup → Cloudflare
  Stream HLS upload → published reel.
- **Added** Cloudflare Stream status poll worker — reels stay `processing` for ~10–30s
  after upload until CF reports `ready`, then auto-transition to `published`.
- **Added** AcoustID + Chromaprint audio fingerprinting at upload time to block re-uploads
  of copyrighted music.
- **Added** Hashtag persistence + `/hashtag/:tag` discovery page.
- **Added** Notifications system (`/notifications`) + bell badge in the header.
- **Added** FAB radial menu — chef-only 3-option (Add to Pantry / Add Meal-or-Recipe /
  Upload Reel). Non-chefs see the existing 2-option vertical popover.
- **Added** Sentry frontend + backend instrumentation with redacted PII.
- **Added** Per-serving full-nutrition computation for chef recipes
  (`server/lib/chefRecipeNutrition.ts`) — 19 nutrient fields fuzzy-matched against
  `public.ingredients`.
- **Added** Detailed Nutrition accordion, servings stepper, ingredient pantry-status
  badges, swap-ingredient popup, edit/delete affordances on the chef-recipe detail page.
- **Changed** AI-mention copy stripped from user-facing surfaces ("AI extracted" badge
  removed; "AI extraction unavailable" → "Recipe extraction unavailable"; etc.).
- **Changed** Bottom hotbar fixed at Recipes | Reels | + | Planner | Pantry; no more
  mode-based slot swapping. Creator Mode is a navigation destination, not a global toggle.
- **Changed** Build-a-Meal popup for approved chefs gets a "Save to Creator Recipes /
  Personal Recipes" dropdown.

This ship also included these two sub-phases:

#### Phase H.7 — Reel polish + Creator settings UX + global header refactor
- **Added** `client/src/components/avatar-crop-dialog.tsx` — drag/zoom circular cropper
  using `react-easy-crop@5.5.7`. Returns a 512×512 JPEG Blob to the existing
  `/api/chef/me/avatar` endpoint. Added the `react-easy-crop` dependency.
- **Changed** FFmpeg.wasm encode bitrate `1500k` → `3000k` in `client/src/pages/chef/upload/index.tsx`.
  Doubles output quality of new reel uploads; existing CF Stream reels unchanged.
- **Changed** Profile button moved from the hamburger menu to the top bar as an `<Avatar>`
  (chef avatar → user initial fallback). Sits left of the notification bell.
- **Changed** Frosted backgrounds applied to Creator Settings sheet, Comments dialog, and
  Music Picker dialog — `rgba(255,255,255,0.95)` + `blur(20px) saturate(1.5)`. Scoped via
  per-component `style` override; other modals untouched.
- **Changed** 8 title-cased 2-word section titles: "Choose Recipe", "Generate Recipe",
  "Trim & Finalize", "Add Music" (×2 surfaces), "Edit Recipe", "Assign Leftovers",
  "Creator Settings".
- **Fixed** Reel Share button hit target — added `pr-16` to the bottom-overlay title `<p>` +
  chef-bar `<div>` and `z-10` to the right action rail. Long titles no longer occlude the
  Share icon (only the count below survived clicks).

#### Phase H.6 — Steps section parity (location chips + chef-recipe schema widening)
- **Added** per-step `time` and `location` inputs to `RecipeForm` (chef-recipe creation +
  edit). Renders an indented row of two small inputs (Clock + MapPin icons).
- **Changed** `chef_recipes.steps` schema widened from `string[]` to
  `({ instruction, time, location } | string)[]` (`shared/schema.ts`). One-shot SQL
  migration converted the legacy string-shape row into object shape.
- **Changed** Public recipe + share recipe + meal-detail-popup Steps tabs now read
  `step.location` instead of `step.equipment`. DB had 137/138 recipes with `location`
  populated vs 19/138 for `equipment` — flipping the read key unlocks the chip on most
  recipes. `Wrench` icon → `MapPin`.
- **Changed** Chef-recipe detail Steps section now uses green `bg-primary` numbered circles
  (matching public) instead of `bg-recipal-orange`. Renders time + location chips below
  each step when populated.
- **Changed** GPT extraction prompt + JSON schema in `server/lib/recipe-extraction.ts` to
  emit `steps: { instruction, time, location }[]`.
- **Changed** Server validation in POST/PUT `/api/chef-recipes` runs a `sanitizeSteps()`
  helper that accepts both legacy string entries and the new object shape (forward and
  backward compat).
- **Fixed** Recipe step renderers across `recipe/[id].tsx`, `share/recipe/[id].tsx`,
  `meal-detail-popup.tsx`, and `chef-recipe/[id]/index.tsx` to use the same green numbered
  circles + chip styling.

### 2026-05-12 — Allergen + dietary filter overhaul (`cec0ab8`)
- **Added** Structured allergen/dietary filtering using `recipes.allergens` and
  `recipes.dietary_restrictions` columns (with legacy keyword fallback).
- **Added** Ingredient nutrition fields (`weight_grams`, `calories`, `protein_g`, etc.) to
  the ingredient mapping in `server/lib/recipeDb.ts`.
- **Added** `tags` and `passive_time_minutes` to the `Recipe` type.
- **Changed** Default server host to `127.0.0.1` locally (configurable via `HOST` env var).
- **Removed** `Other` dish_type bucket from mock data; replaced with specific categories.

---

## Conventions

- **Phase tags** (`Phase H.x`) cross-reference sections in
  `~/.claude/plans/we-want-to-add-steady-snowflake.md`.
- **Sections** within each phase: `Added`, `Changed`, `Fixed`, `Removed`, `Deprecated`,
  `Security`, `DB migration`.
- **Unreleased** holds anything in the working tree that hasn't been committed yet — move
  entries down into a dated `## Released` section on each commit.
- **No emojis** in changelog entries (per project house style).
