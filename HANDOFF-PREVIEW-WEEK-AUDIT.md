# Handoff: Preview Your Week / Macro Engine Audit

**Date:** 2026-06-10
**Audience:** Mike (implementing as part of the larger logic pass)
**Scope:** The Planner "Preview Your Week" auto-populate generator, macro-target math, serving-size normalization, the AI serving reducer, recipe pool depth, and goal-tolerance behavior.
**Method:** 10-agent code audit with adversarial verification of every load-bearing claim, plus a read-only query against the live Supabase catalog (2026-06-09). All findings below are verified against source with file:line citations.

---

## 1. Executive summary

1. **The serving-size fear is unfounded for nutrition math.** Recipe macros in the planner pool are stored **per-serving** in the database and flow per-serving end-to-end. A "default 4 servings" recipe contributes exactly one serving's worth of macros at the default servings=1. There is **no 4× inflation** anywhere in the projection. (§3)
2. **The generator does not actually optimize toward macro targets.** It only *penalizes overshoot*; undershooting is completely free and proximity to target is unrewarded. "Optimized for Macros" is really "avoid exceeding macros." Days can come in 800+ kcal under goal with zero penalty. (§4, finding G1)
3. **There is no margin-of-error / tolerance band** anywhere in the generator or planner UI. The only tolerance in the codebase is ±5% in server-side insights, surfaced only on the profile page. The UI actively *hides* overshoot (rings clamp at 100%, remaining clamps at 0). (§7)
4. **Catalog depth is not the problem.** Live DB (2026-06-09): **556 recipes, 100% macro-complete** — Breakfast 95, Lunch 117, Dinner 149, Dessert 88, Snack/Appetizer 46, Side 61 (+36 more via `dish_type='Side Dish'`). The real bottleneck is the **fetch protocol**: the generator receives exactly 7 candidates per meal type for 7 slots — zero headroom — and silently skips slots when filters shrink a batch. (§6, finding G7)
5. **The AI serving reducer's architecture is correct** (the LLM never touches numbers — all ingredient scaling and nutrition is pure code), but it has one nasty production bug: **a failed OpenAI call permanently caches the original unscaled steps under the scaled-servings key**, and `ignoreDuplicates: true` means a later success can never repair it. The CHANGELOG records two manual cache clears — this bug is why. (§5, finding SR1)
6. Several scoring-correctness bugs compound: a hardcoded `servMult = 1` in scoring vs. the real servings multiplier in totals; random jitter applied *before* ranking that can outweigh ~250 kcal of overshoot penalty; and Pro hard caps that ignore the servings multiplier and exempt desserts/snacks. (§4, findings G2–G4)

---

## 2. System context (how the pipeline actually works)

Read this first — it corrects a few assumptions we'd been carrying.

### Data flow

```
Supabase `recipes` ──┐
                     ├── joined ──> recipe_nutrition_totals (*_per_serving columns)
                     │
GET /api/recipes/feed/planner  (server/lib/recipeDb.ts:609-673, getPlannerCandidates)
                     │   .eq('meal_type', X), seen-id exclusion, created_at cursor
                     ▼
mapSupabaseRecipeToCanonical   (recipeDb.ts:194-197, 271-276)
   Recipe.calories  = calories_per_serving   <- PER-SERVING, no division needed
   Recipe.servings  = recipes.servings       <- carried separately (often 4)
                     ▼
client fetch loop              (client/src/pages/planner/index.tsx:494-543)
   BATCH_SIZE=7 per meal type, MAX_FETCH_ITERATIONS=10 (~70 rows scanned max)
   filterRecipes() client-side + applyProHardLimits() for Pro B/L/D
                     ▼
generateWeekPlan()             (client/src/lib/auto-populate.ts:222-393)
   greedy fill 7 days x meal types, scoreRecipe() per slot, no-repeat usedRecipeIds
                     ▼
Confirm Plan                   (planner/index.tsx:643-712, handleConfirmPlan)
   client-only commit: {recipeId, dayIndex, mealType, servings, date}
   -> zustand demo store -> localStorage 'recipal-demo-store'
   NO server call, NO AI call, NO macro snapshot stored
                     ▼
display math everywhere        (client/src/lib/planner-totals.ts:87-90)
   per-serving macros x meal.servings  (consistent with the generator)
```

