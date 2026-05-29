import { getSupabaseClient } from "./supabaseServer";
import {
  parseAmount as _parseAmount,
  parseUnit as _parseUnit,
  UNIT_TO_GRAMS as _UNIT_TO_GRAMS,
  ingredientToGrams as _ingredientToGrams,
  matchIngredientByName as _matchIngredientByName,
  type IngredientShape,
  type IngredientMatch,
} from "./ingredient-helpers";

// Re-export so external callers of this module that referenced these helpers keep working.
// The new shared module at ingredient-helpers.ts is the source of truth.
const parseAmount = _parseAmount;
const parseUnit = _parseUnit;
const UNIT_TO_GRAMS = _UNIT_TO_GRAMS;
const ingredientToGrams = _ingredientToGrams;
const matchIngredientByName = _matchIngredientByName;

/**
 * Per-serving nutrition for a chef recipe. Mirrors `DetailedNutrition` in
 * `server/lib/nutritionDb.ts` so the chef-recipe detail page can render with the
 * same accordion JSX as the public recipe detail page.
 */
export interface ChefRecipeNutrition {
  // Macros
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // Fats breakdown (g)
  saturatedFat: number;
  polyunsaturatedFat: number;
  monounsaturatedFat: number;
  transFat: number;
  // Sugars & fiber (g)
  fiber: number;
  sugar: number;
  addedSugars: number;
  // Minerals (mg)
  cholesterol: number;
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
  // Vitamins
  vitaminA: number; // mcg
  vitaminC: number; // mg
  vitaminD: number; // mcg
}

// ChefIngredient is the type used by the nutrition pipeline. Identical to IngredientShape
// in ingredient-helpers.ts; alias kept for backward-compatibility with existing callers.
export type ChefIngredient = IngredientShape;

interface FullNutrients {
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  saturated_fat_per_100g: number | null;
  polyunsaturated_fat_per_100g: number | null;
  monounsaturated_fat_per_100g: number | null;
  trans_fat_per_100g: number | null;
  fiber_per_100g: number | null;
  sugar_per_100g: number | null;
  added_sugars_per_100g: number | null;
  cholesterol_mg_per_100g: number | null;
  sodium_mg_per_100g: number | null;
  potassium_mg_per_100g: number | null;
  calcium_mg_per_100g: number | null;
  iron_mg_per_100g: number | null;
  vitamin_a_mcg_per_100g: number | null;
  vitamin_c_mg_per_100g: number | null;
  vitamin_d_mcg_per_100g: number | null;
}

const NUTRIENT_COLS = [
  "calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g",
  "saturated_fat_per_100g", "polyunsaturated_fat_per_100g", "monounsaturated_fat_per_100g", "trans_fat_per_100g",
  "fiber_per_100g", "sugar_per_100g", "added_sugars_per_100g",
  "cholesterol_mg_per_100g", "sodium_mg_per_100g", "potassium_mg_per_100g", "calcium_mg_per_100g", "iron_mg_per_100g",
  "vitamin_a_mcg_per_100g", "vitamin_c_mg_per_100g", "vitamin_d_mcg_per_100g",
].join(", ");

async function fetchNutrients(ingredientId: string): Promise<FullNutrients | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("ingredient_nutrients")
    .select(NUTRIENT_COLS)
    .eq("ingredient_id", ingredientId)
    .limit(1)
    .single();
  return (data as FullNutrients | null) ?? null;
}

/**
 * Best-effort full per-serving nutrition for a chef-authored recipe.
 *
 * For each ingredient: parse amount+unit → grams, fuzzy-match the name against
 * `public.ingredients`, scale that ingredient's per-100g nutrients (19 fields) to the
 * actual gram amount, sum across the recipe, divide by servings.
 *
 * Returns null if zero ingredients could be matched/parsed.
 */
export async function computeChefRecipeNutrition(
  ingredients: ChefIngredient[],
  servings: number,
): Promise<ChefRecipeNutrition | null> {
  if (!ingredients || ingredients.length === 0) return null;
  const denom = servings && servings > 0 ? servings : 1;

  const totals = {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    saturatedFat: 0, polyunsaturatedFat: 0, monounsaturatedFat: 0, transFat: 0,
    fiber: 0, sugar: 0, addedSugars: 0,
    cholesterol: 0, sodium: 0, potassium: 0, calcium: 0, iron: 0,
    vitaminA: 0, vitaminC: 0, vitaminD: 0,
  };
  let matched = 0;

  for (const ing of ingredients) {
    if (!ing?.name) continue;
    const grams = ingredientToGrams(ing);
    if (grams == null || grams <= 0) continue;

    const m = await matchIngredientByName(ing.name);
    if (!m) continue;

    const n = await fetchNutrients(m.ingredient_id);
    if (!n) continue;

    const scale = grams / 100;
    totals.calories            += (n.calories_per_100g ?? 0) * scale;
    totals.protein             += (n.protein_per_100g ?? 0) * scale;
    totals.carbs               += (n.carbs_per_100g ?? 0) * scale;
    totals.fat                 += (n.fat_per_100g ?? 0) * scale;
    totals.saturatedFat        += (n.saturated_fat_per_100g ?? 0) * scale;
    totals.polyunsaturatedFat  += (n.polyunsaturated_fat_per_100g ?? 0) * scale;
    totals.monounsaturatedFat  += (n.monounsaturated_fat_per_100g ?? 0) * scale;
    totals.transFat            += (n.trans_fat_per_100g ?? 0) * scale;
    totals.fiber               += (n.fiber_per_100g ?? 0) * scale;
    totals.sugar               += (n.sugar_per_100g ?? 0) * scale;
    totals.addedSugars         += (n.added_sugars_per_100g ?? 0) * scale;
    totals.cholesterol         += (n.cholesterol_mg_per_100g ?? 0) * scale;
    totals.sodium              += (n.sodium_mg_per_100g ?? 0) * scale;
    totals.potassium           += (n.potassium_mg_per_100g ?? 0) * scale;
    totals.calcium             += (n.calcium_mg_per_100g ?? 0) * scale;
    totals.iron                += (n.iron_mg_per_100g ?? 0) * scale;
    totals.vitaminA            += (n.vitamin_a_mcg_per_100g ?? 0) * scale;
    totals.vitaminC            += (n.vitamin_c_mg_per_100g ?? 0) * scale;
    totals.vitaminD            += (n.vitamin_d_mcg_per_100g ?? 0) * scale;
    matched++;
  }

  if (matched === 0) return null;

  const r1 = (v: number) => Math.round((v / denom) * 10) / 10;
  return {
    calories: Math.round(totals.calories / denom),
    protein: r1(totals.protein),
    carbs: r1(totals.carbs),
    fat: r1(totals.fat),
    saturatedFat: r1(totals.saturatedFat),
    polyunsaturatedFat: r1(totals.polyunsaturatedFat),
    monounsaturatedFat: r1(totals.monounsaturatedFat),
    transFat: r1(totals.transFat),
    fiber: r1(totals.fiber),
    sugar: r1(totals.sugar),
    addedSugars: r1(totals.addedSugars),
    cholesterol: r1(totals.cholesterol),
    sodium: r1(totals.sodium),
    potassium: r1(totals.potassium),
    calcium: r1(totals.calcium),
    iron: r1(totals.iron),
    vitaminA: r1(totals.vitaminA),
    vitaminC: r1(totals.vitaminC),
    vitaminD: r1(totals.vitaminD),
  };
}
