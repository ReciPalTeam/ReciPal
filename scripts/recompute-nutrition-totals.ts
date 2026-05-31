import { getSupabaseClient } from "../server/lib/supabaseServer";
import { ingredientToGrams } from "../server/lib/ingredient-helpers";

/**
 * Phase H.17 Phase 0 — SAFE recompute of `recipe_nutrition_totals` from the current clean+linked
 * Supabase data, WITHOUT touching `recipe_ingredients` (so the H.14 Pass-3 splits + verbose-canonical
 * cleanup are NOT regressed — a naive RP2 bulk re-sync would have regressed them).
 *
 * The stored per-serving base macros pre-date the H.14–16 linking (calculated_at ≤ 2026-05-28,
 * avg match_rate 0.955), so they understate recipes that gained ingredient links. This recomputes
 * each recipe's per-serving base macros by aggregating `ingredient_nutrients` over its linked
 * `recipe_ingredients` — the SAME method `nutritionDb.ts:getDetailedNutrition` already uses for the
 * extended panel — so the stored base macros and the live extended panel finally agree.
 *
 * Weight per ingredient: stored `weight_grams` when present (the RP2-computed value); otherwise
 * `ingredientToGrams({name, amount, unit})` (covers rows linked by H.14 passes that have no stored
 * weight). Rows whose weight can't be derived (unknown unit) contribute 0 — same as today.
 *
 * USAGE:
 *   DRY_RUN=1 node --env-file=.env --import tsx scripts/recompute-nutrition-totals.ts   # preview
 *   node --env-file=.env --import tsx scripts/recompute-nutrition-totals.ts             # apply
 */

const DRY_RUN = process.env.DRY_RUN === "1";
const PAGE = 1000;

interface Agg {
  calories: number; protein: number; carbs: number; fat: number;
  saturatedFat: number; fiber: number; sugar: number; sodium: number; cholesterol: number;
  total: number; matched: number;
}
const emptyAgg = (): Agg => ({ calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0, total: 0, matched: 0 });

async function main() {
  const sb = getSupabaseClient();
  console.log(`=== Phase H.17.0 recompute recipe_nutrition_totals ${DRY_RUN ? "(DRY RUN — no writes)" : ""} ===\n`);

  // 1. Load servings per recipe from the totals table (also the set of recipes to update).
  const totals = new Map<string, { servings: number; oldCal: number | null }>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("recipe_nutrition_totals")
      .select("recipe_id, servings, calories_per_serving")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`load totals: ${error.message}`);
    const rows = data ?? [];
    for (const r of rows as any[]) totals.set(r.recipe_id, { servings: r.servings || 1, oldCal: r.calories_per_serving });
    if (rows.length < PAGE) break;
  }
  console.log(`[totals] ${totals.size} recipes with a nutrition-totals row.`);

  // 2. Stream all recipe_ingredients (+ joined per-100g nutrients), aggregate per recipe.
  const aggs = new Map<string, Agg>();
  let scanned = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("recipe_ingredients")
      .select(`recipe_id, name, amount, unit, weight_grams, ingredient_id, ingredients ( ingredient_nutrients (*) )`)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`load recipe_ingredients: ${error.message}`);
    const rows = data ?? [];
    for (const ing of rows as any[]) {
      const a = aggs.get(ing.recipe_id) ?? emptyAgg();
      a.total += 1;
      const nutrientData = ing.ingredients?.ingredient_nutrients;
      const n = Array.isArray(nutrientData) ? nutrientData[0] : nutrientData;
      if (ing.ingredient_id && n) {
        a.matched += 1;
        let weightG: number | null = ing.weight_grams && ing.weight_grams > 0 ? ing.weight_grams : null;
        // Only derive weight from amount/unit when there's a REAL measurement unit. An empty unit
        // means a count/ambiguous amount ("beef chuck" amount "500" = mis-parsed 500g, NOT 500
        // each) — treating "" as 100g/each yields catastrophic weights, so skip (contribute 0).
        if (weightG == null && ing.amount != null && ing.unit && String(ing.unit).trim()) {
          const g = ingredientToGrams({ name: ing.name ?? "", amount: String(ing.amount), unit: String(ing.unit) });
          if (g && g > 0 && g <= 2500) weightG = g; // cap absurd single-line weights defensively
        }
        if (weightG && weightG > 0) {
          const s = weightG / 100;
          a.calories += (Number(n.calories_per_100g) || 0) * s;
          a.protein += (Number(n.protein_per_100g) || 0) * s;
          a.carbs += (Number(n.carbs_per_100g) || 0) * s;
          a.fat += (Number(n.fat_per_100g) || 0) * s;
          a.saturatedFat += (Number(n.saturated_fat_per_100g) || 0) * s;
          a.fiber += (Number(n.fiber_per_100g) || 0) * s;
          a.sugar += (Number(n.sugar_per_100g) || 0) * s;
          a.sodium += (Number(n.sodium_mg_per_100g) || 0) * s;
          a.cholesterol += (Number(n.cholesterol_mg_per_100g) || 0) * s;
        }
      }
      aggs.set(ing.recipe_id, a);
    }
    scanned += rows.length;
    if (rows.length < PAGE) break;
  }
  console.log(`[scan] ${scanned} recipe_ingredients rows aggregated.\n`);

  // 3. Per recipe: divide by servings, UPDATE (or preview).
  let updated = 0, materialDelta = 0;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const samples: string[] = [];

  for (const [recipeId, meta] of totals) {
    const a = aggs.get(recipeId) ?? emptyAgg();
    const srv = meta.servings || 1;
    const newCal = Math.round(a.calories / srv);
    const matchRate = a.total > 0 ? a.matched / a.total : 0;
    const oldCal = meta.oldCal != null ? Math.round(Number(meta.oldCal)) : 0;
    if (Math.abs(newCal - oldCal) >= 10) materialDelta++;
    if (samples.length < 20 && Math.abs(newCal - oldCal) >= 10) samples.push(`  ${recipeId.slice(0, 8)}…  cal/serv ${oldCal} → ${newCal}  (match ${a.matched}/${a.total})`);

    if (DRY_RUN) { updated++; continue; }
    const { error } = await sb.from("recipe_nutrition_totals").update({
      calories_per_serving: newCal,
      protein_per_serving: r1(a.protein / srv),
      carbs_per_serving: r1(a.carbs / srv),
      fat_per_serving: r1(a.fat / srv),
      saturated_fat_per_serving: r1(a.saturatedFat / srv),
      fiber_per_serving: r1(a.fiber / srv),
      sugar_per_serving: r1(a.sugar / srv),
      sodium_mg_per_serving: r1(a.sodium / srv),
      cholesterol_mg_per_serving: r1(a.cholesterol / srv),
      ingredients_total: a.total,
      ingredients_matched: a.matched,
      match_rate: r1(matchRate),
      calculated_at: new Date().toISOString(),
    }).eq("recipe_id", recipeId);
    if (error) { console.error(`  [${recipeId}] update failed: ${error.message}`); continue; }
    updated++;
  }

  console.log(`--- Sample of recipes with a material calorie change (≥10/serv): ---`);
  samples.forEach((s) => console.log(s));
  console.log(`\n=== Summary ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  console.log(`  recipes ${DRY_RUN ? "that WOULD be" : ""} updated: ${updated}`);
  console.log(`  recipes with material calorie delta (≥10/serv): ${materialDelta}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error("Fatal:", err); process.exit(1); });
