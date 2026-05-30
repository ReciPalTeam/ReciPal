import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Recipe } from './mock-data';
import { unitTrace, getOrCreateCorrelationId } from '@/utils/unitTrace';
import { useRecipeStore } from './recipe-store';

const SYNONYM_TO_SHORT: Record<string, string> = {
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tbs: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  cup: "cup", cups: "cup",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", liter: "l", liters: "l",
  each: "each", count: "count", piece: "piece", pieces: "piece",
  serving: "serving", servings: "serving",
};

const CANONICAL_TRACE_UNITS = new Set(Object.keys(SYNONYM_TO_SHORT));

const FATSECRET_UNIT_TOKENS: Record<string, string> = {
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  ml: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", liter: "l", liters: "l",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tbs: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  cup: "cup", cups: "cup",
  pint: "pint", pints: "pint",
  quart: "quart", quarts: "quart",
  gallon: "gallon", gallons: "gallon",
  each: "each",
};

const FATSECRET_COMPOUND_TOKENS: [string, string][] = [
  ["fl oz", "fl oz"],
  ["fluid ounce", "fl oz"],
  ["fluid ounces", "fl oz"],
];

function parseFatSecretUnit(unitDisplay: string | null | undefined): {
  parsedBaseToken: string | null;
  fallbackApplied: boolean;
  fallbackUnit: string | null;
  hadDescriptors: boolean;
} {
  if (!unitDisplay || !unitDisplay.trim()) {
    return { parsedBaseToken: null, fallbackApplied: true, fallbackUnit: "each", hadDescriptors: false };
  }

  const raw = unitDisplay.trim().toLowerCase();

  if (raw === "serving" || raw === "servings") {
    return { parsedBaseToken: null, fallbackApplied: true, fallbackUnit: "each", hadDescriptors: false };
  }

  const hasParens = raw.includes("(");
  const hasComma = raw.includes(",");
  const hadDescriptors = hasParens || hasComma;

  let stripped = raw;
  if (hasParens) {
    stripped = stripped.substring(0, stripped.indexOf("(")).trim();
  }
  if (stripped.includes(",")) {
    stripped = stripped.substring(0, stripped.indexOf(",")).trim();
  }

  const scanString = (s: string): string | null => {
    for (const [compound, short] of FATSECRET_COMPOUND_TOKENS) {
      if (s.includes(compound)) return short;
    }
    const words = s.split(/\s+/);
    for (const word of words) {
      if (/^[\d./"'-]+$/.test(word)) continue;
      const match = FATSECRET_UNIT_TOKENS[word];
      if (match) return match;
    }
    return null;
  };

  const fromStripped = scanString(stripped);
  if (fromStripped) {
    return { parsedBaseToken: fromStripped, fallbackApplied: false, fallbackUnit: null, hadDescriptors };
  }

  const fromFull = scanString(raw);
  if (fromFull) {
    return { parsedBaseToken: fromFull, fallbackApplied: false, fallbackUnit: null, hadDescriptors };
  }

  return { parsedBaseToken: null, fallbackApplied: true, fallbackUnit: "each", hadDescriptors };
}

function classifyUnitForTrace(unitDisplay: string | null | undefined): {
  unitIsCanonical: boolean;
  canonicalUnitCandidate: string | null;
  fallbackReason: string | null;
} {
  if (!unitDisplay || !unitDisplay.trim()) {
    return { unitIsCanonical: false, canonicalUnitCandidate: "each", fallbackReason: "empty_unit" };
  }
  const raw = unitDisplay.trim().toLowerCase();

  if (CANONICAL_TRACE_UNITS.has(raw)) {
    return { unitIsCanonical: true, canonicalUnitCandidate: SYNONYM_TO_SHORT[raw], fallbackReason: null };
  }

  const hasParens = raw.includes("(");
  const hasComma = raw.includes(",");

  let stripped = raw;
  if (hasParens) {
    stripped = raw.substring(0, raw.indexOf("(")).trim();
  }
  if (stripped.includes(",")) {
    stripped = stripped.substring(0, stripped.indexOf(",")).trim();
  }

  let foundToken: string | null = null;
  const words = stripped.split(/\s+/);
  for (const word of words) {
    if (/^[\d./]+$/.test(word)) continue;
    if (CANONICAL_TRACE_UNITS.has(word)) {
      foundToken = SYNONYM_TO_SHORT[word];
      break;
    }
  }

  let reason: string;
  if (hasComma) {
    reason = "unit_contains_descriptors";
  } else if (hasParens) {
    reason = "unit_contains_parenthetical";
  } else {
    reason = "unit_not_in_allowed_set";
  }

  return {
    unitIsCanonical: false,
    canonicalUnitCandidate: foundToken || "each",
    fallbackReason: reason,
  };
}

import { PantryFoodGroup, PANTRY_FOOD_GROUPS } from './ingredient-categories';

export type FoodGroup = PantryFoodGroup;

export type PantryState = 'have' | 'might' | 'gone';
export type PantrySource = 'manual' | 'receipt' | 'instacart';

export interface PantryItem {
  id: string;
  name: string;
  normalizedName: string;
  foodGroup: FoodGroup;
  state: PantryState;
  lastUpdated: string;
  source: PantrySource;
  assignedAt: string;
  expirationDate: string;
  quantity: number;
  unit: string;
}

export type ExpirationStatus = 'fresh' | 'warning' | 'expired';

export function getDefaultShelfLifeDays(foodGroup: FoodGroup): number {
  switch (foodGroup) {
    case 'Produce': return 7;
    case 'Meat & Seafood': return 5;
    case 'Dairy & Eggs': return 14;
    case 'Bread & Bakery': return 7;
    case 'Prepared Foods & Deli': return 5;
    case 'Pasta, Rice & Grains': return 365;
    case 'Canned & Jarred': return 730;
    case 'Spices & Seasonings': return 365;
    case 'Oils, Sauces & Condiments': return 180;
    case 'Baking & Sweets': return 365;
    case 'Frozen': return 180;
    case 'Snacks & Nuts': return 90;
    case 'Beverages & Alcohol': return 180;
    case 'Non-Food': return 730;
    default: return 30;
  }
}

export function computeExpirationDate(assignedAt: string, foodGroup: FoodGroup): string {
  const shelfDays = getDefaultShelfLifeDays(foodGroup);
  const startDate = new Date(assignedAt);
  startDate.setDate(startDate.getDate() + shelfDays);
  return startDate.toISOString();
}

export function getExpirationStatus(expirationDate: string, assignedAt: string): ExpirationStatus {
  const now = new Date();
  const expDate = new Date(expirationDate);

  if (isNaN(expDate.getTime())) {
    return 'expired';
  }

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expMidnight = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
  const diffMs = expMidnight.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return 'fresh';
  if (diffDays >= -2) return 'warning';
  return 'expired';
}

export function getExpirationPillColor(status: ExpirationStatus): string {
  switch (status) {
    case 'fresh': return 'bg-green-500';
    case 'warning': return 'bg-amber-500';
    case 'expired': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

export interface CartItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string;
  sourceRecipes: string[];
  isAddon?: boolean;
  servingsUsed?: number;
  createdAt?: string;
}

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Dessert' | 'Snack' | 'Desserts' | 'Snackitizers' | 'Side';
export type MealState = 'scheduled' | 'cooked' | 'autoCounted';

export interface IngredientOverride {
  originalIngredientName: string;
  replacementName: string;
  replacementNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface PlannedMeal {
  id: string;
  recipeId: string;
  dayIndex: number;
  mealType: MealType;
  mealState: MealState;
  servings: number;
  plannedAt?: string;
  date: string; // YYYY-MM-DD format for absolute date tracking (required)
  ingredientOverrides?: IngredientOverride[];
  parentMealId?: string | null; // If set, this meal is a side dish attached to the parent meal
  isLeftover?: boolean; // If true, this meal was added as a leftover from a cooked meal
  leftoverServings?: number; // Fraction/amount of leftover servings (e.g. 0.25, 0.5, 1, 2)
}

export interface BuyAgainItem {
  id: string;
  name: string;
  lastPurchased: string;
  purchaseCount: number;
}

export const ADDON_ITEMS = [
  { id: 'addon-1', name: 'Paper Plates', defaultQty: 1 },
  { id: 'addon-2', name: 'Paper Bowls', defaultQty: 1 },
  { id: 'addon-3', name: 'Plastic Cutlery', defaultQty: 1 },
  { id: 'addon-4', name: 'Paper Towels', defaultQty: 1 },
  { id: 'addon-5', name: 'Napkins', defaultQty: 1 },
  { id: 'addon-6', name: 'Aluminum Foil', defaultQty: 1 },
  { id: 'addon-7', name: 'Baking Sheets', defaultQty: 1 },
  { id: 'addon-8', name: 'Parchment Paper', defaultQty: 1 },
  { id: 'addon-9', name: 'Food Storage Containers', defaultQty: 1 },
];

// normalizeIngredientName + getIngredientFoodGroup now live in shared/ingredient-intel.ts
// (single source of truth shared by client + server). Imported for internal use AND
// re-exported so existing external imports keep working.
import { normalizeIngredientName, getIngredientFoodGroup } from "@shared/ingredient-intel";
export { normalizeIngredientName, getIngredientFoodGroup };

const VALID_FOOD_GROUPS: FoodGroup[] = [...PANTRY_FOOD_GROUPS];

export function isValidFoodGroup(group: string): group is FoodGroup {
  return VALID_FOOD_GROUPS.includes(group as FoodGroup);
}

function createPantryItem(
  id: string,
  name: string,
  foodGroup: FoodGroup,
  state: PantryState,
  daysAgo: number = 0,
  quantity: number = 1,
  unit: string = 'each'
): PantryItem {
  const assignedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id,
    name,
    normalizedName: normalizeIngredientName(name),
    foodGroup,
    state,
    lastUpdated: assignedAt,
    source: 'manual',
    assignedAt,
    expirationDate: computeExpirationDate(assignedAt, foodGroup),
    quantity,
    unit,
  };
}

const INITIAL_PANTRY: PantryItem[] = [
  createPantryItem('p1', 'Chicken Breast', 'Meat & Seafood', 'have', 2, 2, 'lb'),
  createPantryItem('p2', 'Olive Oil', 'Oils, Sauces & Condiments', 'have', 30, 1, 'bottle'),
  createPantryItem('p3', 'Eggs', 'Dairy & Eggs', 'have', 3, 1, 'dozen'),
  createPantryItem('p4', 'Rice', 'Pasta, Rice & Grains', 'have', 60, 2, 'bag'),
  createPantryItem('p5', 'Garlic', 'Produce', 'have', 2, 2, 'head'),
  createPantryItem('p6', 'Onion', 'Produce', 'have', 3, 3, 'each'),
  createPantryItem('p7', 'Salt', 'Spices & Seasonings', 'have', 90, 1, 'jar'),
  createPantryItem('p8', 'Pepper', 'Spices & Seasonings', 'have', 90, 1, 'jar'),
  createPantryItem('p9', 'Butter', 'Dairy & Eggs', 'have', 5, 2, 'stick'),
  createPantryItem('p10', 'Greek Yogurt', 'Dairy & Eggs', 'have', 7, 1, 'container'),
  createPantryItem('p11', 'Broccoli', 'Produce', 'might', 5, 1, 'head'),
  createPantryItem('p12', 'Spinach', 'Produce', 'might', 4, 1, 'bag'),
  createPantryItem('p13', 'Avocado', 'Produce', 'might', 3, 2, 'each'),
  createPantryItem('p14', 'Milk', 'Dairy & Eggs', 'gone', 10, 0.5, 'gallon'),
];

const INITIAL_BUY_AGAIN: BuyAgainItem[] = [
  { id: 'ba1', name: 'Greek Yogurt', lastPurchased: '2 weeks ago', purchaseCount: 8 },
  { id: 'ba2', name: 'Almond Milk', lastPurchased: '1 week ago', purchaseCount: 6 },
  { id: 'ba3', name: 'Bananas', lastPurchased: '3 days ago', purchaseCount: 12 },
  { id: 'ba4', name: 'Chicken Breast', lastPurchased: '5 days ago', purchaseCount: 10 },
  { id: 'ba5', name: 'Avocados', lastPurchased: '4 days ago', purchaseCount: 7 },
];

interface DemoState {
  pantry: PantryItem[];
  cart: CartItem[];
  planner: PlannedMeal[];
  favorites: string[];
  buyAgain: BuyAgainItem[];
  macrosSet: boolean;
  
  addToPantry: (item: Omit<PantryItem, 'id' | 'normalizedName' | 'lastUpdated' | 'assignedAt' | 'expirationDate' | 'quantity' | 'unit'> & { quantity?: number; unit?: string }) => void;
  updatePantryState: (id: string, state: PantryState) => void;
  updatePantryExpiration: (id: string, expirationDate: string) => void;
  updatePantryQuantity: (id: string, quantity: number, unit: string) => void;
  removePantryItems: (ids: string[]) => void;
  acceleratePantryDecay: (ingredientNames: string[]) => void;
  autoUpdatePantryFromExpiration: () => void;
  
  addToCart: (item: Omit<CartItem, 'id' | 'normalizedName'>) => void;
  removeFromCart: (id: string) => void;
  updateCartQuantity: (id: string, quantity: number) => void;
  addRecipeIngredientsToCart: (recipe: Recipe) => void;
  removeRecipeIngredientsFromCart: (recipeId: string) => void;
  clearCart: () => void;
  
  addToPlanner: (meal: Omit<PlannedMeal, 'id' | 'mealState' | 'plannedAt'>) => void;
  addToPlannerWithReplace: (meal: Omit<PlannedMeal, 'id' | 'mealState' | 'plannedAt'>) => void;
  removeFromPlanner: (id: string) => void;
  getPlannedRecipeIds: () => string[];
  markMealCooked: (id: string) => void;
  unmarkMealCooked: (id: string) => void;
  getMealState: (id: string) => MealState;
  getMealAtSlot: (date: string, mealType: MealType) => PlannedMeal | undefined;
  swapIngredient: (mealId: string, originalIngredient: string, replacement: { name: string; nutrition: { calories: number; protein: number; carbs: number; fat: number } }) => void;
  removeIngredientOverride: (mealId: string, originalIngredientName: string) => void;
  getPlannedMealById: (mealId: string) => PlannedMeal | undefined;
  updateMealServings: (mealId: string, servings: number) => void;
  
  toggleFavorite: (recipeId: string) => void;
  isFavorite: (recipeId: string) => boolean;
  
  getPantryOverlap: (recipe: Recipe) => { have: string[]; might: string[]; missing: string[] };
  getPantryIndex: () => Map<string, PantryState>;
  getRecipesMissingFew: (maxMissing: number) => Recipe[];
  
  addBuyAgainToCart: (itemId: string) => void;
  addAddonToCart: (addonId: string, quantity?: number) => void;
  
  addSideToMeal: (parentMealId: string, side: { recipeId: string; servings: number; date: string; dayIndex: number }) => void;
  removeSideFromMeal: (sideId: string) => void;
  getSidesForMeal: (parentMealId: string) => PlannedMeal[];

  recipeRatings: Record<string, number>;
  setRecipeRating: (recipeId: string, rating: number) => void;
  getRecipeRating: (recipeId: string) => number | null;

  clearPlanner: () => void;
  setMacrosSet: (value: boolean) => void;
  
  getPlannerImpliedIngredients: () => Set<string>;
  addRecipeToCartWithDedupe: (recipe: Recipe, servings: number, maybeResolutions?: Record<string, "have" | "need">) => { added: boolean; message: string };
  lastCartAddKey: string | null;
  lastCartAddTime: number;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      pantry: INITIAL_PANTRY,
      cart: [],
      planner: [],
      favorites: [],
      buyAgain: INITIAL_BUY_AGAIN,
      macrosSet: false,
      recipeRatings: {},
      lastCartAddKey: null,
      lastCartAddTime: 0,
      
      addToPantry: (item) => set((state) => {
        const assignedAt = new Date().toISOString();
        return {
          pantry: [...state.pantry, {
            ...item,
            id: `p-${Date.now()}`,
            normalizedName: normalizeIngredientName(item.name),
            lastUpdated: assignedAt,
            assignedAt,
            expirationDate: computeExpirationDate(assignedAt, item.foodGroup),
            quantity: item.quantity ?? 1,
            unit: item.unit ?? 'each',
          }]
        };
      }),
      
      updatePantryState: (id, newState) => set((state) => ({
        pantry: state.pantry.map(item => 
          item.id === id 
            ? { ...item, state: newState, lastUpdated: new Date().toISOString() }
            : item
        )
      })),
      
      updatePantryExpiration: (id, expirationDate) => set((state) => ({
        pantry: state.pantry.map(item => 
          item.id === id 
            ? { ...item, expirationDate }
            : item
        )
      })),
      
      updatePantryQuantity: (id, quantity, unit) => set((state) => ({
        pantry: state.pantry.map(item =>
          item.id === id
            ? { ...item, quantity, unit, lastUpdated: new Date().toISOString() }
            : item
        )
      })),
      
      removePantryItems: (ids) => set((state) => ({
        pantry: state.pantry.filter(item => !ids.includes(item.id))
      })),
      
      acceleratePantryDecay: (ingredientNames) => set((state) => {
        const normalizedNames = ingredientNames.map(normalizeIngredientName);
        return {
          pantry: state.pantry.map(item => {
            if (normalizedNames.some(n => item.normalizedName.includes(n) || n.includes(item.normalizedName))) {
              const status = getExpirationStatus(item.expirationDate, item.assignedAt);
              if (status === 'fresh') return item;
              if (status === 'warning') {
                if (item.state === 'have') {
                  return { ...item, state: 'might' as PantryState, lastUpdated: new Date().toISOString() };
                }
                return item;
              }
              if (status === 'expired') {
                if (item.state !== 'gone') {
                  return { ...item, state: 'gone' as PantryState, lastUpdated: new Date().toISOString() };
                }
                return item;
              }
            }
            return item;
          })
        };
      }),

      autoUpdatePantryFromExpiration: () => set((state) => ({
        pantry: state.pantry.map(item => {
          if (item.state === 'have') {
            const status = getExpirationStatus(item.expirationDate, item.assignedAt);
            if (status === 'warning') {
              return { ...item, state: 'might' as PantryState, lastUpdated: new Date().toISOString() };
            }
            if (status === 'expired') {
              return { ...item, state: 'gone' as PantryState, lastUpdated: new Date().toISOString() };
            }
          }
          if (item.state === 'might') {
            const status = getExpirationStatus(item.expirationDate, item.assignedAt);
            if (status === 'expired') {
              return { ...item, state: 'gone' as PantryState, lastUpdated: new Date().toISOString() };
            }
          }
          return item;
        })
      })),
      
      addToCart: (item) => {
        const normalized = normalizeIngredientName(item.name);
        const correlationId = getOrCreateCorrelationId(normalized);

        unitTrace("ingredient_entered_cart_pipeline", {
          correlationId,
          ingredientName: item.name,
          sourceType: item.sourceRecipes.length > 0 ? "recipe_feed" : "unknown",
          originalServingText: `${item.quantity} ${item.unit}`,
          rawUnitData: item.unit,
        });

        const parsed = parseFatSecretUnit(item.unit);
        if (parsed.hadDescriptors || parsed.fallbackApplied) {
          unitTrace("fatsecret_unit_parsed", {
            correlationId,
            originalUnitDisplay: item.unit || null,
            originalServingText: `${item.quantity} ${item.unit}`,
            parsedBaseToken: parsed.parsedBaseToken,
            fallbackApplied: parsed.fallbackApplied,
            fallbackUnit: parsed.fallbackUnit,
          });
        }

        set((state) => {
          const existing = state.cart.find(c => c.normalizedName === normalized);
          
          if (existing) {
            return {
              cart: state.cart.map(c => 
                c.id === existing.id 
                  ? { 
                      ...c, 
                      quantity: c.quantity + item.quantity,
                      sourceRecipes: Array.from(new Set([...c.sourceRecipes, ...item.sourceRecipes]))
                    }
                  : c
              )
            };
          }
          
          return {
            cart: [...state.cart, {
              ...item,
              id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              normalizedName: normalized,
            }]
          };
        });
      },
      
      removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter(item => item.id !== id)
      })),
      
      updateCartQuantity: (id, quantity) => set((state) => ({
        cart: quantity <= 0 
          ? state.cart.filter(item => item.id !== id)
          : state.cart.map(item => item.id === id ? { ...item, quantity } : item)
      })),
      
      addRecipeIngredientsToCart: (recipe) => {
        const { pantry, cart, addToCart } = get();
        const pantryNormalized = new Set(
          pantry
            .filter(p => p.state === 'have')
            .map(p => p.normalizedName)
        );
        
        recipe.ingredients.forEach(ing => {
          const normalized = normalizeIngredientName(ing.name);
          const inPantry = pantryNormalized.has(normalized) || 
            Array.from(pantryNormalized).some(p => p.includes(normalized) || normalized.includes(p));
          
          if (!inPantry) {
            addToCart({
              name: ing.name,
              quantity: parseFloat(ing.amount) || 1,
              unit: ing.unit,
              sourceRecipes: [recipe.id],
            });
          }
        });
      },
      
      removeRecipeIngredientsFromCart: (recipeId) => set((state) => {
        const otherRecipeIds = state.planner
          .filter(p => p.recipeId !== recipeId)
          .map(p => p.recipeId);
        
        return {
          cart: state.cart.map(item => {
            const remainingSources = item.sourceRecipes.filter(id => id !== recipeId);
            if (remainingSources.length === 0 && !item.isAddon) {
              return null;
            }
            return { ...item, sourceRecipes: remainingSources };
          }).filter(Boolean) as CartItem[]
        };
      }),
      
      clearCart: () => set({ cart: [] }),
      
      addToPlanner: (meal) => {
        const newMeal = { 
          ...meal, 
          id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
          mealState: 'scheduled' as MealState,
          servings: meal.servings ?? 1,
          plannedAt: new Date().toISOString(),
        };
        set((state) => ({ planner: [...state.planner, newMeal] }));
        
        const recipe = useRecipeStore.getState().recipesById[meal.recipeId];
        if (recipe) {
          get().addRecipeIngredientsToCart(recipe);
        }
      },
      
      addToPlannerWithReplace: (meal) => {
        const existing = get().getMealAtSlot(meal.date, meal.mealType);
        if (existing) {
          get().removeFromPlanner(existing.id);
        }
        get().addToPlanner(meal);
      },
      
      getMealAtSlot: (date, mealType) => {
        const { planner } = get();
        return planner.find(m => m.date === date && m.mealType === mealType);
      },
      
      markMealCooked: (id) => {
        const meal = get().planner.find(m => m.id === id);
        if (!meal || meal.mealState === 'cooked' || meal.mealState === 'autoCounted') {
          return;
        }
        set((state) => ({
          planner: state.planner.map(m =>
            (m.id === id || m.parentMealId === id) ? { ...m, mealState: 'cooked' as MealState } : m
          )
        }));
      },

      unmarkMealCooked: (id) => {
        const meal = get().planner.find(m => m.id === id);
        if (!meal || (meal.mealState !== 'cooked' && meal.mealState !== 'autoCounted')) {
          return;
        }
        set((state) => ({
          planner: state.planner.map(m =>
            (m.id === id || m.parentMealId === id) ? { ...m, mealState: 'scheduled' as MealState } : m
          )
        }));
      },

      getMealState: (id) => {
        const meal = get().planner.find(m => m.id === id);
        return meal?.mealState || 'scheduled';
      },
      
      getPlannedMealById: (mealId) => {
        return get().planner.find(m => m.id === mealId);
      },

      updateMealServings: (mealId, servings) => set((state) => ({
        planner: state.planner.map(m =>
          m.id === mealId ? { ...m, servings } : m
        )
      })),
      
      swapIngredient: (mealId, originalIngredient, replacement) => {
        set((state) => ({
          planner: state.planner.map(meal => {
            if (meal.id !== mealId) return meal;
            
            const existingOverrides = meal.ingredientOverrides || [];
            const existingIndex = existingOverrides.findIndex(
              o => o.originalIngredientName.toLowerCase() === originalIngredient.toLowerCase()
            );
            
            let newOverrides;
            if (existingIndex >= 0) {
              newOverrides = existingOverrides.map((o, i) => 
                i === existingIndex 
                  ? { 
                      originalIngredientName: originalIngredient,
                      replacementName: replacement.name,
                      replacementNutrition: replacement.nutrition,
                    }
                  : o
              );
            } else {
              newOverrides = [
                ...existingOverrides,
                {
                  originalIngredientName: originalIngredient,
                  replacementName: replacement.name,
                  replacementNutrition: replacement.nutrition,
                },
              ];
            }
            
            return { ...meal, ingredientOverrides: newOverrides };
          }),
        }));
      },
      
      removeIngredientOverride: (mealId, originalIngredientName) => {
        set((state) => ({
          planner: state.planner.map(meal => {
            if (meal.id !== mealId) return meal;
            
            const existingOverrides = meal.ingredientOverrides || [];
            const newOverrides = existingOverrides.filter(
              o => o.originalIngredientName.toLowerCase() !== originalIngredientName.toLowerCase()
            );
            
            return { ...meal, ingredientOverrides: newOverrides };
          }),
        }));
      },
      
      removeFromPlanner: (id) => {
        const state = get();
        const meal = state.planner.find(m => m.id === id);
        if (meal) {
          get().removeRecipeIngredientsFromCart(meal.recipeId);
          // Also remove cart ingredients for any sides attached to this meal
          const sides = state.planner.filter(m => m.parentMealId === id);
          sides.forEach(side => get().removeRecipeIngredientsFromCart(side.recipeId));
        }
        // Remove the meal AND any sides attached to it
        set((s) => ({ planner: s.planner.filter(m => m.id !== id && m.parentMealId !== id) }));
      },
      
      addSideToMeal: (parentMealId, side) => {
        const newSide: PlannedMeal = {
          id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          recipeId: side.recipeId,
          dayIndex: side.dayIndex,
          mealType: 'Side',
          mealState: 'scheduled',
          servings: side.servings,
          plannedAt: new Date().toISOString(),
          date: side.date,
          parentMealId,
        };
        set((state) => ({ planner: [...state.planner, newSide] }));

        const recipe = useRecipeStore.getState().recipesById[side.recipeId];
        if (recipe) {
          get().addRecipeIngredientsToCart(recipe);
        }
      },

      removeSideFromMeal: (sideId) => {
        const state = get();
        const side = state.planner.find(m => m.id === sideId);
        if (side) {
          get().removeRecipeIngredientsFromCart(side.recipeId);
        }
        set((s) => ({ planner: s.planner.filter(m => m.id !== sideId) }));
      },

      getSidesForMeal: (parentMealId) => {
        return get().planner.filter(m => m.parentMealId === parentMealId);
      },

      setRecipeRating: (recipeId, rating) => set((state) => ({
        recipeRatings: { ...state.recipeRatings, [recipeId]: rating },
      })),

      getRecipeRating: (recipeId) => {
        return get().recipeRatings[recipeId] ?? null;
      },

      getPlannedRecipeIds: () => get().planner.map(m => m.recipeId),

      toggleFavorite: (recipeId) => set((state) => ({
        favorites: state.favorites.includes(recipeId)
          ? state.favorites.filter(id => id !== recipeId)
          : [...state.favorites, recipeId]
      })),
      
      isFavorite: (recipeId) => get().favorites.includes(recipeId),
      
      getPantryOverlap: (recipe) => {
        const { pantry } = get();
        const have: string[] = [];
        const might: string[] = [];
        const missing: string[] = [];
        
        recipe.ingredients.forEach(ing => {
          const normalized = normalizeIngredientName(ing.name);
          const pantryItem = pantry.find(p => 
            p.normalizedName === normalized ||
            p.normalizedName.includes(normalized) ||
            normalized.includes(p.normalizedName)
          );
          
          if (pantryItem?.state === 'have') {
            have.push(ing.name);
          } else if (pantryItem?.state === 'might') {
            might.push(ing.name);
          } else {
            missing.push(ing.name);
          }
        });

        return { have, might, missing };
      },
      
      getPantryIndex: () => {
        const { pantry } = get();
        const index = new Map<string, PantryState>();
        pantry.forEach(item => {
          index.set(item.normalizedName, item.state);
        });
        return index;
      },
      
      getRecipesMissingFew: (maxMissing) => {
        const { getPantryOverlap } = get();
        const allRecipes = Object.values(useRecipeStore.getState().recipesById);
        return allRecipes.filter(recipe => {
          const overlap = getPantryOverlap(recipe);
          return overlap.missing.length > 0 && overlap.missing.length <= maxMissing;
        });
      },
      
      addBuyAgainToCart: (itemId) => {
        const item = get().buyAgain.find(b => b.id === itemId);
        if (item) {
          get().addToCart({
            name: item.name,
            quantity: 1,
            unit: 'item',
            sourceRecipes: [],
          });
        }
      },
      
      addAddonToCart: (addonId, quantity = 1) => {
        const addon = ADDON_ITEMS.find(a => a.id === addonId);
        if (addon) {
          set((state) => {
            const existing = state.cart.find(c => c.normalizedName === normalizeIngredientName(addon.name));
            if (existing) {
              return {
                cart: state.cart.map(c => 
                  c.id === existing.id 
                    ? { ...c, quantity: c.quantity + quantity }
                    : c
                )
              };
            }
            return {
              cart: [...state.cart, {
                id: `addon-cart-${Date.now()}`,
                name: addon.name,
                normalizedName: normalizeIngredientName(addon.name),
                quantity,
                unit: 'pack',
                sourceRecipes: [],
                isAddon: true,
              }]
            };
          });
        }
      },
      
      clearPlanner: () => set({ planner: [] }),
      
      setMacrosSet: (value) => set({ macrosSet: value }),
      
      getPlannerImpliedIngredients: () => {
        const { planner } = get();
        const implied = new Set<string>();
        
        planner.forEach(meal => {
          const recipe = useRecipeStore.getState().recipesById[meal.recipeId];
          if (!recipe) return;
          
          recipe.ingredients.forEach(ing => {
            const overrideMatch = meal.ingredientOverrides?.find(
              o => o.originalIngredientName.toLowerCase() === ing.name.toLowerCase()
            );
            const ingredientName = overrideMatch ? overrideMatch.replacementName : ing.name;
            implied.add(normalizeIngredientName(ingredientName));
          });
        });
        
        return implied;
      },
      
      addRecipeToCartWithDedupe: (recipe, servings, maybeResolutions) => {
        const { pantry, cart, lastCartAddKey, lastCartAddTime, addToCart } = get();
        
        const addKey = `${recipe.id}-${servings}`;
        const now = Date.now();
        const ANTI_SPAM_WINDOW = 5000;
        
        if (lastCartAddKey === addKey && (now - lastCartAddTime) < ANTI_SPAM_WINDOW) {
          return { added: false, message: "Already added" };
        }
        
        const pantryNormalized = new Set(
          pantry.filter(p => p.state === 'have').map(p => p.normalizedName)
        );
        const cartNormalized = new Set(cart.map(c => c.normalizedName));
        
        const resolvedHaveNames = new Set(
          Object.entries(maybeResolutions || {})
            .filter(([, v]) => v === "have")
            .map(([k]) => normalizeIngredientName(k))
        );
        
        const missingIngredients = recipe.ingredients.filter(ing => {
          const normalized = normalizeIngredientName(ing.name);
          const inP = pantryNormalized.has(normalized) ||
            Array.from(pantryNormalized).some(p => p.includes(normalized) || normalized.includes(p));
          const inC = cartNormalized.has(normalized) ||
            Array.from(cartNormalized).some(c => c.includes(normalized) || normalized.includes(c));
          const rHave = resolvedHaveNames.has(normalized) ||
            Array.from(resolvedHaveNames).some(h => h.includes(normalized) || normalized.includes(h));
          return !inP && !rHave && !inC;
        });

        if (missingIngredients.length > 0) {
          unitTrace("pantry_gap_detected", {
            correlationId: "aggregate",
            recipeId: recipe.id,
            recipeName: recipe.title,
            missingCount: missingIngredients.length,
            missingIngredientsPreview: missingIngredients.slice(0, 10).map(ing => ({
              name: ing.name,
              originalServingText: `${ing.amount} ${ing.unit}`,
              originalQty: ing.amount,
              originalUnitDisplay: ing.unit,
            })),
            sourceType: "add_missing_to_cart",
          });
        }

        let addedCount = 0;
        let pantryCoveredCount = 0;
        
        recipe.ingredients.forEach(ing => {
          const normalized = normalizeIngredientName(ing.name);
          
          const inPantry = pantryNormalized.has(normalized) ||
            Array.from(pantryNormalized).some(p => p.includes(normalized) || normalized.includes(p));
          const inCart = cartNormalized.has(normalized) ||
            Array.from(cartNormalized).some(c => c.includes(normalized) || normalized.includes(c));
          
          const resolvedAsHave = resolvedHaveNames.has(normalized) ||
            Array.from(resolvedHaveNames).some(h => h.includes(normalized) || normalized.includes(h));
          
          if (inPantry || resolvedAsHave) {
            pantryCoveredCount++;
          } else if (!inCart) {
            const baseQty = parseFloat(ing.amount) || 1;
            const scaledQty = baseQty * servings;
            
            addToCart({
              name: ing.name,
              quantity: scaledQty,
              unit: ing.unit,
              sourceRecipes: [recipe.id],
              servingsUsed: servings,
              createdAt: new Date().toISOString(),
            });

            const corrId = getOrCreateCorrelationId(normalized);
            const traceClassification = classifyUnitForTrace(ing.unit);
            const parsedUnitResult = parseFatSecretUnit(ing.unit);

            let resolvedInstacartUnit: string;
            let resolvedFallbackReason: string | null = null;

            if (parsedUnitResult.fallbackApplied && parsedUnitResult.fallbackUnit) {
              resolvedInstacartUnit = parsedUnitResult.fallbackUnit;
              resolvedFallbackReason = traceClassification.fallbackReason || "unit_unrecognized";
            } else if (parsedUnitResult.parsedBaseToken) {
              resolvedInstacartUnit = parsedUnitResult.parsedBaseToken;
              resolvedFallbackReason = null;
            } else if (traceClassification.canonicalUnitCandidate) {
              resolvedInstacartUnit = traceClassification.canonicalUnitCandidate;
              resolvedFallbackReason = null;
            } else {
              resolvedInstacartUnit = "each";
              resolvedFallbackReason = "unit_unrecognized";
            }

            unitTrace("instacart_lineitem_mapped", {
              correlationId: corrId,
              ingredientName: ing.name,
              originalQuantity: ing.amount,
              originalUnitDisplay: ing.unit,
              parsedQuantity: baseQty,
              parsedUnit: parsedUnitResult.parsedBaseToken || ing.unit || null,
              normalizedQuantity: scaledQty,
              normalizedUnit: ing.unit || null,
              instacartUnitUsed: resolvedInstacartUnit,
              unitIsCanonical: true,
              canonicalUnitCandidate: traceClassification.canonicalUnitCandidate,
              fallbackReason: resolvedFallbackReason,
            });

            addedCount++;
          }
        });
        
        set({ lastCartAddKey: addKey, lastCartAddTime: now });
        
        if (addedCount === 0) {
          if (pantryCoveredCount === recipe.ingredients.length) {
            return { added: false, message: "All ingredients already covered" };
          }
          return { added: false, message: "Already added" };
        }
        
        return { added: true, message: `${addedCount} ingredients added` };
      },
    }),
    {
      name: 'recipal-demo-store',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        
        const MIGRATION_VERSION = 'v7-pantry-quantity-unit';
        const migrationKey = 'recipal-pantry-migration-version';
        const lastMigration = localStorage.getItem(migrationKey);
        const needsForceReclassify = lastMigration !== MIGRATION_VERSION;
        
        let foodGroupMigrated = 0;
        let expirationMigrated = 0;
        
        const migratedPantry = state.pantry.map(item => {
          let updated = { ...item };
          let foodGroupChanged = false;
          
          if (needsForceReclassify || !isValidFoodGroup(item.foodGroup)) {
            const newGroup = getIngredientFoodGroup(item.name);
            if (item.foodGroup !== newGroup) {
              foodGroupMigrated++;
              updated.foodGroup = newGroup;
              foodGroupChanged = true;
            }
          }
          
          if (!item.assignedAt) {
            expirationMigrated++;
            updated.assignedAt = item.lastUpdated || new Date().toISOString();
          }
          
          if (!item.expirationDate || foodGroupChanged) {
            updated.expirationDate = computeExpirationDate(updated.assignedAt, updated.foodGroup);
          }
          
          if (updated.quantity == null) {
            updated.quantity = 1;
          }
          if (!updated.unit) {
            updated.unit = 'each';
          }
          
          return updated;
        });
        
        if (needsForceReclassify) {
          localStorage.setItem(migrationKey, MIGRATION_VERSION);
        }
        
        if (foodGroupMigrated > 0 || expirationMigrated > 0) {
          useDemoStore.setState({ pantry: migratedPantry });
          if (import.meta.env.DEV) {
            if (foodGroupMigrated > 0) {
              console.log(`[ReciPal] Migrated ${foodGroupMigrated} pantry items to new FoodGroup values`);
            }
            if (expirationMigrated > 0) {
              console.log(`[ReciPal] Migrated ${expirationMigrated} pantry items with expiration dates`);
            }
          }
        }
        
        if (import.meta.env.DEV) {
          const groupCounts: Record<string, number> = {};
          migratedPantry.forEach(item => {
            groupCounts[item.foodGroup] = (groupCounts[item.foodGroup] || 0) + 1;
          });
          console.log('[ReciPal] Pantry FoodGroup distribution:', groupCounts);
          
          const unknownGroups = migratedPantry.filter(item => !isValidFoodGroup(item.foodGroup));
          if (unknownGroups.length > 0) {
            console.warn('[ReciPal] Found items with unknown FoodGroup:', unknownGroups);
          } else {
            console.log('[ReciPal] All pantry items have valid FoodGroup values');
          }
          
          const missingExpiration = migratedPantry.filter(item => !item.expirationDate);
          if (missingExpiration.length > 0) {
            console.warn('[ReciPal] Found items missing expiration:', missingExpiration);
          } else {
            console.log('[ReciPal] All pantry items have expiration dates');
          }
        }
      }
    }
  )
);
