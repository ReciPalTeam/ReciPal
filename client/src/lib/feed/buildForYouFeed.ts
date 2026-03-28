export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  mealTypes: string[];
  cookingStyle: string;
  servings: number;
  min_servings?: number;
  prepTime: number;
  cookTime: number;
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  kidFriendly?: boolean;
}

export interface RecipeWithOverlap extends Recipe {
  overlap: {
    have: string[];
    missing: string[];
    mightHave: string[];
  };
  overlapScore: number;
  pantryHaveCount: number;
  pantryMissingCount: number;
  pantryMissingIsSmall: boolean;
  isInjected?: boolean;
}

export interface UserProfile {
  allergies: string[];
  dietaryPreferences: string[];
  cookingComfort: string;
}

export interface Filters {
  mealTypes: string[];
  cookingStyles: string[];
  servingSize: string;
  kidFriendly: boolean;
  timeDifficulty: string;
  dietary: string[];
  allergies: string[];
}

export interface BuildForYouFeedParams {
  recipes: RecipeWithOverlap[];
  userProfile: UserProfile;
  filters?: Filters;
  debug?: boolean;
}

export interface BuildForYouFeedResult {
  feed: RecipeWithOverlap[];
  baseList: RecipeWithOverlap[];
  closeList: RecipeWithOverlap[];
}

export function hasAllergyConflict(recipe: Recipe, allergies: string[]): boolean {
  if (allergies.length === 0) return false;
  const ingredientNames = recipe.ingredients.map(i => i.name.toLowerCase());
  return allergies.some(allergy => {
    const allergyLower = allergy.toLowerCase();
    return ingredientNames.some(ing => ing.includes(allergyLower));
  });
}

export function buildForYouFeed(params: BuildForYouFeedParams): BuildForYouFeedResult {
  const { recipes, userProfile, filters, debug = false } = params;

  const userAllergies = [...(userProfile.allergies || []), ...(filters?.allergies || [])];
  const userCookingComfort = userProfile.cookingComfort || "comfortable";

  const safeRecipes = recipes.filter(
    r => !hasAllergyConflict(r, userAllergies)
  );

  const comfortMap: Record<string, string[]> = {
    quick: ["Quick & Easy"],
    comfortable: ["Balanced", "Meal Prep"],
    involved: ["Healthy Gourmet", "Comfort Food"],
  };
  const preferredStyles = comfortMap[userCookingComfort] || [];

  const baseList = safeRecipes
    .filter(r => !r.pantryMissingIsSmall)
    .sort((a, b) => {
      const overlapDiff = b.overlapScore - a.overlapScore;
      if (Math.abs(overlapDiff) > 0.1) return overlapDiff > 0 ? 1 : -1;
      
      const aComfortMatch = preferredStyles.includes(a.cookingStyle) ? 1 : 0;
      const bComfortMatch = preferredStyles.includes(b.cookingStyle) ? 1 : 0;
      if (aComfortMatch !== bComfortMatch) return bComfortMatch - aComfortMatch;

      return a.id.localeCompare(b.id);
    });

  const closeList = safeRecipes
    .filter(r => r.pantryMissingIsSmall)
    .sort((a, b) => a.pantryMissingCount - b.pantryMissingCount || a.id.localeCompare(b.id));

  const finalFeed: RecipeWithOverlap[] = [];
  let baseIndex = 0;
  let closeIndex = 0;
  const usedIds = new Set<string>();

  if (debug) {
    console.log('=== For You Feed Debug ===');
    console.log('User preferences:', { 
      cookingComfort: userCookingComfort,
    });
    console.log('Top 10 baseList recipes:', baseList.slice(0, 10).map(r => ({
      title: r.title,
      overlapScore: r.overlapScore.toFixed(2),
      missingCount: r.pantryMissingCount,
      cookingStyle: r.cookingStyle,
    })));
    console.log('closeList recipes:', closeList.map(r => ({
      title: r.title,
      missingCount: r.pantryMissingCount,
    })));
  }

  let position = 1;
  while (baseIndex < baseList.length || closeIndex < closeList.length) {
    if (position % 5 === 0 && closeIndex < closeList.length) {
      const recipe = closeList[closeIndex];
      if (!usedIds.has(recipe.id)) {
        finalFeed.push({ ...recipe, isInjected: true });
        usedIds.add(recipe.id);
        closeIndex++;
      }
    } else if (baseIndex < baseList.length) {
      const recipe = baseList[baseIndex];
      if (!usedIds.has(recipe.id)) {
        finalFeed.push(recipe);
        usedIds.add(recipe.id);
      }
      baseIndex++;
    } else if (closeIndex < closeList.length) {
      const recipe = closeList[closeIndex];
      if (!usedIds.has(recipe.id)) {
        finalFeed.push({ ...recipe, isInjected: true });
        usedIds.add(recipe.id);
      }
      closeIndex++;
    }
    position++;
  }

  return {
    feed: finalFeed,
    baseList,
    closeList,
  };
}

export function applyFilters(
  recipes: RecipeWithOverlap[],
  filters: Partial<Filters>,
  searchQuery?: string
): RecipeWithOverlap[] {
  let result = [...recipes];

  if (searchQuery) {
    result = result.filter(r => 
      r.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  if (filters.mealTypes && filters.mealTypes.length > 0) {
    result = result.filter(r => 
      r.mealTypes.some(mt => filters.mealTypes!.includes(mt))
    );
  }

  if (filters.cookingStyles && filters.cookingStyles.length > 0) {
    result = result.filter(r => filters.cookingStyles!.includes(r.cookingStyle));
  }

  if (filters.servingSize && filters.servingSize !== "all") {
    result = result.filter(r => {
      const minServ = r.min_servings || r.servings;
      if (filters.servingSize === "1") return minServ <= 1;
      if (filters.servingSize === "2") return minServ <= 2;
      if (filters.servingSize === "3–4") return minServ <= 4;
      if (filters.servingSize === "5+") return minServ <= 5;
      return true;
    });
  }

  if (filters.allergies && filters.allergies.length > 0) {
    result = result.filter(r => !hasAllergyConflict(r, filters.allergies!));
  }

  return result;
}
