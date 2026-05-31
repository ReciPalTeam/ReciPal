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

_(nothing pending — all merged to `main`)_

## Released

### 2026-05-31 — Phase H.20 — Edit-a-reel (metadata) + Chef favorites (persisted)
- **Edit-a-reel:** new `PUT /api/reels/:id` (owner-only; title/description/linked-recipe; bumps `updatedAt`)
  with proper **hashtag reconcile** — new `reconcileReelHashtags` (`server/lib/hashtags.ts`) diffs the
  description's tags vs the reel's current `reel_hashtags`, adds new (+1 usage) and removes stale
  (delete join rows + decrement `usage_count` floored at 0) so counts stay accurate across edits
  (not the additive `persistReelHashtags`). Client `useUpdateReel` + new `reel-edit-sheet.tsx`
  (title + caption) opened via a **pencil** affordance beside the trash on the `/chef/me` Reels tab.
  (Re-trim / swap-audio is out of scope — needs the full re-encode→CF-Stream→re-fingerprint pipeline.)
- **Chef favorites (fixes a real bug):** the chef-recipe heart was **client-only** (lost on reload).
  Now server-persisted via the existing text-id `userFavoriteRecipes` / `/api/user-favorites/*`
  endpoints (`recipe_id = "chef:<id>"` + payload). New `hooks/use-favorites.ts`
  (`useUserFavoriteIds`/`useUserFavorites`/`useToggleUserFavorite`); the chef-recipe page favorite
  button uses it; the `/favorites` page gained a **"Saved chef recipes"** section (reads the payloads,
  card → `/chef-recipe/:id`, remove via the hook) + a both-sources empty state. Full-app `tsc` clean.

### 2026-05-31 — Phase H.19.1 — Wire reel view tracking (closes the view_count gap)
- **`view_count` was never incremented** (analytics displayed a dead number). Fixed with a real
  event-logged system: new `reel_views` table (one row per `(user, reel)` = **unique viewers**,
  composite PK, cascade FKs, `created_at` log + `idx_reel_views_reel`; migration `0012` applied).
- **`POST /api/reels/:id/view`** (`server/routes.ts`): auth-gated; **skips the creator's own views**;
  in a tx `insert … onConflictDoNothing` then increments `reels.view_count` **only on the first view
  per user** (re-watches never double-count) — mirrors the like/save toggle pattern.
- **Client:** `useRecordReelView()` (`use-reels.ts`, fire-and-forget + live cache patch of the feed
  count); `reel-player.tsx` fires it once a reel has been the active/playing reel for **~1.5s** (a
  dwell threshold that ignores scroll-pasts), once per reel per session. Makes the H.19 Views tile/
  `totalViews` real, and the `created_at` log unlocks views-over-time later. Full-app `tsc` clean.

### 2026-05-31 — Phase H.19 — Chef analytics: fleshed-out creator Stats view
- **`GET /api/chef/analytics` (`server/routes.ts`)** now also returns: `followerCount` (H.17 counter),
  overall `engagementRate` (%), `followerGrowth` + `engagementGrowth` (last 8 ISO weeks, zero-filled,
  from `created_at` on `chef_followers` / `reel_likes`/`saves`/`shares`/`comments` joined to the chef's
  reels via `date_trunc('week', …)`), and a full per-reel `reels[]` (all published, each with an
  engagement rate) alongside `topReels` (now top-5 of that list). Approved-chef-only, unchanged.
- **Stats view (`client/src/pages/chef/me/index.tsx`)**: added a **Followers** tile + **Engagement-rate**
  tile (reused `StatTile` w/ a `suffix` prop), two recharts bar charts (**New followers / week**,
  **Weekly engagement**) with a "Not enough data yet" empty state, and a full **All reels** breakdown
  (views/likes/saves/shares/comments + engagement % per reel). Full-app `tsc` clean.
- **Resolved in H.19.1 (above):** `reels.view_count` is now incremented via real view tracking, so the
  Views tile / `totalViews` are live (was previously a dead counter).

