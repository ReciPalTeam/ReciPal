import type { ChefRecipe } from "@/hooks/use-chef-recipes";
import type { Recipe } from "@/lib/mock-data";

/**
 * Convert a chef-authored recipe to the shape consumed by the For You feed `<RecipeCard>` and
 * `/recipe/[id]` detail layout so chef recipes render with the same UI primitives.
 *
 * - id is prefixed `chef:<number>` so click handlers can branch on prefix and route
 *   to /chef-recipe/<id> instead of /recipe/<id>.
 * - Macros come from the chef_recipes.nutrition column (populated by
 *   server/lib/chefRecipeNutrition.ts). Falls back to 0 when null.
 * - Fields that don't exist on chef recipes (cuisine, dish_type, mealTypes,
 *   cookingStyle) are empty strings / empty arrays — consumers render empty
 *   placeholders rather than broken UI.
 */
export const CHEF_RECIPE_ID_PREFIX = "chef:" as const;

export function isChefRecipeId(recipeId: string): boolean {
  return recipeId.startsWith(CHEF_RECIPE_ID_PREFIX);
}

export function extractChefRecipeId(recipeId: string): number | null {
  if (!isChefRecipeId(recipeId)) return null;
  const n = Number(recipeId.slice(CHEF_RECIPE_ID_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

export function chefRecipeToRecipe(c: ChefRecipe): Recipe {
  const tm = (mins: number | null | undefined) => (mins != null && mins > 0 ? `${mins} min` : "");
  return {
    id: `${CHEF_RECIPE_ID_PREFIX}${c.id}`,
    title: c.title,
    image: c.photoUrl ?? "",
    cuisine: "",
    sub_category: null,
    dish_type: "",
    prepTime: tm(c.prepTimeMinutes),
    cookTime: tm(c.cookTimeMinutes),
    totalTime: tm(c.totalTimeMinutes),
    servings: c.servings ?? 1,
    calories: c.nutrition?.calories ?? 0,
    protein: c.nutrition?.protein ?? 0,
    carbs: c.nutrition?.carbs ?? 0,
    fat: c.nutrition?.fat ?? 0,
    mealTypes: [],
    cookingStyle: "",
    ingredients: c.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
    })),
    steps: c.steps.map((s, idx) => {
      if (typeof s === "string") return s;
      return {
        step: idx + 1,
        time: s.time ?? "",
        location: s.location ?? "",
        instruction: s.instruction,
      };
    }),
    total_time_minutes: c.totalTimeMinutes ?? undefined,
    prep_time_minutes: c.prepTimeMinutes ?? undefined,
    cook_time_minutes: c.cookTimeMinutes ?? undefined,
    passive_time_minutes: c.passiveTimeMinutes ?? undefined,
  };
}
