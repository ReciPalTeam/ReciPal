import { Recipe, mockRecipes } from './mock-data';
import { PantryItem, MealType, normalizeIngredientName } from './demo-store';

export type AutoPopulateMealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Desserts' | 'Snackitizers';

export interface GenerationSettings {
  addDesserts: boolean;
  addSnackitizers: boolean;
  servings: {
    Breakfast: number;
    Lunch: number;
    Dinner: number;
    Desserts: number;
    Snackitizers: number;
  };
}

export interface PreviewMeal {
  id: string;
  recipeId: string;
  dayIndex: number;
  mealType: AutoPopulateMealType;
  servings: number;
}

export interface UserPreferences {
  allergies: string[];
  dietaryRestrictions: string[];
  cookingComfort: string;
  costPreference: string;
  tools: string[];
}

export interface GeneratedWeek {
  meals: PreviewMeal[];
  projectedTotals: {
    dailyCalories: number[];
    weeklyCalories: number;
    dailyProtein: number[];
    dailyCarbs: number[];
    dailyFat: number[];
    weeklyProtein: number;
    weeklyCarbs: number;
    weeklyFat: number;
  };
}

export function mapRecipeToMealType(recipe: Recipe): AutoPopulateMealType[] {
  const types: AutoPopulateMealType[] = [];
  
  for (const type of recipe.mealTypes || []) {
    const normalized = type.toLowerCase();
    if (normalized === 'breakfast') types.push('Breakfast');
    else if (normalized === 'lunch') types.push('Lunch');
    else if (normalized === 'dinner') types.push('Dinner');
    else if (normalized === 'dessert') types.push('Desserts');
    else if (normalized === 'snack' || normalized === 'appetizer' || normalized === 'bite') {
      types.push('Snackitizers');
    }
  }
  
  return types.length > 0 ? types : ['Dinner'];
}

export function getRecipesForMealType(mealType: AutoPopulateMealType): Recipe[] {
  return mockRecipes.filter(recipe => {
    const mappedTypes = mapRecipeToMealType(recipe);
    return mappedTypes.includes(mealType);
  });
}

export function filterRecipes(
  recipes: Recipe[],
  preferences: UserPreferences
): Recipe[] {
  return recipes.filter(recipe => {
    if (preferences.allergies?.length > 0) {
      const recipeIngredients = recipe.ingredients.map(i => 
        normalizeIngredientName(i.name)
      );
      for (const allergy of preferences.allergies) {
        const allergyNorm = normalizeIngredientName(allergy);
        if (recipeIngredients.some(ing => ing.includes(allergyNorm))) {
          return false;
        }
      }
    }
    
    if (preferences.dietaryRestrictions?.includes('vegetarian')) {
      const meatKeywords = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tuna', 'bacon', 'steak'];
      const hasNonVeg = recipe.ingredients.some(i => 
        meatKeywords.some(m => normalizeIngredientName(i.name).includes(m))
      );
      if (hasNonVeg) return false;
    }
    
    if (preferences.dietaryRestrictions?.includes('vegan')) {
      const animalKeywords = ['chicken', 'beef', 'pork', 'fish', 'egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt'];
      const hasAnimal = recipe.ingredients.some(i => 
        animalKeywords.some(a => normalizeIngredientName(i.name).includes(a))
      );
      if (hasAnimal) return false;
    }
    
    return true;
  });
}

export function scoreRecipe(
  recipe: Recipe,
  pantryItems: PantryItem[],
  preferences: UserPreferences,
  favoriteIds: string[],
  usedRecipeIds: Set<string>
): number {
  let score = 100;
  
  if (pantryItems.length > 0) {
    const pantryNames = pantryItems
      .filter(p => p.state === 'have' || p.state === 'might')
      .map(p => normalizeIngredientName(p.name));
    
    const recipeIngredients = recipe.ingredients.map(i => normalizeIngredientName(i.name));
    const matchCount = recipeIngredients.filter(ing => 
      pantryNames.some(p => p.includes(ing) || ing.includes(p))
    ).length;
    
    const overlapRatio = matchCount / recipeIngredients.length;
    score += overlapRatio * 50;
  }
  
  if (favoriteIds.includes(recipe.id)) {
    score += 30;
  }
  
  const costTier = (recipe as any).costTier || 2;
  const preferredTier = preferences.costPreference === 'budget' ? 1 : 
                        preferences.costPreference === 'premium' ? 3 : 2;
  score -= Math.abs(costTier - preferredTier) * 10;
  
  if (usedRecipeIds.has(recipe.id)) {
    score -= 40;
  }
  
  score += Math.random() * 10;
  
  return score;
}

