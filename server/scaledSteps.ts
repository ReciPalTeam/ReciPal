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

interface ScaledStepsResult {
  steps: StepObject[];
  cook_time_minutes: number;
  calories_per_serving: number;
  protein_per_serving: number;
  carbs_per_serving: number;
  fat_per_serving: number;
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

  const { data: cached } = await supabase
    .from("recipe_steps_variants")
    .select("steps, cook_time_minutes")
    .eq("recipe_id", recipeId)
    .eq("servings", desiredServings)
    .maybeSingle();

  if (cached) {
    const { data: nutritionRow } = await supabase
      .from("recipe_nutrition_totals")
      .select("calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, servings")
      .eq("recipe_id", recipeId)
      .maybeSingle();

    const storedServings = nutritionRow?.servings ?? 1;
    return {
      steps: cached.steps as StepObject[],
      cook_time_minutes: cached.cook_time_minutes,
      calories_per_serving: roundToOneDecimal(
        ((nutritionRow?.calories_per_serving ?? 0) * storedServings) / desiredServings
      ),
      protein_per_serving: roundToOneDecimal(
        ((nutritionRow?.protein_per_serving ?? 0) * storedServings) / desiredServings
      ),
      carbs_per_serving: roundToOneDecimal(
        ((nutritionRow?.carbs_per_serving ?? 0) * storedServings) / desiredServings
      ),
      fat_per_serving: roundToOneDecimal(
        ((nutritionRow?.fat_per_serving ?? 0) * storedServings) / desiredServings
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

  const sourceServings = recipeRow.servings ?? 1;
  const cookTimeMinutes = recipeRow.cook_time_minutes ?? 0;
  const scaleType = recipeRow.cook_time_scale_type as ScaleType | null;
  const originalSteps = (recipeRow.steps as StepObject[]) || [];

  const storedNutritionServings = nutritionRow?.servings ?? sourceServings;
  const scaledCalories = roundToOneDecimal(
    ((nutritionRow?.calories_per_serving ?? 0) * storedNutritionServings) / desiredServings
  );
  const scaledProtein = roundToOneDecimal(
    ((nutritionRow?.protein_per_serving ?? 0) * storedNutritionServings) / desiredServings
  );
  const scaledCarbs = roundToOneDecimal(
    ((nutritionRow?.carbs_per_serving ?? 0) * storedNutritionServings) / desiredServings
  );
  const scaledFat = roundToOneDecimal(
    ((nutritionRow?.fat_per_serving ?? 0) * storedNutritionServings) / desiredServings
  );

  const scaledCookTime = computeScaledCookTime(
    cookTimeMinutes,
    sourceServings,
    desiredServings,
    scaleType
  );

  const effectiveScaleType = scaleType || "invariant";

  let parsedSteps: StepObject[];
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a professional recipe editor. You will receive a recipe's original cooking steps, the original serving count, a new desired serving count, and a scale type. Rewrite the steps array so that all ingredient quantities mentioned in the instructions are scaled proportionally to the new serving count. Adjust cook times based on the scale_type: invariant means do not change any cook times; linear_batch means increase cook times proportionally and note batching where needed; weight_based means scale cook times proportionally to total weight; surface_area means apply a cube-root scaling factor to cook times. Preserve the exact JSON structure: each element must have step (number), time (string), equipment (string), and instruction (string). Use common fractions (1/2, 1/4, 3/4) instead of decimals for quantities in instructions. Return ONLY the JSON array with no markdown formatting, no explanation, and no wrapper object.",
        },
        {
          role: "user",
          content: `Original servings: ${sourceServings}\nDesired servings: ${desiredServings}\nScale type: ${effectiveScaleType}\nSteps: ${JSON.stringify(originalSteps)}`,
        },
      ],
      temperature: 0.3,
    });

    const rawContent = completion.choices[0]?.message?.content || "[]";
    let cleanedContent = rawContent.trim();
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    parsedSteps = JSON.parse(cleanedContent);
    if (!Array.isArray(parsedSteps)) {
      throw new Error("GPT response is not an array");
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

  return {
    steps: parsedSteps,
    cook_time_minutes: scaledCookTime,
    calories_per_serving: scaledCalories,
    protein_per_serving: scaledProtein,
    carbs_per_serving: scaledCarbs,
    fat_per_serving: scaledFat,
  };
}