### Where targets come from

- **Pro users:** `user_profiles.target_calories/protein/carbs/fat`, written by the macro wizard via `POST /api/macro-targets` (server/routes.ts:580-596; storage.ts:416-426). Extracted in `buildUserPrefs()` at planner/index.tsx:426-451.
- **Free users:** `user_profiles.calorie_goal` via the planner's own `PATCH /api/profile` modal (planner/index.tsx:84-96). Calories only — no macro targets.
- Lapsed-Pro edge case: if `targetCalories` is set but the user is no longer Pro and has no `calorieGoal`, generation runs with **no macro guidance at all** (planner/index.tsx:439-450).

### Where the AI serving reducer fits (and doesn't)

`server/scaledSteps.ts` is exposed only as `POST /api/scaled-steps` (routes.ts:2061). Its callers are exactly: the recipe detail page (mount + servings stepper + cook-flow side prefetch) and the planner's MealDetailPopup (when a planned meal's servings differ from the recipe base). **It is never invoked by Preview Your Week generation, scoring, or plan acceptance** — verified by repo-wide grep; `auto-populate.ts` contains zero network code. That's fine, because macro normalization doesn't need it (see §3); the reducer exists to rewrite *cooking instructions* for display.

---

## 3. Verified correct — do NOT "fix" these

These were adversarially verified end-to-end. Building remediation on top of them is safe; re-deriving or "normalizing" them again would introduce bugs.

| Fact | Evidence |
|---|---|
| Pool macros are per-serving | `recipe_nutrition_totals.calories_per_serving` etc. (shared/supabase-types.ts:80-83) mapped with no division at recipeDb.ts:194-197, 271-276 |
| The per-serving columns genuinely contain per-serving values | The H.17 recompute aggregates whole-recipe macros from per-100g ingredient data, then **divides by servings in code** before writing (scripts/recompute-nutrition-totals.ts:104-121); corroborated by nutritionDb.ts:34-43 ("already per-serving") and scaledSteps.ts:79-82 (`per_serving * desiredServings`) |
| Generator and display math agree | `(recipe.x ‖ 0) * servings` identically in auto-populate.ts:289-293 / 409-414 and planner-totals.ts:87-90; pinned by planner-totals.test.ts:88-93 |
| The reducer's LLM never touches numbers | Ingredient amounts scaled in code (scaledSteps.ts:138-148), nutrition in code (67-84), cook time in code (41-61); the gpt-4o-mini call only rewrites step prose ("Do NOT compute, invent, or change any ingredient quantity", line 191) |
| Catalog depth is sufficient | Live DB 2026-06-09: 556 recipes, 556 nutrition rows, 0 macro-incomplete, every meal type 46–149 deep (Breakfast 95, Side 61+36). Note: CHANGELOG's "469" is stale |
| All sources reaching the planner use the same per-serving convention | Supabase (recipeDb), chef recipes (per-serving computed at write time, chefRecipeNutrition.ts:158-163), seed app_recipes ("// Macros per serving", schema.ts:75). Custom recipes are whole-entry totals with hardcoded servings:1 (internally consistent) and **do not enter the planner pool** anyway |

**Residual data risk (D2):** CHANGELOG.md:165-167 records a servings-parsing bug where some multi-serving recipes were stored as `servings=1`, inflating their per-serving macros. The columns are only as correct as that upstream parse. See §8 for the verification query.

---

## 4. Findings — generator & scoring (`client/src/lib/auto-populate.ts`, `client/src/pages/planner/index.tsx`)

Severity legend: **BUG** = math/logic is wrong · **CONCERN** = likely accuracy/UX problem · **INFO** = context Mike should know.

### G1 — BUG: No target-seeking; overshoot-only penalty
**Where:** auto-populate.ts:141-220 (`scoreRecipe`)
**What:** Score starts at 100; +up-to-50 pantry overlap, +30 favorite, −40 reuse. Macro logic subtracts `overshootFraction × 80` (calories) / `× 40` (each macro) **only when** `projected > target` (lines 178-215). At or below target the penalty is exactly 0 — an empty day and a 95%-full day score identically. The generator therefore never *fills toward* a goal; it only avoids exceeding it.
**Remedy:** Replace the one-sided penalty with target-seeking scoring per slot. Recommended shape:
- Define a per-slot calorie budget: `remaining = target − runningTotal`, divided by slots left in the day (this also generalizes the per-meal cap, see G4).
- Score candidates by **proximity to the slot budget**: e.g. `score −= |candidateContribution − slotBudget| / slotBudget × W` (symmetric), with a heavier weight on overshoot than undershoot if desired (e.g. 80 over / 40 under).
- After the day is filled, treat the day as "on goal" inside an explicit tolerance band (see G12) and report it.
- Keep the existing pantry/favorite/reuse terms but make sure their magnitudes can't dominate macro fit (today pantry overlap alone is worth up to 50 points vs. a 10% calorie overshoot worth 8).

