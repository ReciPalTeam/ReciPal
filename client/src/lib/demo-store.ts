import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Recipe, mockRecipes } from './mock-data';

export type FoodGroup = 
  | 'Produce' 
  | 'Meat & Seafood' 
  | 'Dairy & Eggs' 
  | 'Pantry Staples' 
  | 'Frozen' 
  | 'Snacks' 
  | 'Beverages' 
  | 'Condiments & Sauces' 
  | 'Baking' 
  | 'Spices' 
  | 'Other';

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
}

export interface CartItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string;
  sourceRecipes: string[];
  isAddon?: boolean;
}

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Dessert' | 'Snack' | 'Desserts' | 'Snackitizers';
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
  date?: string; // YYYY-MM-DD format for absolute date tracking
  ingredientOverrides?: IngredientOverride[];
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

export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/s$/, '')
    .replace(/ies$/, 'y')
    .replace(/es$/, '')
    .replace(/-/g, ' ');
}

export function getIngredientFoodGroup(name: string): FoodGroup {
  const normalized = normalizeIngredientName(name);
  
  const produceKeywords = ['lettuce', 'tomato', 'avocado', 'onion', 'garlic', 'pepper', 'broccoli', 'spinach', 'carrot', 'celery', 'mushroom', 'lemon', 'lime', 'berry', 'banana', 'apple', 'orange', 'cucumber', 'zucchini', 'squash', 'potato', 'green', 'basil', 'cilantro', 'parsley', 'ginger', 'peach'];
  const meatKeywords = ['chicken', 'beef', 'pork', 'turkey', 'salmon', 'fish', 'shrimp', 'tuna', 'cod', 'steak', 'bacon', 'sausage', 'ground'];
  const dairyKeywords = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'mozzarella', 'parmesan', 'feta', 'cottage'];
  const pantryKeywords = ['rice', 'pasta', 'oat', 'quinoa', 'bean', 'lentil', 'chickpea', 'flour', 'bread', 'tortilla', 'noodle', 'can', 'broth'];
  const condimentKeywords = ['oil', 'sauce', 'vinegar', 'dressing', 'mayo', 'mustard', 'ketchup', 'salsa', 'honey', 'syrup', 'soy'];
  const spiceKeywords = ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'seasoning', 'spice'];
  const bakingKeywords = ['sugar', 'baking', 'chocolate', 'vanilla', 'cocoa', 'powder'];
  const frozenKeywords = ['frozen', 'ice'];
  const snackKeywords = ['chip', 'cracker', 'nut', 'granola', 'almond', 'peanut'];
  const beverageKeywords = ['water', 'juice', 'coffee', 'tea', 'soda'];
  
  if (produceKeywords.some(k => normalized.includes(k))) return 'Produce';
  if (meatKeywords.some(k => normalized.includes(k))) return 'Meat & Seafood';
  if (dairyKeywords.some(k => normalized.includes(k))) return 'Dairy & Eggs';
  if (condimentKeywords.some(k => normalized.includes(k))) return 'Condiments & Sauces';
  if (spiceKeywords.some(k => normalized.includes(k))) return 'Spices';
  if (bakingKeywords.some(k => normalized.includes(k))) return 'Baking';
  if (pantryKeywords.some(k => normalized.includes(k))) return 'Pantry Staples';
  if (frozenKeywords.some(k => normalized.includes(k))) return 'Frozen';
  if (snackKeywords.some(k => normalized.includes(k))) return 'Snacks';
  if (beverageKeywords.some(k => normalized.includes(k))) return 'Beverages';
  
  return 'Other';
}