### 2026-05-31 — Phase H.18 — Cook Now for chef recipes + chef-recipe ratings
- **Cook Now (mirrors public, lightweight)** on `client/src/pages/chef-recipe/[id]/index.tsx`: `cookFlowActive`
  state + `handleCookNow` (switches to the Steps tab); the action bar shows **Cook Now** when all
  ingredients are on hand (0 "need"), **I Cooked This!** while cooking, else the existing Add to
  Plan / Add to Cart. Reuses the page's existing step render + servings-scaled ingredients.
- **Chef-recipe ratings (no new table):** reuses `recipe_ratings` keyed by the adapter's `"chef:<id>"`
  text id — the existing `POST /api/recipes/:id/rating` + `getAverageRatings` work as-is. The page now
  shows the average rating + count (`StarRating`) when present.
- **Chef-aware `CookCelebrationModal`:** rating persists to `recipe_ratings` (`chef:<id>`); the
  leftovers step routes to the server plan endpoint (`/api/plan/add-recipe` with `chefRecipeId`, per
  assignment) instead of the demo-store; share links to `/chef-recipe/:id`. Detected via
  `extractChefRecipeId(recipe.id)`, so the public flow is unchanged. Full-app `tsc` clean.

### 2026-05-31 — Phase H.17 — Creator follow system + Discover/Following reels toggle
- **DB:** new `chef_followers` table (composite PK, cascade FKs) + denormalized `chef_profiles.follower_count`
  + a partial unique index for `"follow"` notifications (migration `0011_add_chef_followers.sql`, applied).
- **Backend (`server/routes.ts`):** `POST`/`DELETE /api/chefs/:chefId/follow` (toggle + counter in a tx,
  self-follow blocked, deduped "follow" notification); `GET /api/chef/:handle` now returns `isFollowing` +
  `followerCount`; `GET /api/me/following` (chefs I follow, cursor-paginated); creator-only
  `GET /api/chef/me/followers`; and `GET /api/reels/feed?feed=following` filters to followed chefs.
- **Client:** `hooks/use-follow.ts` (optimistic `useToggleFollow` + `useFollowing`/`useFollowers`);
  Follow/Following button + "{n} followers" on `chef/[handle]` (hidden on own profile via `isOwnProfile`);
  clickable follower count on `chef/me` → `FollowersSheet`; "Following" link on `/profile` (Pro + Free) →
  `FollowingSheet`; new `following-sheet.tsx` + `followers-sheet.tsx` (reuse Sheet + chef-row pattern).
- **Reels toggle:** opaque-white **Discover | Following** segmented control (top-center, every branch),
  `lib/reels-feed-store.ts` Zustand `feedType`, `useReelsFeed(limit, feedType)` → `feed=following`,
  slide-in transition on switch, tailored Following empty-state. Full-app `tsc` clean.

### 2026-05-31 — Phase H.17 Phase 0 — recompute recipe_nutrition_totals (safe, no recipe_ingredients touch)
- Added `scripts/recompute-nutrition-totals.ts`: recomputes per-serving base macros for all **469**
  recipes from the current clean+linked `recipe_ingredients × ingredient_nutrients` (weight = stored
  `weight_grams`, else `ingredientToGrams` **only for real measurement units**), so the totals reflect
  the H.14–16 linking. Does NOT touch `recipe_ingredients` (no regression of Pass 3 / verbose cleanup).
- **match_rate 0.955 → 1.000**; avg cal/serving 636 → 562 (now counts all linked ingredients).
- **Caught + fixed a weight bug:** empty-unit large amounts ("beef chuck" amount "500" = mis-parsed
  500g) were treated as 500×100g → a 32,094 cal/serving outlier. Guarded: the amount/unit weight
  fallback now requires a real measurement unit + caps a single line at 2500g. Re-run → no outliers.
- Aligned `server/lib/nutritionDb.ts` (`getDetailedNutrition`) with the same weight rule so the
  read-time extended panel and the stored base macros both include linked weightless rows consistently.
- KNOWN pre-existing (out of scope, backlog): a few recipes have `servings=1` when they're multi-serving
  (RP2 servings parsing) → inflated per-serving; and the app-wide 240g/cup volume convention over-weights
  dry goods. Neither introduced here.

