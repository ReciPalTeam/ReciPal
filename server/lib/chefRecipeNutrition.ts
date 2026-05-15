import { getSupabaseClient } from "./supabaseServer";

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

export interface ChefIngredient {
  name: string;
  amount: string;
  unit: string;
}

// Grams per unit. Volume-based units (cup/tbsp/tsp/ml) treat 1 ml ≈ 1 g — accurate for
// water-based ingredients, off by ~10-20% for oils/honey/etc. Good enough for chef recipe
// macro estimates.
const UNIT_TO_GRAMS: Record<string, number> = {
  "": 100,
  g: 1, grams: 1, gram: 1,
  kg: 1000, kilogram: 1000,
  mg: 0.001,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
  cup: 240, cups: 240,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  pinch: 0.5, dash: 0.5,
  slice: 30, slices: 30,
  piece: 50, pieces: 50,
  clove: 5, cloves: 5,
  whole: 100,
};

function parseAmount(raw: string): number {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return NaN;
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const w = parseInt(mixed[1], 10); const n = parseInt(mixed[2], 10); const d = parseInt(mixed[3], 10);
    return d > 0 ? w + n / d : w;
  }
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) { const n = parseInt(frac[1], 10); const d = parseInt(frac[2], 10); return d > 0 ? n / d : NaN; }
  const n = parseFloat(s);
  if (Number.isFinite(n)) return n;
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    half: 0.5, quarter: 0.25, third: 0.333,
  };
  return words[s] ?? NaN;
}

function parseUnit(raw: string): string {
  return (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
}

function ingredientToGrams(ing: ChefIngredient): number | null {
  const amount = parseAmount(ing.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = parseUnit(ing.unit);
  const gramsPerUnit = UNIT_TO_GRAMS[unit];
  if (gramsPerUnit == null) return null;
  return amount * gramsPerUnit;
}

interface IngredientMatch {
  ingredient_id: string;
  canonical_name: string;
}

async function matchIngredientByName(name: string): Promise<IngredientMatch | null> {
  const supabase = getSupabaseClient();
  const cleaned = name.trim().toLowerCase();
  if (cleaned.length < 2) return null;

  const { data: exact } = await supabase
    .from("ingredients")
    .select("ingredient_id, canonical_name")
    .ilike("canonical_name", cleaned)
    .limit(1);
  if (exact && exact.length > 0) return exact[0];

  const { data: like } = await supabase
    .from("ingredients")
    .select("ingredient_id, canonical_name")
    .ilike("canonical_name", `%${cleaned}%`)
    .limit(10);
  if (like && like.length > 0) {
    like.sort((a, b) => a.canonical_name.length - b.canonical_name.length);
    return like[0];
  }
  return null;
}

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
