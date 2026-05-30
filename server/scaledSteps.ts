import OpenAI from "openai";
import { getSupabaseClient } from "./lib/supabaseServer";
import { applyIngredientDefault, scaleMultiplierForIngredient } from "@shared/ingredient-intel";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

/** Round a scaled amount to a sensible precision (2 dp) — the client formats the fraction. */
function roundAmount(n: number): number {
  return Math.round(n * 100) / 100;
}

interface StepObject {
  step: number;
  time: string;
  equipment: string;
  instruction: string;
}

interface ScaledIngredient {
  sort_order: number;
  name: string;
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

async function getNutritionTotals(
  supabase: ReturnType<typeof getSupabaseClient>,
  recipeId: string,
  desiredServings: number
) {
  const { data: nutritionRow } = await supabase
    .from("recipe_nutrition_totals")
    .select("calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, servings")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  return {
    total_calories: roundToOneDecimal((nutritionRow?.calories_per_serving ?? 0) * desiredServings),
    total_protein: roundToOneDecimal((nutritionRow?.protein_per_serving ?? 0) * desiredServings),
    total_carbs: roundToOneDecimal((nutritionRow?.carbs_per_serving ?? 0) * desiredServings),
    total_fat: roundToOneDecimal((nutritionRow?.fat_per_serving ?? 0) * desiredServings),
  };
}

export async function getScaledSteps(
  recipeId: string,
  desiredServings: number
): Promise<ScaledStepsResult> {
  const supabase = getSupabaseClient();

  // NOTE: ingredient amounts are recomputed via pure math on every call (cheap, deterministic),
  // so we intentionally do NOT read cached ingredients — that also sidesteps any stale rows
  // written by the old LLM-scaling path. Only the expensive LLM step-rewrite is cached.

  const { data: recipeRow, error: recipeError } = await supabase
    .from("recipes")
    .select("steps, servings, cook_time_minutes, cook_time_scale_type")
    .eq("recipe_id", recipeId)
    .single();

  if (recipeError || !recipeRow) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  const nutrition = await getNutritionTotals(supabase, recipeId, desiredServings);

  const { data: ingredientRows } = await supabase
    .from("recipe_ingredients")
    .select("display_text, amount, unit, name, sort_order")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });

  const sourceServings = recipeRow.servings ?? 1;
  const cookTimeMinutes = recipeRow.cook_time_minutes ?? 0;
  const scaleType = recipeRow.cook_time_scale_type as ScaleType | null;
  const originalSteps = (recipeRow.steps as StepObject[]) || [];
  // Apply the category-aware default so every ingredient carries a real numeric amount + unit
  // (salt/pepper "to taste" → 0.5 tsp, etc.). NEVER coerce null→0. The decimal `amount` is the
  // canonical value; the client formats the fraction at display time.
  const originalIngredients = (ingredientRows || []).map((ing: any, idx: number) => {
    const def = applyIngredientDefault({ name: ing.name || "", amount: ing.amount, unit: ing.unit });
    return {
      name: ing.name || "",
      amount: def.amount,
      unit: def.unit,
      sort_order: ing.sort_order ?? idx,
    };
  });

  const scaledCookTime = computeScaledCookTime(
    cookTimeMinutes,
    sourceServings,
    desiredServings,
    scaleType
  );

  const ratio = sourceServings > 0 ? desiredServings / sourceServings : 1;

  // Ingredient amounts are scaled with PURE MATH — never the LLM. Bulk ingredients scale
  // linearly; "Spices & Seasonings" scale sub-linearly (0.5 + 0.5*ratio) so doubling adds
  // ~50% more salt, not 100% (research-backed). At ratio 1 this is identity.
  const scaledIngredients: ScaledIngredient[] = originalIngredients.map((ing) => ({
    sort_order: ing.sort_order,
    name: ing.name,
    amount: roundAmount(ing.amount * scaleMultiplierForIngredient(ing.name, ratio)),
    unit: ing.unit,
  }));

  // If servings match, no scaling and no LLM needed — return the defaulted originals + steps.
  if (desiredServings === sourceServings) {
    return {
      steps: originalSteps,
      ingredients: scaledIngredients,
      cook_time_minutes: cookTimeMinutes,
      ...nutrition,
    };
  }

  // Steps-only cache: if we've already rewritten the steps for this (recipe, servings), reuse
  // them and pair with the freshly-computed math ingredients — no LLM call needed.
  const { data: cachedSteps } = await supabase
    .from("recipe_steps_variants")
    .select("steps, cook_time_minutes")
    .eq("recipe_id", recipeId)
    .eq("servings", desiredServings)
    .maybeSingle();

  if (cachedSteps) {
    return {
      steps: cachedSteps.steps as StepObject[],
      ingredients: scaledIngredients,
      cook_time_minutes: cachedSteps.cook_time_minutes,
      ...nutrition,
    };
  }

  const effectiveScaleType = scaleType || "invariant";

  // The LLM rewrites ONLY the step prose + times to match the already-math-scaled ingredient
  // amounts. It must NOT compute or change any ingredient quantity — those are authoritative,
  // computed above in pure math. We pass the scaled ingredients as read-only reference.
  let parsedSteps: StepObject[];
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional recipe editor. You receive a recipe's original cooking steps, the FINAL (already-scaled) ingredient list for the new serving count, the original serving count, the new desired serving count, and a scale type. Return a JSON object with ONE key: steps.\n\nCRITICAL: Do NOT compute, invent, or change any ingredient quantity. The ingredient amounts you are given are final and authoritative. Your only job is to rewrite the STEP instructions so the quantities mentioned in the prose match the provided scaled ingredient list, and to adjust cook times based on scale_type.\n\nCook times by scale_type: invariant = keep cook times the same; linear_batch = increase proportionally and note batching; weight_based = adjust proportionally to weight change; surface_area = moderate adjustment via cube-root scaling, mention pan-size changes.\n\nEach step object has: step (integer), time (string like '5 min'), equipment (string), instruction (string). When you mention a quantity in an instruction, use the value from the provided scaled ingredient list, expressed as a common fraction (1/2, 1/4, 3/4, 1 1/2) rather than a raw decimal.\n\nReturn only the JSON object {\"steps\": [...]}. No explanation, no markdown.",
        },
        {
          role: "user",
          content: `Original servings: ${sourceServings}\nDesired servings: ${desiredServings}\nScale type: ${effectiveScaleType}\nFinal scaled ingredients (authoritative, do not change): ${JSON.stringify(scaledIngredients)}\nOriginal steps: ${JSON.stringify(originalSteps)}`,
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
    } else if (Array.isArray(parsed)) {
      parsedSteps = parsed;
    } else {
      throw new Error("GPT response is not a valid object with steps array");
    }
  } catch (gptError) {
    console.error("[scaledSteps] GPT call or parse failed, using original steps:", gptError);
    parsedSteps = originalSteps;
  }

  await supabase.from("recipe_steps_variants").upsert(
    {
      recipe_id: recipeId,
      servings: desiredServings,
      steps: parsedSteps,
      cook_time_minutes: scaledCookTime,
    },
    { onConflict: "recipe_id,servings", ignoreDuplicates: true }
  );

  // Cache the math-scaled ingredients so repeat requests for this (recipe, servings) skip
  // both the math and the LLM.
  await supabase.from("recipe_ingredients_variants").upsert(
    {
      recipe_id: recipeId,
      servings: desiredServings,
      ingredients: scaledIngredients,
    },
    { onConflict: "recipe_id,servings", ignoreDuplicates: true }
  );

  return {
    steps: parsedSteps,
    ingredients: scaledIngredients,
    cook_time_minutes: scaledCookTime,
    ...nutrition,
  };
}
