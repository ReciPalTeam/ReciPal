import { getSupabaseClient } from './supabaseServer';

export interface DetailedNutrition {
  // Macros
  calories: number;
  protein: number;       // g
  carbs: number;         // g
  fat: number;           // g
  saturatedFat: number;  // g
  polyunsaturatedFat: number; // g
  monounsaturatedFat: number; // g
  transFat: number;      // g
  // Sugars & Fiber
  fiber: number;         // g
  sugar: number;         // g
  addedSugars: number;   // g
  // Minerals (mg)
  cholesterol: number;
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
  // Vitamins
  vitaminA: number;      // mcg
  vitaminC: number;      // mg
  vitaminD: number;      // mcg
}

/**
 * Fetch detailed nutrition for a recipe.
 *
 * Strategy:
 * 1. Use recipe_nutrition_totals for pre-calculated values (calories, protein, carbs, fat,
 *    saturated fat, fiber, sugar, sodium, cholesterol) — these are already per-serving.
 * 2. For extended nutrients (polyunsat fat, monounsat fat, trans fat, added sugars, potassium,
 *    calcium, iron, vitamins), estimate from ingredient_nutrients by deriving weight from
 *    each ingredient's per-ingredient calories vs its calories_per_100g.
 */
export async function getDetailedNutrition(recipeId: string): Promise<DetailedNutrition | null> {
  const supabase = getSupabaseClient();

  // Fetch nutrition totals (pre-calculated per-serving)
  const { data: nutritionTotals, error: ntError } = await supabase
    .from('recipe_nutrition_totals')
    .select('*')
    .eq('recipe_id', recipeId)
    .limit(1)
    .single();

  if (ntError || !nutritionTotals) return null;

  const servings = nutritionTotals.servings || 1;

  // Fetch ingredients with their per-ingredient calories and nutrient profiles
  const { data: ingredients, error: ingError } = await supabase
    .from('recipe_ingredients')
    .select(`
      weight_grams,
      calories,
      ingredients (
        ingredient_nutrients (*)
      )
    `)
    .eq('recipe_id', recipeId);

  // Aggregate extended nutrients from ingredient_nutrients
  let polyunsaturatedFat = 0;
  let monounsaturatedFat = 0;
  let transFat = 0;
  let addedSugars = 0;
  let potassium = 0;
  let calcium = 0;
  let iron = 0;
  let vitaminA = 0;
  let vitaminC = 0;
  let vitaminD = 0;

  if (ingredients && !ingError) {
    for (const ing of ingredients) {
      const nutrientData = (ing as any).ingredients?.ingredient_nutrients;
      if (!nutrientData) continue;
      const n = Array.isArray(nutrientData) ? nutrientData[0] : nutrientData;
      if (!n) continue;

      // Determine weight: use weight_grams if available, otherwise estimate from calories
      let weightG = ing.weight_grams;
      if ((!weightG || weightG <= 0) && ing.calories && n.calories_per_100g && n.calories_per_100g > 0) {
        // Estimate: if ingredient has X calories and nutrient table says Y cal/100g,
        // then weight ≈ (X / Y) * 100
        weightG = (ing.calories / n.calories_per_100g) * 100;
      }
      if (!weightG || weightG <= 0) continue;

      const scale = weightG / 100;

      polyunsaturatedFat += (n.polyunsaturated_fat_per_100g || 0) * scale;
      monounsaturatedFat += (n.monounsaturated_fat_per_100g || 0) * scale;
      transFat += (n.trans_fat_per_100g || 0) * scale;
      addedSugars += (n.added_sugars_per_100g || 0) * scale;
      potassium += (n.potassium_mg_per_100g || 0) * scale;
      calcium += (n.calcium_mg_per_100g || 0) * scale;
      iron += (n.iron_mg_per_100g || 0) * scale;
      vitaminA += (n.vitamin_a_mcg_per_100g || 0) * scale;
      vitaminC += (n.vitamin_c_mg_per_100g || 0) * scale;
      vitaminD += (n.vitamin_d_mcg_per_100g || 0) * scale;
    }
  }

  const round1 = (v: number) => Math.round(v * 10) / 10;
  const round1s = (v: number) => Math.round((v / servings) * 10) / 10;

  return {
    // From recipe_nutrition_totals (already per-serving)
    calories: Math.round(nutritionTotals.calories_per_serving || 0),
    protein: round1(nutritionTotals.protein_per_serving || 0),
    carbs: round1(nutritionTotals.carbs_per_serving || 0),
    fat: round1(nutritionTotals.fat_per_serving || 0),
    saturatedFat: round1(nutritionTotals.saturated_fat_per_serving || 0),
    fiber: round1(nutritionTotals.fiber_per_serving || 0),
    sugar: round1(nutritionTotals.sugar_per_serving || 0),
    sodium: round1(nutritionTotals.sodium_mg_per_serving || 0),
    cholesterol: round1(nutritionTotals.cholesterol_mg_per_serving || 0),
    // From ingredient_nutrients aggregation (need to divide by servings)
    polyunsaturatedFat: round1s(polyunsaturatedFat),
    monounsaturatedFat: round1s(monounsaturatedFat),
    transFat: round1s(transFat),
    addedSugars: round1s(addedSugars),
    potassium: round1s(potassium),
    calcium: round1s(calcium),
    iron: round1s(iron),
    vitaminA: round1s(vitaminA),
    vitaminC: round1s(vitaminC),
    vitaminD: round1s(vitaminD),
  };
}