const INITIAL_PANTRY: PantryItem[] = [
  { id: 'p1', name: 'Chicken Breast', normalizedName: 'chicken breast', foodGroup: 'Meat & Seafood', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p2', name: 'Olive Oil', normalizedName: 'olive oil', foodGroup: 'Condiments & Sauces', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p3', name: 'Eggs', normalizedName: 'egg', foodGroup: 'Dairy & Eggs', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p4', name: 'Rice', normalizedName: 'rice', foodGroup: 'Pantry Staples', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p5', name: 'Garlic', normalizedName: 'garlic', foodGroup: 'Produce', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p6', name: 'Onion', normalizedName: 'onion', foodGroup: 'Produce', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p7', name: 'Salt', normalizedName: 'salt', foodGroup: 'Spices', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p8', name: 'Pepper', normalizedName: 'pepper', foodGroup: 'Spices', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p9', name: 'Butter', normalizedName: 'butter', foodGroup: 'Dairy & Eggs', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p10', name: 'Greek Yogurt', normalizedName: 'greek yogurt', foodGroup: 'Dairy & Eggs', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p11', name: 'Broccoli', normalizedName: 'broccoli', foodGroup: 'Produce', state: 'might', lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), source: 'manual' },
  { id: 'p12', name: 'Spinach', normalizedName: 'spinach', foodGroup: 'Produce', state: 'might', lastUpdated: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), source: 'manual' },
  { id: 'p13', name: 'Avocado', normalizedName: 'avocado', foodGroup: 'Produce', state: 'might', lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), source: 'manual' },
  { id: 'p14', name: 'Milk', normalizedName: 'milk', foodGroup: 'Dairy & Eggs', state: 'gone', lastUpdated: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), source: 'manual' },
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
  
  addToPantry: (item: Omit<PantryItem, 'id' | 'normalizedName' | 'lastUpdated'>) => void;
  updatePantryState: (id: string, state: PantryState) => void;
  removePantryItems: (ids: string[]) => void;
  acceleratePantryDecay: (ingredientNames: string[]) => void;
  
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
  getMealState: (id: string) => MealState;
  getMealAtSlot: (dayIndex: number, mealType: MealType, date?: string) => PlannedMeal | undefined;
  swapIngredient: (mealId: string, originalIngredient: string, replacement: { name: string; nutrition: { calories: number; protein: number; carbs: number; fat: number } }) => void;
  removeIngredientOverride: (mealId: string, originalIngredientName: string) => void;
  getPlannedMealById: (mealId: string) => PlannedMeal | undefined;
  
  toggleFavorite: (recipeId: string) => void;
  isFavorite: (recipeId: string) => boolean;
  
  getPantryOverlap: (recipe: Recipe) => { have: string[]; might: string[]; missing: string[] };
  getRecipesMissingFew: (maxMissing: number) => Recipe[];
  
  addBuyAgainToCart: (itemId: string) => void;
  addAddonToCart: (addonId: string, quantity?: number) => void;
  
  clearPlanner: () => void;
  setMacrosSet: (value: boolean) => void;
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
      
      addToPantry: (item) => set((state) => ({
        pantry: [...state.pantry, {
          ...item,
          id: `p-${Date.now()}`,
          normalizedName: normalizeIngredientName(item.name),
          lastUpdated: new Date().toISOString(),
        }]
      })),
      
      updatePantryState: (id, newState) => set((state) => ({
        pantry: state.pantry.map(item => 
          item.id === id 
            ? { ...item, state: newState, lastUpdated: new Date().toISOString() }
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
              const newState: PantryState = item.state === 'have' ? 'might' : 'gone';
              return { ...item, state: newState, lastUpdated: new Date().toISOString() };
            }
            return item;
          })
        };
      }),
      
      addToCart: (item) => set((state) => {
        const normalized = normalizeIngredientName(item.name);
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
      }),
      
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
        
        const recipe = mockRecipes.find(r => r.id === meal.recipeId);
        if (recipe) {
          get().addRecipeIngredientsToCart(recipe);
        }
      },
      
      addToPlannerWithReplace: (meal) => {
        const existing = get().getMealAtSlot(meal.dayIndex, meal.mealType, meal.date);
        if (existing) {
          get().removeFromPlanner(existing.id);
        }
        get().addToPlanner(meal);
      },
      
      getMealAtSlot: (dayIndex, mealType, date) => {
        const { planner } = get();
        return planner.find(m => {
          if (date && m.date) {
            return m.date === date && m.mealType === mealType;
          }
          return m.dayIndex === dayIndex && m.mealType === mealType;
        });
      },
      
      markMealCooked: (id) => {
        const meal = get().planner.find(m => m.id === id);
        if (!meal || meal.mealState === 'cooked' || meal.mealState === 'autoCounted') {
          return;
        }
        set((state) => ({
          planner: state.planner.map(m => 
            m.id === id ? { ...m, mealState: 'cooked' as MealState } : m
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
        }
        set((s) => ({ planner: s.planner.filter(m => m.id !== id) }));
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
      
      getRecipesMissingFew: (maxMissing) => {
        const { getPantryOverlap } = get();
        return mockRecipes.filter(recipe => {
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
    }),
    {
      name: 'recipal-demo-store',
    }
  )
);
