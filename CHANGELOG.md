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

_Nothing pending — everything is committed and pushed through `6b24619`._

## Released

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