export function generateWeekPlan(
  settings: GenerationSettings,
  preferences: UserPreferences,
  pantryItems: PantryItem[],
  favoriteIds: string[],
  existingMeals: { dayIndex: number; mealType: string }[]
): GeneratedWeek {
  const meals: PreviewMeal[] = [];
  const usedRecipeIds = new Set<string>();
  
  const mealTypesToGenerate: AutoPopulateMealType[] = ['Breakfast', 'Lunch', 'Dinner'];
  if (settings.addDesserts) mealTypesToGenerate.push('Desserts');
  if (settings.addSnackitizers) mealTypesToGenerate.push('Snackitizers');
  
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    for (const mealType of mealTypesToGenerate) {
      const normalizedMealType = mealType === 'Desserts' ? 'Desserts' : 
                                  mealType === 'Snackitizers' ? 'Snackitizers' : mealType;
      
      const slotOccupied = existingMeals.some(m => 
        m.dayIndex === dayIndex && 
        (m.mealType === mealType || m.mealType === normalizedMealType)
      );
      
      if (slotOccupied) continue;
      
      let candidates = getRecipesForMealType(mealType);
      candidates = filterRecipes(candidates, preferences);
      
      if (candidates.length === 0) continue;
      
      const scoredCandidates = candidates.map(recipe => ({
        recipe,
        score: scoreRecipe(recipe, pantryItems, preferences, favoriteIds, usedRecipeIds)
      }));
      
      scoredCandidates.sort((a, b) => b.score - a.score);
      
      const selectedRecipe = scoredCandidates[0].recipe;
      usedRecipeIds.add(selectedRecipe.id);
      
      meals.push({
        id: `preview-${dayIndex}-${mealType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        recipeId: selectedRecipe.id,
        dayIndex,
        mealType,
        servings: settings.servings[mealType]
      });
    }
  }
  
  const projectedTotals = calculateProjectedTotals(meals, settings.servings);
  
  return { meals, projectedTotals };
}

export function calculateProjectedTotals(
  meals: PreviewMeal[],
  servings: GenerationSettings['servings']
): GeneratedWeek['projectedTotals'] {
  const dailyCalories: number[] = Array(7).fill(0);
  const dailyProtein: number[] = Array(7).fill(0);
  const dailyCarbs: number[] = Array(7).fill(0);
  const dailyFat: number[] = Array(7).fill(0);
  
  for (const meal of meals) {
    const recipe = mockRecipes.find(r => r.id === meal.recipeId);
    if (!recipe) continue;
    
    const servingMultiplier = meal.servings;
    
    dailyCalories[meal.dayIndex] += (recipe.calories || 0) * servingMultiplier;
    dailyProtein[meal.dayIndex] += (recipe.protein || 0) * servingMultiplier;
    dailyCarbs[meal.dayIndex] += (recipe.carbs || 0) * servingMultiplier;
    dailyFat[meal.dayIndex] += (recipe.fat || 0) * servingMultiplier;
  }
  
  return {
    dailyCalories,
    weeklyCalories: dailyCalories.reduce((a, b) => a + b, 0),
    dailyProtein,
    dailyCarbs,
    dailyFat,
    weeklyProtein: dailyProtein.reduce((a, b) => a + b, 0),
    weeklyCarbs: dailyCarbs.reduce((a, b) => a + b, 0),
    weeklyFat: dailyFat.reduce((a, b) => a + b, 0)
  };
}

export function getSwapSuggestions(
  currentRecipeId: string,
  mealType: AutoPopulateMealType,
  preferences: UserPreferences,
  pantryItems: PantryItem[],
  favoriteIds: string[],
  usedRecipeIds: Set<string>,
  limit: number = 6
): Recipe[] {
  let candidates = getRecipesForMealType(mealType);
  candidates = filterRecipes(candidates, preferences);
  
  candidates = candidates.filter(r => r.id !== currentRecipeId);
  
  const scoredCandidates = candidates.map(recipe => ({
    recipe,
    score: scoreRecipe(recipe, pantryItems, preferences, favoriteIds, usedRecipeIds)
  }));
  
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  return scoredCandidates.slice(0, limit).map(c => c.recipe);
}

export function searchRecipesForMealType(
  query: string,
  mealType: AutoPopulateMealType,
  preferences: UserPreferences,
  limit: number = 10
): Recipe[] {
  let candidates = getRecipesForMealType(mealType);
  candidates = filterRecipes(candidates, preferences);
  
  const queryLower = query.toLowerCase();
  const matches = candidates.filter(recipe => 
    recipe.title.toLowerCase().includes(queryLower) ||
    recipe.ingredients.some(i => i.name.toLowerCase().includes(queryLower))
  );
  
  return matches.slice(0, limit);
}
