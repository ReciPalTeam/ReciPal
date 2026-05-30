export const INGREDIENT_CATEGORIES = [
  "Protein",
  "Carb",
  "Seasonings",
  "Veggie",
  "Sauces & Condiments",
  "Dairy",
  "Fruit",
  "Nuts & Seeds",
  "Chocolate & Sweets",
  "Pickled & Preserved",
  "Baking & Thickeners",
  "Broths & Stocks",
  "Alcohol",
  "Oils",
  "Non-Food & Equipment",
  "Prepared Batters & Doughs",
  "Beverages & Coffee",
] as const;

export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

// Food-group taxonomy now lives in shared/ingredient-intel.ts (the single source of truth
// shared by client + server). Re-exported here so existing client imports keep working.
export { PANTRY_FOOD_GROUPS } from "@shared/ingredient-intel";
export type { PantryFoodGroup } from "@shared/ingredient-intel";
import type { PantryFoodGroup } from "@shared/ingredient-intel";

export const CATEGORY_TO_PANTRY_GROUP: Record<string, PantryFoodGroup> = {
  "Seasonings": "Spices & Seasonings",
  "Veggie": "Produce",
  "Fruit": "Produce",
  "Dairy": "Dairy & Eggs",
  "Oils": "Oils, Sauces & Condiments",
  "Sauces & Condiments": "Oils, Sauces & Condiments",
  "Nuts & Seeds": "Snacks & Nuts",
  "Chocolate & Sweets": "Baking & Sweets",
  "Baking & Thickeners": "Baking & Sweets",
  "Pickled & Preserved": "Canned & Jarred",
  "Broths & Stocks": "Canned & Jarred",
  "Alcohol": "Beverages & Alcohol",
  "Beverages & Coffee": "Beverages & Alcohol",
  "Non-Food & Equipment": "Non-Food",
  "Prepared Batters & Doughs": "Bread & Bakery",
};

const PROTEIN_EGG_KEYWORDS = ['egg', 'eggs'];
const PROTEIN_PREPARED_KEYWORDS = [
  'tofu', 'tempeh', 'seitan', 'paneer', 'beyond', 'impossible',
  'plant-based', 'veggie burger', 'veggie patty', 'deli',
  'lunch meat', 'hot dog', 'frankfurter', 'protein powder',
];

const CARB_BREAD_KEYWORDS = [
  'bread', 'tortilla', 'pita', 'naan', 'roti', 'bun', 'roll',
  'bagel', 'croissant', 'biscuit', 'muffin', 'wrap', 'flatbread',
  'focaccia', 'ciabatta', 'brioche', 'sourdough', 'cornbread',
  'crouton', 'breadcrumb', 'panko', 'waffle', 'pancake mix',
  'pizza dough', 'pie crust', 'taco shell', 'dumpling wrapper',
  'wonton wrapper', 'spring roll wrapper', 'phyllo', 'puff pastry',
];

function matchesWord(text: string, word: string): boolean {
  const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return pattern.test(text);
}

/**
 * Maps an IngredientCategory (17-category swap system) to a PantryFoodGroup (14-group grocery aisle system).
 * Any future ingredient creation pipeline (e.g. INSERT into Supabase `ingredients` table)
 * should call getPantryGroup(name, category) and store the result as `pantry_group`.
 */
export function getPantryGroup(ingredientName: string, category: IngredientCategory): PantryFoodGroup {
  const normalized = ingredientName.toLowerCase().trim();

  const frozenCategories: IngredientCategory[] = ['Veggie', 'Fruit', 'Prepared Batters & Doughs'];
  if (matchesWord(normalized, 'frozen') && frozenCategories.includes(category)) {
    return 'Frozen';
  }

  const directMapping = CATEGORY_TO_PANTRY_GROUP[category];
  if (directMapping) {
    return directMapping;
  }

  if (category === 'Protein') {
    for (const kw of PROTEIN_EGG_KEYWORDS) {
      if (matchesWord(normalized, kw)) return 'Dairy & Eggs';
    }
    for (const kw of PROTEIN_PREPARED_KEYWORDS) {
      if (normalized.includes(kw)) return 'Prepared Foods & Deli';
    }
    return 'Meat & Seafood';
  }

  if (category === 'Carb') {
    for (const kw of CARB_BREAD_KEYWORDS) {
      if (normalized.includes(kw)) return 'Bread & Bakery';
    }
    return 'Pasta, Rice & Grains';
  }

  return 'Spices & Seasonings';
}
