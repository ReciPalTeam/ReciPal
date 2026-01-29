import type { Recipe } from './mock-data';

interface RecipeBase {
  title?: string;
  cookingStyle?: string;
}

export const CUISINE_KEYWORDS: Record<string, string[]> = {
  "American": [
    "american", "classic", "burger", "bbq", "grill"
  ],
  "Italian": [
    "italian", "pasta", "marinara", "alfredo", "parmesan", "risotto"
  ],
  "Mexican": [
    "mexican", "taco", "tacos", "burrito", "enchilada", "quesadilla", "salsa"
  ],
  "Asian": [
    "asian", "stir fry", "stir-fry", "soy", "teriyaki", "noodle", "ramen"
  ],
  "Mediterranean": [
    "mediterranean", "greek", "tzatziki", "olive oil", "feta", "hummus"
  ],
  "Indian": [
    "indian", "curry", "masala", "tikka", "dal", "naan"
  ],
  "Middle Eastern": [
    "middle eastern", "shawarma", "falafel", "tahini", "kebab"
  ],
  "Caribbean": [
    "caribbean", "jerk", "plantain", "rum", "island"
  ],
  "Southern / Comfort Food": [
    "southern", "comfort", "fried", "gravy", "casserole", "cornbread"
  ],
  "BBQ / Grill": [
    "bbq", "barbecue", "grill", "smoked"
  ],
  "Healthy / Light": [
    "healthy", "light", "low calorie", "salad", "bowl"
  ],
  "Breakfast / Brunch": [
    "breakfast", "brunch", "pancake", "waffle", "omelet", "eggs"
  ],
  "Desserts / Baking": [
    "dessert", "cake", "cookie", "brownie", "baking", "sweet"
  ],
};

export function filterRecipesByCuisine<T extends RecipeBase>(
  recipes: T[],
  selectedCuisines: string[] | null
): T[] {
  if (!selectedCuisines || selectedCuisines.length === 0) {
    return recipes;
  }

  if (recipes.length === 0) {
    return recipes;
  }

  try {
    const allKeywords: string[] = [];
    for (const cuisine of selectedCuisines) {
      const keywords = CUISINE_KEYWORDS[cuisine];
      if (keywords) {
        allKeywords.push(...keywords);
      }
    }

    if (allKeywords.length === 0) {
      return recipes;
    }

    const filtered = recipes.filter((recipe) => {
      const title = recipe.title?.toLowerCase() || '';
      const cookingStyle = recipe.cookingStyle?.toLowerCase() || '';
      const searchableText = `${title} ${cookingStyle}`;

      return allKeywords.some((keyword) => searchableText.includes(keyword));
    });

    if (filtered.length === 0) {
      return recipes;
    }

    return filtered;
  } catch {
    return recipes;
  }
}

export interface UserPreferences {
  cookingComfort?: string;
  costPreference?: string;
  dietaryPreferences?: string[];
  allergies?: string[];
}

export function rankRecipes<T extends RecipeBase>(
  recipes: T[],
  _userPreferences: UserPreferences
): T[] {
  return recipes;
}