### G2 — BUG: `servMult = 1` hardcoded in scoring vs. real servings in totals
**Where:** auto-populate.ts:173 (`const servMult = 1;`, used at 179/187/195/203/210) vs. 289-293 (`servingMultiplier = settings.servings[mealType]`) and 301.
**What:** The running totals the scorer reads ARE servings-multiplied, but the candidate being scored is projected at 1 serving. Users can set servings 1–10 per meal type (planner/index.tsx:124-131 defaults, 816-823 clamp). At servings >1 the scorer understates each candidate's contribution by `(servings−1) × per-serving macros`, so plans systematically overshoot. Verified bug — confirmed by the adversarial pass.
**Remedy:** Thread the multiplier through: `scoreRecipe(..., servMult = settings.servings[mealType])` and use it in every projection. Same for sides (`settings.servings.Side`). One-line semantic fix, but decide G13 (what "servings" means) first.

### G3 — CONCERN: Random jitter before ranking
**Where:** auto-populate.ts:217 (`score += Math.random() * 10;`), winner picked by sort+take-first at 284-286.
**What:** Each candidate draws independent jitter in [0,10) *before* the ranking sort, so any score gap under 10 can flip. On a 2,000-kcal target, overshoots up to 250 kcal (penalty = 12.5% × 80 = 10) are coin flips; macro overshoots up to 25% likewise (weight 40). This also violates the prior fix-prompt mandate "deterministic ranking, randomness only after ranking" (attached_assets/Pasted-TITLE-Fix-Planner-Auto-populate-Week-to-use-ONLY-Supaba_1772412751610.txt:42).
**Remedy:** Remove jitter from the score. For variety, shuffle *only among candidates within ε of the top score after ranking* (e.g. ε = 2-3 points), or seed variety from the regenerate batch cursor instead.

### G4 — BUG: Pro hard caps ignore servings and exempt desserts/snacks
**Where:** auto-populate.ts:429-449 (`applyProHardLimits`, cap = `target / 3` against raw per-serving macros); exemption at planner/index.tsx:516-520 (`isSupplementalType` skips Dessert + Snack/Appetizer).
**What:** Two compounding problems: (a) the cap compares **per-serving** macros, so a 700-kcal recipe passes a 2,100-kcal target's cap and then contributes 1,400 kcal at 2 servings; (b) three at-cap meals already consume 100% of the daily target, so **every enabled dessert, snack, or side mathematically guarantees overshoot**.
**Remedy:** (a) Cap `recipe.x × plannedServings`, not `recipe.x`. (b) Make the cap budget-aware: when desserts/snacks/sides are enabled, reserve headroom — e.g. `cap = target × 0.80 / 3` for mains and give supplemental types their own small budget (10-15% of target each), or derive the per-slot budget dynamically as in G1. (c) Consider applying *some* cap to dessert/snack batches rather than full exemption.

### G5 — CONCERN: Initial generation is blind to the existing week
**Where:** planner/index.tsx:584-591 — `generateWeekPlan(..., [] /* existingMeals */, ...)`; collisions discarded after the fact by `mergePlannerMealsIntoPreview` (484-487).
**What:** The macro scoring for every generated slot never sees the locked/pre-existing meals' calories, so days with heavy existing meals don't get compensating lighter picks. (Regenerate does pass locked meals — see G6.)
**Remedy:** Build `existingMeals` from the current week's planner meals on the *initial* open, exactly as `handleRegenerate` does at planner/index.tsx:619-627.

