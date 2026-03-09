import OpenAI from "openai";
import { getSupabaseClient } from "./lib/supabaseServer";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface StepObject {
  step: number;
  time: string;
  equipment: string;
  instruction: string;
}

interface ScaledIngredient {
  display_text: string;
  amount: number;
  unit: string;
}

interface ScaledStepsResult {
  steps: StepObject[];
  ingredients: ScaledIngredient[];
  cook_time_minutes: number;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

type ScaleType = "invariant" | "linear_batch" | "weight_based" | "surface_area";

function computeScaledCookTime(
  cookTimeMinutes: number,
  sourceServings: number,
  desiredServings: number,
  scaleType: ScaleType | null
): number {
  if (!scaleType || scaleType === "invariant") {
    return cookTimeMinutes;
  }
  const ratio = desiredServings / sourceServings;
  switch (scaleType) {
    case "linear_batch":
      return Math.ceil(desiredServings / sourceServings) * cookTimeMinutes;
    case "weight_based":
      return Math.round(cookTimeMinutes * ratio);
    case "surface_area":
      return Math.round(cookTimeMinutes * Math.pow(ratio, 0.33));
    default:
      return cookTimeMinutes;
  }
}

function roundToOneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function getScaledSteps(
  recipeId: string,
  desiredServings: number
): Promise<ScaledStepsResult> {
  const supabase = getSupabaseClient();

  let cached: any = null;
  const { data: cachedWithIngredients, error: cacheError } = await supabase
    .from("recipe_steps_variants")
    .select("steps, cook_time_minutes, ingredients")
    .eq("recipe_id", recipeId)
    .eq("servings", desiredServings)
    .maybeSingle();

  if (cacheError) {
    const { data: cachedFallback } = await supabase
      .from("recipe_steps_variants")
      .select("steps, cook_time_minutes")
      .eq("recipe_id", recipeId)
      .eq("servings", desiredServings)
      .maybeSingle();
    cached = cachedFallback;
  } else {
    cached = cachedWithIngredients;
  }

  if (cached) {
    const { data: nutritionRow } = await supabase
      .from("recipe_nutrition_totals")
      .select("calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, servings")
      .eq("recipe_id", recipeId)
      .maybeSingle();

    return {
      steps: cached.steps as StepObject[],
      ingredients: (cached.ingredients as ScaledIngredient[]) || [],
      cook_time_minutes: cached.cook_time_minutes,
      total_calories: roundToOneDecimal(
        (nutritionRow?.calories_per_serving ?? 0) * desiredServings
      ),
      total_protein: roundToOneDecimal(
        (nutritionRow?.protein_per_serving ?? 0) * desiredServings
      ),
      total_carbs: roundToOneDecimal(
        (nutritionRow?.carbs_per_serving ?? 0) * desiredServings
      ),
      total_fat: roundToOneDecimal(
        (nutritionRow?.fat_per_serving ?? 0) * desiredServings
      ),
    };
  }

  const { data: recipeRow, error: recipeError } = await supabase
    .from("recipes")
    .select("steps, servings, cook_time_minutes, cook_time_scale_type")
    .eq("recipe_id", recipeId)
    .single();

  if (recipeError || !recipeRow) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  const { data: nutritionRow } = await supabase
    .from("recipe_nutrition_totals")
    .select("calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, servings")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  const { data: ingredientRows } = await supabase
    .from("recipe_ingredients")
    .select("display_text, amount, unit, name")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });

  const sourceServings = recipeRow.servings ?? 1;
  const cookTimeMinutes = recipeRow.cook_time_minutes ?? 0;
  const scaleType = recipeRow.cook_time_scale_type as ScaleType | null;
  const originalSteps = (recipeRow.steps as StepObject[]) || [];
  const originalIngredients = (ingredientRows || []).map((ing: any) => ({
    display_text: ing.display_text || `${ing.amount} ${ing.unit} ${ing.name}`.trim(),
    amount: Number(ing.amount) || 0,
    unit: ing.unit || "",
    name: ing.name || "",
  }));

  const totalCalories = roundToOneDecimal(
    (nutritionRow?.calories_per_serving ?? 0) * desiredServings
  );
  const totalProtein = roundToOneDecimal(
    (nutritionRow?.protein_per_serving ?? 0) * desiredServings
  );
  const totalCarbs = roundToOneDecimal(
    (nutritionRow?.carbs_per_serving ?? 0) * desiredServings
  );
  const totalFat = roundToOneDecimal(
    (nutritionRow?.fat_per_serving ?? 0) * desiredServings
  );

  const scaledCookTime = computeScaledCookTime(
    cookTimeMinutes,
    sourceServings,
    desiredServings,
    scaleType
  );

  const effectiveScaleType = scaleType || "invariant";

  let parsedSteps: StepObject[];
  let parsedIngredients: ScaledIngredient[];
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a professional recipe editor. You will receive a recipe's original cooking steps, original ingredient list, the original serving count, a new desired serving count, and a scale type. Return a JSON object with two keys: 'steps' and 'ingredients'.\n\nFor 'steps': rewrite each step so that all quantities mentioned in the instructions are scaled proportionally to the new serving count. Adjust cook times based on the scale_type: invariant means do not change any cook times; linear_batch means increase cook times proportionally and note batching where needed; weight_based means adjust cook times proportionally to the weight change; surface_area means make moderate time adjustments using cube root scaling and mention using a larger vessel if needed. Preserve the exact JSON structure: each element must have step (number), time (string), equipment (string), and instruction (string). Use common fractions (1/2, 1/4, 3/4) instead of decimals for quantities in instructions.\n\nFor 'ingredients': return each ingredient with its scaled amount. Express all amounts as common fractions or practical measurements — never raw decimals. Use formats like 1/4, 1/2, 3/4, 1 1/2, 2, 3 oz, etc. Each ingredient must have: display_text (string — the full formatted ingredient line like '6 cups cooked white rice'), amount (number), unit (string).\n\nReturn only the JSON object with no explanation or markdown.",
        },
        {
          role: "user",
          content: `Original servings: ${sourceServings}\nDesired servings: ${desiredServings}\nScale type: ${effectiveScaleType}\nIngredients: ${JSON.stringify(originalIngredients)}\nSteps: ${JSON.stringify(originalSteps)}`,
        },
      ],
      temperature: 0.3,
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";
    let cleanedContent = rawContent.trim();
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(cleanedContent);

    if (parsed && typeof parsed === "object" && Array.isArray(parsed.steps)) {
      parsedSteps = parsed.steps;
      parsedIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    } else if (Array.isArray(parsed)) {
      parsedSteps = parsed;
      parsedIngredients = [];
    } else {
      throw new Error("GPT response is not a valid object with steps array");
    }
  } catch (gptError) {
    console.error("[scaledSteps] GPT call or parse failed, using original steps:", gptError);
    parsedSteps = originalSteps;
    parsedIngredients = [];
  }

  const upsertPayload: Record<string, unknown> = {
    recipe_id: recipeId,
    servings: desiredServings,
    steps: parsedSteps,
    cook_time_minutes: scaledCookTime,
  };

  const { error: upsertWithIngredientsError } = await supabase
    .from("recipe_steps_variants")
    .upsert(
      { ...upsertPayload, ingredients: parsedIngredients },
      { onConflict: "recipe_id,servings", ignoreDuplicates: true }
    );

  if (upsertWithIngredientsError) {
    await supabase.from("recipe_steps_variants").upsert(
      upsertPayload,
      { onConflict: "recipe_id,servings", ignoreDuplicates: true }
    );
  }

  return {
    steps: parsedSteps,
    ingredients: parsedIngredients,
    cook_time_minutes: scaledCookTime,
    total_calories: totalCalories,
    total_protein: totalProtein,
    total_carbs: totalCarbs,
    total_fat: totalFat,
  };
}
