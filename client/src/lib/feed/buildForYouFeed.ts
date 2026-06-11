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
  /** Count of "might have" pantry matches; falls back to overlap.mightHave.length when omitted. */
  pantryMaybeCount?: number;
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
  /** Need 0 + Maybe 0 — "Ready to Cook"; heads the injection stream (cell 1 + every 4th). */
  readyList: RecipeWithOverlap[];
  /** Need ≤3 otherwise — "Almost There"; follows Ready in the injection stream
   *  (true almost first, then maybe-involved by Need ASC, Maybe ASC). */
  almostList: RecipeWithOverlap[];
  /** Need ≥4 — the regular ranked feed filling the cells between slots. */
  restList: RecipeWithOverlap[];
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

  // Best-pantry-fit-first within a tier, breaking ties toward the user's comfort style.
  const byFit = (a: RecipeWithOverlap, b: RecipeWithOverlap) => {
    const overlapDiff = b.overlapScore - a.overlapScore;
    if (Math.abs(overlapDiff) > 0.1) return overlapDiff > 0 ? 1 : -1;

    const aComfortMatch = preferredStyles.includes(a.cookingStyle) ? 1 : 0;
    const bComfortMatch = preferredStyles.includes(b.cookingStyle) ? 1 : 0;
    if (aComfortMatch !== bComfortMatch) return bComfortMatch - aComfortMatch;

    return a.id.localeCompare(b.id);
  };

  // Three makeability tiers (matches applyMakeabilityLayout in pages/recipes/index.tsx):
  //  - readyList:  Need 0 AND Maybe 0 — everything confirmed in the pantry.
  //  - almostList: Need ≤3 otherwise — true almost (Maybe 0, Need 1–3) first,
  //                then maybe-involved (Need ASC, Maybe ASC).
  //  - restList:   Need ≥4 — the regular ranked feed.
  // One combined [Ready…, Almost…] stream fills the first cell + every 4th after,
  // until exhausted; rest fills the cells between.
  const maybeOf = (r: RecipeWithOverlap) => r.pantryMaybeCount ?? r.overlap.mightHave.length;
  const isReady = (r: RecipeWithOverlap) => r.pantryMissingCount === 0 && maybeOf(r) === 0;

  const readyList = safeRecipes.filter(isReady).sort(byFit);
  const almostList = safeRecipes
    .filter(r => !isReady(r) && r.pantryMissingCount <= 3)
    .sort((a, b) =>
      // certain (Maybe 0) before maybe-involved, then fewest Need, then fewest Maybe, then fit
      (maybeOf(a) === 0 ? 0 : 1) - (maybeOf(b) === 0 ? 0 : 1) ||
      a.pantryMissingCount - b.pantryMissingCount ||
      maybeOf(a) - maybeOf(b) ||
      byFit(a, b)
    );
  const injectStream = [...readyList, ...almostList];
  const restList = safeRecipes.filter(r => !isReady(r) && r.pantryMissingCount > 3).sort(byFit);

  if (debug) {
    console.log('=== For You Feed Debug ===');
    console.log('User preferences:', {
      cookingComfort: userCookingComfort,
    });
    console.log('readyList (Need 0, Maybe 0):', readyList.map(r => r.title));
    console.log('almostList (Need ≤3 otherwise):', almostList.map(r => ({
      title: r.title,
      missingCount: r.pantryMissingCount,
      maybeCount: maybeOf(r),
    })));
    console.log('restList (Need ≥4) top 10:', restList.slice(0, 10).map(r => ({
      title: r.title,
      overlapScore: r.overlapScore.toFixed(2),
      missingCount: r.pantryMissingCount,
    })));
  }

  const finalFeed: RecipeWithOverlap[] = [];
  let injectIdx = 0;
  let restIdx = 0;
  let position = 0; // 0-based: inject slots at 0, 4, 8, … = 1st cell + every 4th

  while (injectIdx < injectStream.length || restIdx < restList.length) {
    if (position % 4 === 0 && injectIdx < injectStream.length) {
      finalFeed.push({ ...injectStream[injectIdx], isInjected: true });
      injectIdx++;
    } else if (restIdx < restList.length) {
      finalFeed.push(restList[restIdx]);
      restIdx++;
    } else {
      // rest exhausted but makeable recipes remain — keep surfacing them
      finalFeed.push({ ...injectStream[injectIdx], isInjected: true });
      injectIdx++;
    }
    position++;
  }

  return {
    feed: finalFeed,
    readyList,
    almostList,
    restList,
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
