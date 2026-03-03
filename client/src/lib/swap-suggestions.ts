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
  Dairy: [
    'Butter', 'Unsalted Butter', 'Ghee', 'Clarified Butter',
    'Milk', 'Whole Milk', 'Skim Milk', '2% Milk',
    'Heavy Cream', 'Half and Half', 'Sour Cream', 'Creme Fraiche',
    'Cream Cheese', 'Ricotta', 'Mascarpone',
    'Cheddar Cheese', 'Mozzarella', 'Parmesan', 'Feta', 'Gouda', 'Brie',
    'Goat Cheese', 'Blue Cheese', 'Swiss Cheese', 'Provolone',
    'Yogurt', 'Plain Yogurt', 'Buttermilk', 'Kefir',
  ],
  Seasonings: [
    'Salt', 'Sea Salt', 'Kosher Salt', 'Himalayan Salt',
    'Black Pepper', 'White Pepper', 'Cracked Pepper', 'Peppercorns',
    'Garlic Powder', 'Onion Powder', 'Chili Powder', 'Curry Powder',
    'Paprika', 'Smoked Paprika', 'Sweet Paprika',
    'Cumin', 'Ground Cumin', 'Coriander', 'Turmeric', 'Saffron',
    'Cinnamon', 'Ground Cinnamon', 'Nutmeg', 'Cloves', 'Allspice', 'Cardamom',
    'Cayenne', 'Red Pepper Flakes', 'Crushed Red Pepper', 'Chili Flakes',
    'Oregano', 'Dried Oregano', 'Basil', 'Dried Basil', 'Thyme', 'Dried Thyme',
    'Rosemary', 'Sage', 'Marjoram', 'Tarragon', 'Dill', 'Parsley',
    'Bay Leaves', 'Italian Seasoning', 'Herbes de Provence',
    'Garam Masala', 'Taco Seasoning', 'Cajun Seasoning', 'Old Bay',
    'Mustard Seed', 'Celery Seed', 'Fennel Seed', 'Caraway Seed',
    'Vanilla Extract', 'Almond Extract',
  ],
  Oils: [
    'Olive Oil', 'Extra Virgin Olive Oil', 'Light Olive Oil',
    'Avocado Oil', 'Vegetable Oil', 'Canola Oil', 'Coconut Oil',
    'Sesame Oil', 'Toasted Sesame Oil', 'Peanut Oil', 'Sunflower Oil',
    'Grapeseed Oil', 'Corn Oil', 'Safflower Oil', 'Walnut Oil',
    'Truffle Oil', 'Chili Oil', 'Garlic Oil',
    'Cooking Spray', 'Nonstick Spray',
    'Shortening', 'Lard', 'Duck Fat', 'Bacon Fat',
  ],
  Other: [
    'Soy Sauce', 'Tamari', 'Fish Sauce', 'Worcestershire Sauce',
    'Vinegar', 'Balsamic Vinegar', 'Rice Vinegar', 'Apple Cider Vinegar',
    'Honey', 'Maple Syrup', 'Agave', 'Molasses',
    'Hot Sauce', 'Sriracha', 'Tabasco',
    'Mayonnaise', 'Mustard', 'Dijon Mustard', 'Ketchup', 'BBQ Sauce',
    'Ranch Dressing', 'Italian Dressing', 'Caesar Dressing',
    'Tomato Paste', 'Tomato Sauce', 'Salsa',
    'Broth', 'Chicken Broth', 'Beef Broth', 'Vegetable Broth',
    'Coconut Milk', 'Almond Milk', 'Oat Milk',
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
  const normalized = ingredientName.toLowerCase().trim();
  return pantryItems.some(item => 
    item.state === 'have' && 
    item.normalizedName.toLowerCase().trim() === normalized
  );
}

export function generateSwapSuggestions(
  originalIngredient: string,
  filters: SwapFilters,
  count: number = 4
): SwapSuggestion[] {
  const originalCategory = classifyIngredient(originalIngredient);
  const normalizedOriginal = originalIngredient.toLowerCase();
  
  // IMPORTANT: Only get candidates from the SAME category - no cross-category mixing
  // This ensures seasonings only swap with seasonings, oils only with oils, etc.
  const candidates = INGREDIENT_DATABASE[originalCategory] || [];
  
  // Filter candidates: exclude self, allergies, dietary restrictions, dislikes
  // Also ensure each candidate actually classifies to the same category (double-check)
  let filtered = candidates.filter(ingredient => {
    const normalized = ingredient.toLowerCase();
    
    // Exclude self (the original ingredient)
    if (normalized === normalizedOriginal || normalizedOriginal.includes(normalized) || normalized.includes(normalizedOriginal)) {
      return false;
    }
    
    // Verify candidate classifies to the same category (defensive check)
    const candidateCategory = classifyIngredient(ingredient);
    if (candidateCategory !== originalCategory) {
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
  
  // Dedupe by normalized name
  const seen = new Set<string>();
  filtered = filtered.filter(ingredient => {
    const normalized = ingredient.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  
  const scored = filtered.map(ingredient => {
    let score = 0;
    
    // Boost items in pantry
    if (isInPantry(ingredient, filters.pantryItems)) {
      score += 100;
    }
    
    // Boost items from favorite recipes
    if (filters.favoriteRecipeIngredients?.some(fav => 
      ingredient.toLowerCase().includes(fav.toLowerCase()) || 
      fav.toLowerCase().includes(ingredient.toLowerCase())
    )) {
      score += 50;
    }
    
    // Pro users: boost high-protein items if targeting protein
    if (filters.isPro && filters.targetMacros) {
      const nutrition = getIngredientNutritionEstimate(ingredient);
      if (filters.targetMacros.protein > 0 && nutrition.protein > 15) {
        score += 20;
      }
    }
    
    // Small random factor for variety
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