### 2026-05-31 — name_hash catalog repair (RP2 `script/repair-ingredient-name-hash.ts`)
- Recomputed `ingredients.name_hash = hashName(canonical_name)` (= sha256 of lowercased+trimmed
  canonical_name, via the SAME exported `hashName` the sync uses) for **288** rows that had a NULL
  hash. These were invisible to `upsertIngredient`'s name_hash lookup → caused the
  "duplicate key ingredients_canonical_name_key" warnings on sync and made descriptor links miss.
- **Verified safe + complete:** 0 duplicate canonical_names under `lower(trim)` (so no name_hash
  unique-constraint collision possible), dry-run-previewed, then applied: 288 fixed / 0 failures /
  **NULL name_hash 288 → 0**, no duplicate hashes. Exported `hashName` from `server/supabase-sync.ts`.

### 2026-05-31 — Phase H.16 — Make H.14/H.15 live + follow-ups #1 (verbose-canonical cleanup) & #2 (ingredient-intel sync-check)
- **Merged H.14/H.15 to `main`** on both repos (clean fast-forwards; partner had not diverged).
- **#1 — verbose-canonical cleanup (RP2 `script/cleanup-verbose-canonicals.ts`).** Re-parses each
  verbose `ingredients.canonical_name` ("one 15-ounce can black beans", "loaf french bread") through
  the hardened parser → clean name → re-points its `recipe_ingredients` rows to the clean canonical
  → deletes the orphaned verbose row. Dry-run-gated; a "trustworthy name" guard skips any reduction
  still containing a digit/fragment. **Result: 54 re-pointed, 52 rows moved, 54 orphans deleted, 4
  intentionally skipped; `null_ingredient_id` stays 0; verbose canonicals 58 → 4.**
- **#2 — ingredient-intel drift protection (sync-check, both repos).** Consolidated the duplicated
  cosmetic-descriptor word list into `shared/ingredient-intel.ts` as exported
  `COSMETIC_DESCRIPTOR_WORDS` + `stripCosmeticDescriptors`; the 3 consumers (ReciPal relink script,
  RP2 `supabase-sync` Fix E, RP2 compound resolver) now import it. Added `scripts/sync-ingredient-intel.ts`
  (copies ReciPal→RP2 mirror + writes both `.ingredient-intel.sha`) and `scripts/check-ingredient-intel-sync.ts`
  (wired into `npm run check` in both repos; fails on drift). Verified: both checks pass, drift is
  detected, RP2 parser tests stay 59/59, `tsc` clean in both repos.

### 2026-05-30 — Phases H.13–H.15: ingredient_id recovery (944→0), RP2 parser hardening (merged to `main`)