### G6 — BUG: Locked meals can contribute phantom 0 calories on regenerate
**Where:** auto-populate.ts:234-237 (recipeLookup built from `candidateRecipes` only) + 246-258 (locked seeding: `if (lockedRecipe) {...}` — else adds nothing); planner meals are resolved from `storeRecipes` at planner/index.tsx:467.
**What:** A locked from-planner meal whose recipe exists only in the recipe store (not in the fetch cache) blocks its slot but contributes **0** to the day's running totals — the generator then "fills up to goal" on top of invisible calories.
**Remedy:** Build the lookup from the union of `cachedCandidateRecipes` and `storeRecipes` (pass a merged array or a resolver callback into `generateWeekPlan`).

### G7 — CONCERN: 7-for-7 fetch protocol, forced day-7 picks, silent empty slots
**Where:** planner/index.tsx:161-162 (`BATCH_SIZE = 7`, `MAX_FETCH_ITERATIONS = 10`), 494-543 (fetch loop), auto-populate.ts:275-277 (`if (candidates.length === 0) continue;`), 577-581 (toast only when ALL types are empty), 1532-1534 + 1593-1598 (missing slots render nothing).
**What:** The generator gets at most 7 post-filter candidates per meal type for 7 unique slots (usedRecipeIds blocks repeats) — zero headroom. Day 7's "pick" is whatever single recipe remains (scoring is irrelevant). If client-side filters (G8) or Pro caps eliminate more than the scanned ~70 rows allow, late-week slots are **silently skipped with no message** — the partial-fill empty-state mandated by the prior fix-prompt (attached_assets/...1772418712817.txt:74) was never implemented. Catalog depth is NOT the cause (556 recipes live, every type ≥46 deep); the protocol is.
**Remedy:** (a) Raise `BATCH_SIZE` to 15-20 per type (gives the scorer real choice on late-week days). (b) Implement the partial-fill message: when a type's pool exhausts mid-week, render an explicit empty-slot state ("Not enough matching recipes — adjust preferences") instead of nothing. (c) Track and surface fill rate: `filledSlots / expectedSlots` in the preview header.

### G8 — CONCERN: Planner skips server-side allergen/dietary filtering
**Where:** planner/index.tsx:506 (URL has only `meal_type/offset/limit/exclude`) vs. server support at routes.ts:1378-1380 and recipeDb.ts:621-622; For You sends both params (recipe-store.ts:204-205); client fallback is keyword substring matching only (auto-populate.ts:104-139 — allergy = ingredient-name `.includes()`, diet = hardcoded vegetarian/vegan keyword lists; gluten-free, dairy-free, etc. are not enforced at all).
**What:** Violates the "single shared preference entry point" mandate; planner filtering misses structured allergen tags and any restriction other than vegetarian/vegan, and the weaker filter also shrinks batches client-side (compounding G7).
**Remedy:** Append `allergens` and `dietaryRestrictions` params to the planner fetch URL, matching the For You feed. Keep client `filterRecipes` as a defensive second pass.

### G9 — CONCERN (latent): 0-macro recipes rank artificially high
**Where:** recipeDb.ts:194-197 (`?? 0` defaults); auto-populate.ts:178-215 (overshoot-only penalty → zero macros = zero penalty); 429-449 (passes every hard cap).
**What:** A recipe missing its `recipe_nutrition_totals` row maps to 0 calories/macros, passes every filter, and is *favored* by the scorer. The live catalog is currently 100% complete, so this is latent — but any future ingest without a nutrition row reactivates it.
**Remedy:** Exclude `calories === 0` recipes from the planner candidate pool server-side (or flag them), and add a guard in `getPlannerCandidates`.

### G10 — INFO: `projectedTotals` is dead code with a stale lookup
**Where:** planner/index.tsx — recomputed at 14 call sites (490, 632, 808, 829, 1426, 1434, 1466, 1474, 1614, 1718, 2072, 2076...), never read by any render path; the dialog computes its own `dayTotals` inline at 1539-1548. The dead computation also uses `cachedRecipeLookupMap.current`, which misses store-only recipes.
**Remedy:** Either render it (after fixing the lookup) or delete `projectedTotals` and `calculateProjectedTotals` calls entirely. Don't leave both code paths — they already disagree on rounding (per-meal `Math.round` at 1542-1545 vs. unrounded sums in auto-populate.ts:411-414).

