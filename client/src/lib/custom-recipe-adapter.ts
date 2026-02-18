import type { CustomRecipe } from "@shared/schema";
import type { Recipe } from "@/lib/mock-data";
import logoUrl from "@assets/Recipal_Logo_FILL_1768337767642.png";

export function mapCustomRecipeToFeedRecipe(cr: CustomRecipe): Recipe {
  const ingredients = (cr.ingredients as { name: string; amount: number; unit: string }[]) || [];

  return {
    id: `custom-${cr.id}`,
    title: cr.name,
    image: logoUrl,
    cookTime: "—",
    servings: 1,
    calories: cr.calories,
    protein: cr.protein,
    carbs: cr.carbs,
    fat: cr.fat,
    mealTypes: [],
    cookingStyle: "",
    ingredients: ingredients.map((ing) => ({
      name: ing.name,
      amount: String(ing.amount),
      unit: ing.unit,
    })),
    steps: ingredients.map((ing) => `Add ${ing.amount} ${ing.unit} ${ing.name}`),
  };
}