### Phase H.15 — RP2 parser hardening (durable upstream prevention)
- **`server/utils/parseIngredient.ts` (RP2).** Targeted, fully-tested additions that
  stop the unlinked-ingredient classes at the true source (the scrape-time parser), while keeping
  every existing test green and preserving `parseIngredients`' 1:1 order/length contract:
  - **Word-number amounts** — "one"/"two"/"a"/"dozen"… now parse as the quantity, so
    "one 15-ounce can black beans" → amount 1 (was: whole string stuck in `name`). Guarded so it
    can't swallow a name ("onion" never matches "one ").
  - **Non-parenthetical size descriptor before a container** — "15-ounce can" → prep "15-ounce",
    unit "can", name "black beans". Container-lookahead so "16 ounces pasta" keeps "ounces" as unit.
  - **"zest of X" → "X zest", "juice of X" → "X juice"** (canonical forms that exist in the catalog).
  - **"X or Y" → primary X** (the recipe's default option; the alternative isn't a 2nd ingredient).
  - **`expandSeasoningPairs`** — a NARROW, safe split of "&lt;salt…&gt; and &lt;…pepper&gt;" into two
    ingredients (the dominant compound case), wired into the scrape entry (`jsonLdRecipe.ts`).
    Deliberately does NOT blanket-split " and " — dish names ("macaroni and cheese", "biscuits and
    gravy", "bread and butter pickles") are guarded/untouched (accuracy over recall).
- **Tests:** `parseIngredient.test.ts` 45 → **59** (added word-number, size-descriptor, zest/juice,
  or→primary, and seasoning-pair-split incl. dish-name safety). All green; `tsc` clean.
- Benefits FUTURE scrapes (the sync uses stored parsed names, so existing rows are unaffected —
  they were already fixed by H.14 Pass 1-3). The ~57 verbose canonical names remain a cosmetic
  data wart (correct nutrition) — a targeted re-point cleanup is queued, not yet run.

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
  sauce"), and amount-in-name junk ("squeeze of lime") — handled by Pass 2.
- **Pass 2 — FatSecret enrichment (RP2 `script/enrich-unlinked-ingredients.ts`).** For each
  genuinely-novel single ingredient, reuse the proven sync path: `searchAndCacheIngredient`
  (FatSecret + web, throttled) → `upsertIngredient` (creates the canonical row + nutrients) → link
  every NULL row with that name. **Result: 407/407 candidates enriched+linked, 524 rows linked,
  0 failures → `null_ingredient_id` 647 → 123.** Spot-checked 10 new canonical rows for plausible
  nutrition + category (olive oil 884 kcal/100% fat, kosher salt 0 kcal/40k mg sodium, cotija
  321 kcal/salty, vanilla extract 288 kcal — all sensible, no mis-matches).
- **Pass 3 — compound / prefix-junk resolver (RP2 `script/resolve-compound-ingredients.ts`).**
  Resolves the 123 Pass-2-skipped rows per product decision: "X or Y" → primary (first option);
  prefix junk ("pinch of salt"→salt, "plus 1 tsp kosher salt"→kosher salt, "zest of 1 lime"→lime
  zest, "container whipped topping", adjective-"and" like "boneless and skinless chicken
  breast"→chicken breast) → reduced; **"X and Y" → SPLIT into two rows** so both get nutrition.
  Catalog-first resolve, FatSecret fallback. **Result: 123 linked + 37 split rows inserted, 0
  unresolved → `null_ingredient_id` 123 → 0.** Verified a split: "kosher salt and freshly ground
  black pepper" → two rows (kosher salt + ground black pepper, both Seasonings).
- **NET H.14: `null_ingredient_id` 944 → 0.** Every `recipe_ingredients` row (5,361 incl. splits)
  now resolves nutrition via its canonical FK.
- **Known minor wart (follow-up):** ~57 canonical rows carry a verbose name where the parser left
  the quantity/packaging in `name` before Pass 2 enriched it ("one 15-ounce can black beans",
  "loaf french bread"). Nutrition is CORRECT (FatSecret matched the underlying food); only the
  label is verbose + won't dedupe with a clean name. Proper fix = RP2 parser hardening (extract
  quantity/packaging into amount/unit) + reseed — folded into the parser follow-up rather than a
  redundant manual pass.
- **Root cause + prevention (RP2 `server/supabase-sync.ts`, "Fix E", uncommitted).** The scraper's
  parser (`parseIngredient.ts`) only moves a descriptor to `prep` when it FOLLOWS a comma
  ("onion, diced"); adjective-first phrasing ("diced onion", "grated parmesan cheese") leaves the
  descriptor in `name`. `syncRecipeToSupabase` syncs the stored parsed name (no re-parse), so
  `name_hash` never matched the catalog → NULL — and it recurs on every new scrape / re-sync. Fix:
  the sync loop now retries the `name_hash` link with cosmetic descriptors stripped (verbatim
  mirror of Pass 1's audited word list, `COSMETIC_DESCRIPTOR_WORDS`). Descriptor names now link at
  sync time — durable against re-syncs and new scrapes — without collapsing identity variants.

### Phase H.13 — Post-bulk-resync recovery + RP2 delete-from-both (done)
- Re-ran `scripts/backfill-recipe-ingredient-ids.ts` — recovered ~120 `ingredient_id` links the
  H.12 `name_hash` re-sync missed (matches on `canonical_name`, catching stale-`name_hash` catalog
  rows). null_ingredient_id ~1,064 → ~944.
- **(RP2 repo, `fad256a`)** `POST /api/recipes/bulk-delete` now also calls
  `deleteRecipesFromSupabase` so deleting from the RP2 recipes page removes the recipe from BOTH
  the RP2 DB and Supabase (recipes + recipe_ingredients + storage objects).

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