### G11 — CONCERN: Sides are a special weak path
**Where:** auto-populate.ts:305-336 + 341-388 (side selection never adds to `usedRecipeIds` → the same side can repeat all 7 days); planner/index.tsx:572-574 + 612-614 (Side batch never fetched in the initial flow or regenerate — only on toggle, 2048-2056); no UI stepper exists for Side servings (always 1); recipeDb.ts:74-84 (`classifyDishType` **falls back to 'Side Dish'** for any unmatched title, so misclassified mains pollute the Side pool).
**Remedy:** Add sides to `usedRecipeIds` (or allow at most 2 repeats/week); fetch/refresh the Side batch alongside B/L/D; either add a Side servings stepper or document the fixed 1; replace the 'Side Dish' classifier fallback with 'Main' or null.

### G12 — CONCERN: No tolerance band; UI hides overshoot
**Where:** Preview dialog renders raw totals with no goal comparison (planner/index.tsx:1539-1582); rings clamp at 100% (calorie-counter-card.tsx:16, 78; plan.tsx:21, 65); remaining/eaten clamp at 0 (plan.tsx:56, 222; calorie-counter-card.tsx:18) — being 800 kcal over renders identically to exactly on goal. The only real band in the codebase is server-side: `withinPercent(actual, target, 0.05)` (server/insights.ts:119-122), used for profile adherence (≥70% green / ≥40% amber, profile/index.tsx:396).
**Remedy:** Define ONE shared tolerance constant (suggest exporting the ±5% from a shared module so client and insights agree; consider ±10% for generation acceptance vs. ±5% for "perfect day"). Then: (a) in the preview, color each day's totals by band state (under / on-goal / over) against the user's targets; (b) stop clamping — show overshoot ("+230 over") in the ring/remaining displays; (c) use the same band as the generator's per-day acceptance criterion (G1).

### G13 — DECISION NEEDED: What does "servings" mean in the preview?
**Where:** steppers at planner/index.tsx:1361-1390, 1494-1528 under a generation-settings header.
**What:** The math treats `settings.servings[mealType]` as **portions the user will eat** (macros multiply by it). If users read it as **household size / batch to cook**, then every multi-person plan inflates the macro projection N× for a single eater. The two interpretations demand opposite fixes for G2.
**Remedy:** Decide the product semantics, then: if "portions eaten," fix G2 as described and relabel the stepper ("servings you'll eat"); if "household size," macros should NOT multiply by it (track an `eatenPortions` separately) and the stepper feeds only the grocery/cook quantities. This decision gates G1/G2/G4 — make it first.

---

## 5. Findings — AI serving reducer (`server/scaledSteps.ts`, `POST /api/scaled-steps`)

### Architecture (keep it)
Division of labor is correct and should be preserved: ingredient amounts scale in pure code (`ratio = desired/source`, sub-linear `0.5 + 0.5×ratio` for the Spices & Seasonings group via shared/ingredient-intel.ts:322-325); nutrition = `*_per_serving × desiredServings` in code (scaledSteps.ts:67-84); total cook time in code by scale type (41-61). The single gpt-4o-mini call (temp 0.3) only rewrites step prose/times to match pre-computed amounts, with an explicit "Do NOT compute, invent, or change any ingredient quantity" system prompt (line 191). Results cached in Supabase `recipe_steps_variants` keyed `(recipe_id, servings)`.

### SR1 — BUG (top priority): Cache poisoning on LLM failure
**Where:** scaledSteps.ts:215-218 (`catch { parsedSteps = originalSteps; }`) → unconditional upsert at 220-228 with `ignoreDuplicates: true`; cache read short-circuits all future LLM calls at 162-176.
**What:** Any OpenAI failure (network, truncation, bad JSON) permanently caches the ORIGINAL UNSCALED step prose under the scaled-servings key, paired with the math-scaled cook time. `ignoreDuplicates: true` means a later successful rewrite can never replace the poisoned row. CHANGELOG.md:277/339 records two manual cache clears — this bug is the likely cause.
**Remedy:** (a) Do NOT upsert when the LLM path failed — return the fallback to the caller with a `fallback: true` flag but skip the cache write. (b) Change `ignoreDuplicates: true` to an overwrite upsert so re-requests can self-heal. (c) One-time cleanup: delete `recipe_steps_variants` rows whose steps are byte-identical to the recipe's original steps where `servings != recipes.servings`.

