import { classifyIngredient, IngredientCategory, getIngredientNutritionEstimate } from './ingredient-classifier';
import { PantryItem } from './demo-store';

export interface SwapSuggestion {
  name: string;
  category: IngredientCategory;
  inPantry: boolean;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

const INGREDIENT_DATABASE: Record<IngredientCategory, string[]> = {
  Protein: [
    'Chicken Breast', 'Chicken Thigh', 'Ground Turkey', 'Ground Beef', 'Salmon Fillet',
    'Tuna Steak', 'Shrimp', 'Cod', 'Tilapia', 'Tofu', 'Tempeh', 'Eggs',
    'Black Beans', 'Chickpeas', 'Lentils', 'Greek Yogurt', 'Cottage Cheese',
    'Pork Tenderloin', 'Lamb Chops', 'Turkey Breast', 'Crab Meat', 'Scallops',
    'Duck Breast', 'Venison', 'Bison', 'Seitan', 'Edamame',
  ],
  Carb: [
    'White Rice', 'Brown Rice', 'Quinoa', 'Pasta', 'Whole Wheat Pasta',
    'Bread', 'Whole Wheat Bread', 'Tortillas', 'Potatoes', 'Sweet Potatoes',
    'Oats', 'Couscous', 'Barley', 'Farro', 'Bulgur', 'Pita Bread',
    'Rice Noodles', 'Egg Noodles', 'Sourdough Bread', 'Bagels', 'English Muffins',
    'Pancake Mix', 'Waffle Mix', 'Cornbread', 'Polenta',
  ],
  Veggie: [
    'Spinach', 'Kale', 'Broccoli', 'Cauliflower', 'Brussels Sprouts',
    'Carrots', 'Bell Peppers', 'Zucchini', 'Mushrooms', 'Onions',
    'Tomatoes', 'Cucumber', 'Celery', 'Asparagus', 'Green Beans',
    'Cabbage', 'Lettuce', 'Arugula', 'Eggplant', 'Squash',
    'Bok Choy', 'Fennel', 'Artichokes', 'Beets', 'Radishes',
  ],
  Fruit: [
    'Apples', 'Bananas', 'Oranges', 'Strawberries', 'Blueberries',
    'Raspberries', 'Mango', 'Pineapple', 'Peaches', 'Grapes',
    'Watermelon', 'Cantaloupe', 'Kiwi', 'Pears', 'Cherries',
    'Lemons', 'Limes', 'Grapefruit', 'Pomegranate', 'Figs',
  ],
  Other: [
    'Olive Oil', 'Butter', 'Coconut Oil', 'Vegetable Oil', 'Sesame Oil',
    'Salt', 'Black Pepper', 'Garlic Powder', 'Onion Powder', 'Cumin',
    'Paprika', 'Oregano', 'Basil', 'Thyme', 'Rosemary',
    'Soy Sauce', 'Vinegar', 'Honey', 'Maple Syrup', 'Hot Sauce',
    'Mayonnaise', 'Mustard', 'Ketchup', 'BBQ Sauce', 'Ranch Dressing',
  ],
};

export interface SwapFilters {
  allergies: string[];
  dietaryRestrictions: string[];
  dislikedIngredients: string[];
  pantryItems: PantryItem[];
  favoriteRecipeIngredients?: string[];
  isPro?: boolean;
  targetMacros?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

function matchesAllergy(ingredientName: string, allergies: string[]): boolean {
  const normalized = ingredientName.toLowerCase();
  
  for (const allergy of allergies) {
    const allergyNorm = allergy.toLowerCase();
    
    if (allergyNorm === 'dairy' || allergyNorm === 'lactose') {
      if (['milk', 'cheese', 'yogurt', 'butter', 'cream', 'cottage'].some(d => normalized.includes(d))) {
        return true;
      }
    }
    if (allergyNorm === 'gluten' || allergyNorm === 'wheat') {
      if (['bread', 'pasta', 'flour', 'wheat', 'barley', 'couscous', 'bagel', 'muffin', 'waffle', 'pancake'].some(g => normalized.includes(g))) {
        return true;
      }
    }
    if (allergyNorm === 'nuts' || allergyNorm === 'tree nuts') {
      if (['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia'].some(n => normalized.includes(n))) {
        return true;
      }
    }
    if (allergyNorm === 'shellfish') {
      if (['shrimp', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'].some(s => normalized.includes(s))) {
        return true;
      }
    }
    if (allergyNorm === 'soy') {
      if (['tofu', 'tempeh', 'soy', 'edamame', 'miso'].some(s => normalized.includes(s))) {
        return true;
      }
    }
    if (allergyNorm === 'eggs' || allergyNorm === 'egg') {
      if (normalized.includes('egg')) {
        return true;
      }
    }
    if (allergyNorm === 'fish') {
      if (['salmon', 'tuna', 'cod', 'tilapia', 'fish', 'anchovy', 'sardine', 'mackerel', 'halibut', 'bass', 'trout'].some(f => normalized.includes(f))) {
        return true;
      }
    }
    
    if (normalized.includes(allergyNorm)) {
      return true;
    }
  }
  
  return false;
}

function matchesDietaryRestriction(ingredientName: string, restrictions: string[]): boolean {
  const normalized = ingredientName.toLowerCase();
  
  for (const restriction of restrictions) {
    const restrictNorm = restriction.toLowerCase();
    
    if (restrictNorm === 'vegetarian') {
      if (['chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'bacon', 'ham', 'sausage', 'steak', 'veal', 'venison', 'bison'].some(m => normalized.includes(m))) {
        return true;
      }
    }
    if (restrictNorm === 'vegan') {
      if (['chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'bacon', 'ham', 'sausage', 'steak', 'egg', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'honey'].some(a => normalized.includes(a))) {
        return true;
      }
    }
    if (restrictNorm === 'keto' || restrictNorm === 'low-carb') {
      if (['rice', 'pasta', 'bread', 'potato', 'oat', 'flour', 'sugar', 'honey', 'syrup', 'bagel', 'waffle', 'pancake', 'tortilla', 'corn'].some(c => normalized.includes(c))) {
        return true;
      }
    }
    if (restrictNorm === 'paleo') {
      if (['pasta', 'bread', 'rice', 'oat', 'bean', 'lentil', 'peanut', 'dairy', 'cheese', 'milk', 'yogurt', 'soy', 'tofu'].some(p => normalized.includes(p))) {
        return true;
      }
    }
  }
  
  return false;
}

function isDisliked(ingredientName: string, dislikes: string[]): boolean {
  const normalized = ingredientName.toLowerCase();
  return dislikes.some(d => normalized.includes(d.toLowerCase()));
}

function isInPantry(ingredientName: string, pantryItems: PantryItem[]): boolean {
  const normalized = ingredientName.toLowerCase();
  return pantryItems.some(item => 
    item.state === 'have' && 
    (item.normalizedName.includes(normalized) || normalized.includes(item.normalizedName))
  );
}

export function generateSwapSuggestions(
  originalIngredient: string,
  filters: SwapFilters,
  count: number = 4
): SwapSuggestion[] {
  const originalCategory = classifyIngredient(originalIngredient);
  const normalizedOriginal = originalIngredient.toLowerCase();
  
  let candidates = INGREDIENT_DATABASE[originalCategory] || [];
  
  if (candidates.length < count) {
    candidates = [...candidates, ...INGREDIENT_DATABASE['Other']];
  }
  
  let filtered = candidates.filter(ingredient => {
    const normalized = ingredient.toLowerCase();
    
    if (normalized === normalizedOriginal || normalizedOriginal.includes(normalized) || normalized.includes(normalizedOriginal)) {
      return false;
    }
    
    if (matchesAllergy(ingredient, filters.allergies)) {
      return false;
    }
    
    if (matchesDietaryRestriction(ingredient, filters.dietaryRestrictions)) {
      return false;
    }
    
    if (isDisliked(ingredient, filters.dislikedIngredients)) {
      return false;
    }
    
    return true;
  });
  
  const scored = filtered.map(ingredient => {
    let score = 0;
    
    if (isInPantry(ingredient, filters.pantryItems)) {
      score += 100;
    }
    
    if (filters.favoriteRecipeIngredients?.some(fav => 
      ingredient.toLowerCase().includes(fav.toLowerCase()) || 
      fav.toLowerCase().includes(ingredient.toLowerCase())
    )) {
      score += 50;
    }
    
    const ingredientCategory = classifyIngredient(ingredient);
    if (ingredientCategory === originalCategory) {
      score += 25;
    }
    
    if (filters.isPro && filters.targetMacros) {
      const nutrition = getIngredientNutritionEstimate(ingredient);
      if (filters.targetMacros.protein > 0 && nutrition.protein > 15) {
        score += 20;
      }
    }
    
    score += Math.random() * 10;
    
    return { ingredient, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, count).map(({ ingredient }) => ({
    name: ingredient,
    category: classifyIngredient(ingredient),
    inPantry: isInPantry(ingredient, filters.pantryItems),
    nutrition: getIngredientNutritionEstimate(ingredient),
  }));
}

export function searchIngredients(
  query: string,
  filters: SwapFilters,
  maxResults: number = 10
): SwapSuggestion[] {
  const normalized = query.toLowerCase().trim();
  
  if (!normalized) {
    return [];
  }
  
  const allIngredients: string[] = [];
  Object.values(INGREDIENT_DATABASE).forEach(list => {
    allIngredients.push(...list);
  });
  
  const matches = allIngredients.filter(ingredient => {
    if (!ingredient.toLowerCase().includes(normalized)) {
      return false;
    }
    
    if (matchesAllergy(ingredient, filters.allergies)) {
      return false;
    }
    
    if (matchesDietaryRestriction(ingredient, filters.dietaryRestrictions)) {
      return false;
    }
    
    if (isDisliked(ingredient, filters.dislikedIngredients)) {
      return false;
    }
    
    return true;
  });
  
  return matches.slice(0, maxResults).map(ingredient => ({
    name: ingredient,
    category: classifyIngredient(ingredient),
    inPantry: isInPantry(ingredient, filters.pantryItems),
    nutrition: getIngredientNutritionEstimate(ingredient),
  }));
}
