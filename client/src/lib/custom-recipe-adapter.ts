import type { CustomRecipe } from "@shared/schema";
import type { Recipe } from "@/lib/mock-data";
import chefLogoUrl from "@assets/Gemini_Generated_Image_oyofj1oyofj1oyof_1771457665393.png";

export function mapCustomRecipeToFeedRecipe(cr: CustomRecipe): Recipe {
  const ingredients = (cr.ingredients as { name: string; amount: number; unit: string }[]) || [];

  return {
    id: `custom-${cr.id}`,
    title: cr.name,
    image: chefLogoUrl,
    cuisine: "",
    sub_category: null,
    dish_type: "Other",
    prepTime: "—",
    cookTime: "—",
    totalTime: "—",
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