### SR2 — CONCERN: No JSON mode, no max_tokens, temp 0.3
**Where:** scaledSteps.ts:185-199.
**What:** gpt-4o-mini supports `response_format: { type: "json_object" }` but it isn't used; no `max_tokens` means a long recipe can truncate mid-JSON (which then trips SR1); temperature 0.3 is non-zero for what should be a deterministic rewrite.
**Remedy:** Add `response_format: { type: "json_object" }`, set `max_tokens` generously (e.g. 4096), drop temperature to 0–0.1.

### SR3 — CONCERN: No validation of the steps payload
**Where:** scaledSteps.ts:201-214 — only `Array.isArray(parsed.steps)` is checked; element shape (step/time/equipment/instruction) never validated, so a JSON-valid but malformed array is returned AND cached.
**Remedy:** Zod-validate each element; on failure treat as LLM failure (and per SR1, don't cache).

### SR4 — CONCERN: Seasoning sub-linear scaling is wrong when scaling DOWN
**Where:** shared/ingredient-intel.ts:317-325 (`0.5 + 0.5 × ratio`), applied at scaledSteps.ts:143-148.
**What:** Designed for scaling up ("doubling adds ~50% more salt") but at 4→1 servings (ratio 0.25) it yields ×0.625 — a single portion gets 62.5% of the FULL 4-serving salt, 2.5× the proportional dose. Directly relevant to the single-person use case this whole feature serves.
**Remedy:** Apply the sub-linear curve only for `ratio > 1`; use proportional (or mildly sub-linear, e.g. `ratio^0.9`) when scaling down.

### SR5 — CONCERN: Indivisible units unhandled
**Where:** scaledSteps.ts:10-13 (round to 2dp only), 143-148 (pure multiply); prompt at 191 forces common fractions (1/2, 1/4, 3/4, 1 1/2).
**What:** 3 eggs ÷ 4 → `0.75 each` → prose says "3/4 egg." The fraction whitelist also can't express thirds (0.33/0.67).
**Remedy:** Unit-aware snapping for each-type units (egg, can, tortilla...): round to nearest whole (min 1) and optionally note "use 1 egg (recipe scales to ¾)". Extend the fraction set with thirds.

### SR6 — CONCERN: Cook-time logic duplicated between code and prompt
**Where:** code-computed authoritative total at scaledSteps.ts:41-61 + 131-136; the prompt separately tells the LLM to adjust per-step times by scale type (incl. "cube-root scaling" mental math).
**What:** Nothing reconciles per-step times against the code total; `weight_based` is also fully linear in code (dubious for roasts — and scaling down linearly can undercook).
**Remedy:** Inject the code-computed scaled total into the prompt and instruct the LLM to keep per-step times consistent with it (or have code post-scale the step times and tell the LLM to leave times alone). Consider `ratio^0.67` for weight_based.

### SR7 — CONCERN: No rate limit; stepper spam fires concurrent LLM calls
**Where:** routes.ts:2061-2079 (no limiter middleware, unlike other AI routes); client abort controllers never passed to `apiRequest` (meal-detail-popup.tsx:62-70; recipe/[id].tsx:193-202, 303-310) so requests run to completion server-side.
**What:** Clicking the servings stepper 1→10 fires up to 10 concurrent gpt-4o-mini calls, all billed, all writing cache rows.
**Remedy:** Add a rate limiter to the route; debounce the stepper (~400ms); pass the abort signal through `apiRequest`.

### SR8 — CONCERN: Zero-nutrition overwrite on display
**Where:** scaledSteps.ts:78-83 (`?? 0` when no nutrition row) and client precedence: recipe/[id].tsx:207-212 + 804-823 (`(scaledNutrition || adjustedNutrition)`), meal-detail-popup.tsx:133-141.
**What:** For any recipe lacking a `recipe_nutrition_totals` row, the API returns all-zero totals and the truthy all-zero object REPLACES correct locally computed values on screen. Latent today (100% coverage) but a trap for future ingests.
**Remedy:** Return `nutrition: null` when no row exists; clients fall back to local math when null.

### SR9 — CONCERN: Fragile index-based ingredient merge
**Where:** server returns ingredients ordered by `sort_order` (scaledSteps.ts:108-112, included per item at 143-148); both clients merge by raw array index (recipe/[id].tsx:253-263; meal-detail-popup.tsx:165-176).
**Remedy:** Merge by `sort_order` (or name) instead of index.

### SR10 — INFO: Dead write-only cache + misleading comment
`recipe_ingredients_variants` is upserted (scaledSteps.ts:232) but never read anywhere; the comment at 230-231 claiming repeat requests "skip both the math and the LLM" is false for the math (recomputed every call, by design per 92-94). Delete the table writes or implement the read — don't leave the lie.

### SR11 — INFO: Cook-flow side prefetch stale-dep
recipe/[id].tsx:298-326 — effect deps are `[cookMealId, cookFlowSideRecipes.length]`; swapping one side for another (same count) leaves stale enriched steps. Use a stable key of side ids.

---

## 6. Findings — data model & catalog

### D1 — CONCERN: Two independent `servings` columns can drift
The recompute script divides by `recipe_nutrition_totals.servings` (scripts/recompute-nutrition-totals.ts:42-47, 104-121) while the client displays `recipes.servings` (recipeDb.ts:271). Nothing reconciles them. **Remedy:** verification query in §8; long-term, make `recipes.servings` the single source and drop/sync the other.

### D2 — INFO: Known inflated per-serving rows
CHANGELOG.md:165-167 — a servings-parse bug stored some multi-serving recipes as `servings=1`, inflating per-serving macros. Re-audit (query in §8).

### D3 — INFO: Out-of-pool sources
Custom recipes: whole-entry ingredient sums with adapter-hardcoded `servings: 1` (custom-recipe-adapter.ts:18-22) — internally consistent. Chef recipes: per-serving at write time, but `nutrition: null` → adapter falls back to ALL ZEROS (chef-recipe-adapter.ts:40-44). Neither enters the planner pool today; if the larger logic pass adds them, G9 and the zero-fallback both apply.

### D4 — INFO: Null `meal_type` rows are invisible to the planner
`getPlannerCandidates` filters `.eq('meal_type', X)` (recipeDb.ts:639), so null-meal_type rows can never be candidates (the canonical mapper's null→'Dinner' fallback at 253-259 only affects other surfaces).

---

## 7. Findings — totals, tolerance & adjacent (context for the larger logic pass)

These are outside the generator proper but were verified during the audit and intersect Mike's logic pass:

- **T1 — The only tolerance band:** `withinPercent(actual, target, 0.05)` (server/insights.ts:119-122) defines a calorie/macro "hit" for all insights; profile colors adherence green ≥70 / amber ≥40 (profile/index.tsx:396). Adherence divides by a fixed 7, so untracked days count as misses (insights.ts:512-513).
- **T2 — CONCERN: The "macro adherence" regression test doesn't test adherence.** auto-populate.test.ts:753-755 only asserts weekly average calories are `> 0` and `< 2× target` — a 99% overshoot passes. The original spec demanded ±10% per day. **Remedy:** once G1/G12 land, assert each generated day is within the band (with a documented allowance for legitimately unfillable days).
- **T3 — CONCERN: Two pages disagree on "eaten today."** planner/index.tsx:280-302 uses state-gated `computeDayTotals` + consumption logs; plan.tsx:169-190 sums only cooked planner slots via `servingMultiplier || 1` and ignores logs (manual entries invisible). Unify on `computeDayTotals`.
- **T4 — CONCERN: Midnight rollover writes no consumption logs.** planner-rollover.ts:81-86 flips past scheduled meals to `autoCounted` (counted client-side) but never writes a log; server insights are log-driven (insights.ts:140), so client totals and server adherence diverge for auto-counted days. Decide one source of truth.
- **T5 — CONCERN: Nutrition memo cache key omits recipeId.** planner-totals.ts:67-69 keys by `mealId:servings:swapHash`; if a meal's recipe is ever replaced in place, stale macros serve until FIFO eviction. Add recipeId to the key (cheap, do it regardless).
- **T6 — INFO: Plan persistence is localStorage-only.** The whole planner lives in the zustand demo store (`recipal-demo-store`); confirming a plan also silently auto-adds every ingredient to the cart (demo-store.ts:628-631, 765-768) and silently replaces occupied slots with different recipes (planner/index.tsx:658-669). The Postgres planMeals/weeklyPlans tables exist but are unwired. Relevant if the logic pass includes server sync.

---

## 8. DB verification queries (run before/with the data fixes)

```sql
-- D1: servings drift between the two columns
SELECT r.recipe_id, r.servings AS recipe_servings, t.servings AS totals_servings
FROM recipes r JOIN recipe_nutrition_totals t USING (recipe_id)
WHERE r.servings IS DISTINCT FROM t.servings;

-- D2: suspicious per-serving macros (likely servings mis-parse)
SELECT recipe_id, calories_per_serving FROM recipe_nutrition_totals
WHERE calories_per_serving > 1200 ORDER BY calories_per_serving DESC;

-- G9 guard: macro-incomplete rows (should be zero today)
SELECT r.recipe_id FROM recipes r
LEFT JOIN recipe_nutrition_totals t USING (recipe_id)
WHERE t.recipe_id IS NULL OR t.calories_per_serving IS NULL OR t.calories_per_serving = 0;

-- G11: how polluted is the Side pool by the classifier fallback
SELECT dish_type, COUNT(*) FROM recipes GROUP BY 1;

-- SR1 cleanup candidates: cached variants identical to original steps
-- (compare recipe_steps_variants.steps to recipes' original steps where servings differ)
```

Reference counts from the 2026-06-09 read-only check: 556 recipes / 556 nutrition rows / 0 incomplete; Breakfast 95, Lunch 117, Dinner 149, Dessert 88, Snack/Appetizer 46, Side 61 (+36 dish_type='Side Dish').

---

## 9. Suggested implementation order

| Phase | Items | Why first |
|---|---|---|
| **P0 — stop active damage** | SR1 (cache poisoning) + SR2 (JSON mode/max_tokens/temp) + SR1c cleanup script | Production bug, already required two manual cache clears; small contained diff |
| **P0 — decide semantics** | G13 (servings meaning) | Gates the correct fix for G1/G2/G4 |
| **P1 — make "Optimized for Macros" true** | G1 (target-seeking + slot budgets), G12 (shared ±band + preview day states + unclamp overshoot), G2 (servMult), G3 (jitter after ranking), G4 (caps × servings, supplemental budgets) | The core of the user-facing promise; all in auto-populate.ts + preview dialog |
| **P2 — pool & fill integrity** | G7 (BATCH_SIZE 15-20 + partial-fill message), G8 (server-side allergen/diet params), G5 (pass existing meals on initial open), G6 (merged recipe lookup), G9 (exclude 0-macro server-side) | Gives the new scorer real choice and makes failures visible |
| **P3 — reducer quality** | SR4 (down-scale seasoning), SR5 (whole-unit snapping), SR6 (cook-time reconciliation), SR7 (rate limit + debounce), SR3 (validation), SR8 (null nutrition), SR9 (merge by sort_order) | Quality-of-output for the single-serving cook experience |
| **P4 — hygiene** | G10 (dead projectedTotals), G11 (sides path), SR10/SR11, D1/D2 queries + fixes, T2 (real adherence test), T5 (cache key) | Cleanup + regression protection |

### Acceptance criteria for the P1 core
- Generating a week for a Pro user with targets (e.g. 2,200 kcal / 165P / 220C / 73F) yields ≥6 of 7 days within the agreed band (suggest ±10%) at servings=1, and the preview labels each day under/on/over.
- Same generation at servings=2 stays within band relative to `target` (scorer and caps both servings-aware).
- Free-tier (calorieGoal only) behaves the same on calories.
- Regenerating with locked meals respects their full macro contribution (no phantom zeros).
- A vegan + nut-allergy user gets either a full week or explicit per-slot "not enough matching recipes" states — never silent holes.
- Unit tests assert per-day band adherence (replacing the `< 2×` placeholder, auto-populate.test.ts:753-755).

---

## 10. Things NOT to do

- **Don't divide pool macros by `recipe.servings` anywhere in the planner path** — they're already per-serving (§3). Doing so would undercount 4-serving recipes by 4×.
- **Don't route plan generation through the AI reducer** — macro normalization doesn't need it, it would add latency/cost/failure modes, and the reducer's job is step prose, not nutrition.
- **Don't ask the LLM to compute nutrition or quantities** — the current "LLM never touches numbers" boundary is the best property of scaledSteps.ts; keep it.
- **Don't trust the CHANGELOG's "469 recipes"** — the live catalog was 556 on 2026-06-09.
