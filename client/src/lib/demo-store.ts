import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Recipe, mockRecipes } from './mock-data';

export type FoodGroup = 
  | 'Produce' 
  | 'Meat & Seafood' 
  | 'Dairy & Eggs' 
  | 'Bread & Bakery' 
  | 'Pasta, Rice & Grains' 
  | 'Canned & Jarred' 
  | 'Spices & Seasonings' 
  | 'Oils, Sauces & Condiments' 
  | 'Baking & Sweeteners' 
  | 'Frozen' 
  | 'Prepared Foods & Deli' 
  | 'Snacks & Nuts' 
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
  servingsUsed?: number;
  createdAt?: string;
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
  date: string; // YYYY-MM-DD format for absolute date tracking (required)
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

const VALID_FOOD_GROUPS: FoodGroup[] = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bread & Bakery',
  'Pasta, Rice & Grains',
  'Canned & Jarred',
  'Spices & Seasonings',
  'Oils, Sauces & Condiments',
  'Baking & Sweeteners',
  'Frozen',
  'Prepared Foods & Deli',
  'Snacks & Nuts',
  'Other'
];

export function isValidFoodGroup(group: string): group is FoodGroup {
  return VALID_FOOD_GROUPS.includes(group as FoodGroup);
}

export function getIngredientFoodGroup(name: string): FoodGroup {
  const normalized = normalizeIngredientName(name);
  
  const produceKeywords = [
    'lettuce', 'tomato', 'avocado', 'onion', 'garlic', 'pepper', 'broccoli', 'spinach', 
    'carrot', 'celery', 'mushroom', 'lemon', 'lime', 'berry', 'banana', 'apple', 'orange', 
    'cucumber', 'zucchini', 'squash', 'potato', 'green', 'basil', 'cilantro', 'parsley', 
    'ginger', 'peach', 'mango', 'pineapple', 'grape', 'melon', 'watermelon', 'cantaloupe',
    'kale', 'arugula', 'cabbage', 'cauliflower', 'asparagus', 'corn', 'pea', 'radish',
    'beet', 'turnip', 'eggplant', 'artichoke', 'leek', 'scallion', 'shallot', 'chive',
    'romaine', 'iceberg', 'chard', 'collard', 'endive', 'fennel', 'jalapen', 'serrano',
    'habanero', 'poblano', 'bell', 'sweet potato', 'yam', 'taro', 'kiwi', 'papaya',
    'plum', 'nectarine', 'apricot', 'cherry', 'pear', 'fig', 'date', 'coconut',
    'pomegranate', 'passion fruit', 'starfruit', 'dragonfruit', 'lychee', 'persimmon'
  ];
  
  const meatKeywords = [
    'chicken', 'beef', 'pork', 'turkey', 'salmon', 'fish', 'shrimp', 'tuna', 'cod', 
    'steak', 'bacon', 'sausage', 'ground meat', 'lamb', 'veal', 'duck', 'goose',
    'tilapia', 'halibut', 'mahi', 'trout', 'catfish', 'crab', 'lobster', 'scallop',
    'clam', 'mussel', 'oyster', 'squid', 'calamari', 'octopus', 'anchov', 'sardine',
    'mackerel', 'herring', 'prosciutto', 'pancetta', 'chorizo', 'pepperoni', 'salami',
    'brisket', 'rib', 'tenderloin', 'sirloin', 'flank', 'chuck', 'wing', 'thigh',
    'drumstick', 'breast', 'leg quarter', 'mince', 'cutlet', 'chop', 'roast',
    'filet', 'loin', 'venison', 'bison', 'rabbit', 'quail', 'pheasant'
  ];
  
  const preparedKeywords = [
    'rotisserie', 'ready meal', 'prepared', 'pre made', 'premade', 'pre-made',
    'deli turkey', 'deli chicken', 'deli ham', 'deli meat', 'sliced turkey',
    'sliced ham', 'lunch meat', 'cold cut', 'pastrami', 'corned beef',
    'pre-cooked', 'precooked', 'ready to eat', 'heat and serve', 'meal kit',
    'takeout', 'leftover', 'pre-sliced', 'pre-cut', 'grab and go'
  ];
  
  const dairyKeywords = [
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg', 'mozzarella', 'parmesan', 
    'feta', 'cottage', 'ricotta', 'brie', 'camembert', 'gouda', 'cheddar', 'swiss',
    'provolone', 'gruyere', 'blue cheese', 'gorgonzola', 'mascarpone', 'queso',
    'sour cream', 'creme fraiche', 'half and half', 'whipping cream', 'heavy cream',
    'kefir', 'buttermilk', 'condensed milk', 'evaporated milk', 'whey', 'curds',
    'ghee', 'paneer', 'halloumi', 'colby', 'monterey jack', 'pepper jack',
    'cream cheese', 'neufchatel', 'custard', 'eggnog'
  ];
  
  const breadKeywords = [
    'bread', 'bagel', 'roll', 'bun', 'croissant', 'muffin', 'tortilla', 'pita',
    'naan', 'focaccia', 'ciabatta', 'baguette', 'sourdough', 'brioche', 'challah',
    'english muffin', 'flatbread', 'lavash', 'roti', 'chapati', 'paratha',
    'pretzel bun', 'hamburger bun', 'hot dog bun', 'dinner roll', 'kaiser',
    'crescent roll', 'biscuit', 'scone', 'cornbread', 'pancake', 'waffle',
    'crepe', 'wrap', 'taco shell', 'puff pastry', 'phyllo', 'pie crust'
  ];
  
  const pastaGrainsKeywords = [
    'rice', 'pasta', 'oat', 'quinoa', 'noodle', 'couscous', 'barley', 'grain', 'cereal',
    'spaghetti', 'penne', 'rigatoni', 'fettuccine', 'linguine', 'macaroni', 'orzo',
    'fusilli', 'rotini', 'farfalle', 'lasagna', 'ravioli', 'tortellini', 'gnocchi',
    'ramen', 'udon', 'soba', 'rice noodle', 'vermicelli', 'cellophane',
    'bulgur', 'farro', 'millet', 'buckwheat', 'polenta', 'grits', 'cornmeal',
    'wild rice', 'jasmine rice', 'basmati', 'arborio', 'sushi rice', 'brown rice',
    'bread crumb', 'panko', 'crouton', 'stuffing', 'dry bean', 'dry lentil',
    'split pea', 'pearl couscous', 'wheat berrie', 'amaranth', 'teff', 'spelt'
  ];
  
  const cannedKeywords = [
    'canned', 'can of', 'tinned', 'jarred', 'preserved', 'broth', 'stock',
    'canned bean', 'canned tomato', 'tomato paste', 'tomato sauce', 'crushed tomato',
    'diced tomato', 'stewed tomato', 'sun dried tomato', 'roasted pepper',
    'canned corn', 'canned pea', 'canned carrot', 'canned green bean',
    'canned tuna', 'canned salmon', 'canned chicken', 'canned sardine',
    'canned fruit', 'fruit cocktail', 'mandarin orange', 'pineapple chunk',
    'coconut milk', 'coconut cream', 'evaporated', 'condensed',
    'pickle', 'olive', 'caper', 'artichoke heart', 'heart of palm',
    'sauerkraut', 'kimchi', 'relish', 'chutney', 'jam', 'jelly', 'preserve',
    'marmalade', 'apple sauce', 'pumpkin puree', 'chipotle in adobo'
  ];
  
  const spiceKeywords = [
    'salt', 'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'seasoning', 'spice',
    'herb', 'rosemary', 'sage', 'bay leaf', 'dill', 'tarragon', 'marjoram',
    'nutmeg', 'clove', 'allspice', 'cardamom', 'coriander', 'turmeric', 'curry',
    'chili powder', 'cayenne', 'red pepper flake', 'crushed red', 'black pepper',
    'white pepper', 'garlic powder', 'onion powder', 'mustard powder', 'ginger powder',
    'five spice', 'garam masala', 'ras el hanout', 'za atar', 'herbes de provence',
    'italian seasoning', 'cajun', 'creole', 'old bay', 'taco seasoning', 'ranch seasoning',
    'bouillon', 'msg', 'celery salt', 'lemon pepper', 'everything bagel seasoning',
    'dried basil', 'dried parsley', 'dried cilantro', 'dried mint', 'saffron', 'sumac'
  ];
  
  const oilsSaucesKeywords = [
    'oil', 'sauce', 'vinegar', 'dressing', 'mayo', 'mayonnaise', 'mustard', 'ketchup', 
    'salsa', 'soy sauce', 'tamari', 'teriyaki', 'hoisin', 'oyster sauce', 'fish sauce',
    'worcestershire', 'hot sauce', 'sriracha', 'tabasco', 'buffalo sauce', 'bbq sauce',
    'barbecue', 'marinara', 'alfredo', 'pesto', 'hummus', 'tahini', 'tzatziki',
    'guacamole', 'aioli', 'remoulade', 'tartar sauce', 'cocktail sauce',
    'olive oil', 'vegetable oil', 'canola', 'coconut oil', 'sesame oil', 'avocado oil',
    'peanut oil', 'grapeseed', 'sunflower oil', 'corn oil', 'truffle oil',
    'balsamic', 'red wine vinegar', 'white wine vinegar', 'apple cider vinegar',
    'rice vinegar', 'sherry vinegar', 'malt vinegar', 'cooking spray', 'pam'
  ];
  
  const bakingKeywords = [
    'sugar', 'baking soda', 'baking powder', 'yeast', 'chocolate', 'vanilla', 'cocoa',
    'flour', 'honey', 'syrup', 'sweetener', 'maple syrup', 'molasses', 'agave',
    'stevia', 'splenda', 'brown sugar', 'powdered sugar', 'confectioner', 'icing sugar',
    'corn syrup', 'golden syrup', 'treacle', 'date syrup',
    'all purpose flour', 'bread flour', 'cake flour', 'pastry flour', 'self rising',
    'whole wheat flour', 'almond flour', 'coconut flour', 'oat flour', 'rice flour',
    'tapioca', 'cornstarch', 'arrowroot', 'xanthan gum', 'gelatin', 'pectin',
    'chocolate chip', 'cocoa powder', 'cacao', 'baking chocolate', 'white chocolate',
    'dark chocolate', 'semi sweet', 'unsweetened chocolate', 'butterscotch chip',
    'sprinkle', 'food coloring', 'extract', 'almond extract', 'peppermint extract',
    'cream of tartar', 'meringue powder', 'fondant', 'marzipan', 'lemon curd'
  ];
  
  const frozenKeywords = [
    'frozen', 'ice cream', 'gelato', 'sorbet', 'sherbet', 'frozen yogurt', 'popsicle',
    'ice pop', 'frozen pizza', 'frozen dinner', 'frozen vegetable', 'frozen fruit',
    'frozen berry', 'frozen pea', 'frozen corn', 'frozen spinach', 'frozen broccoli',
    'frozen fish', 'frozen shrimp', 'frozen chicken', 'fish stick', 'chicken nugget',
    'frozen waffle', 'frozen pancake', 'frozen bread', 'frozen bagel',
    'frozen pie', 'frozen cake', 'frozen cookie dough', 'ice cube'
  ];
  
  const snackKeywords = [
    'chip', 'cracker', 'nut', 'granola', 'almond', 'peanut', 'snack', 'pretzel',
    'cashew', 'walnut', 'pecan', 'pistachio', 'macadamia', 'hazelnut', 'brazil nut',
    'mixed nut', 'trail mix', 'seed', 'sunflower seed', 'pumpkin seed', 'chia seed',
    'flax seed', 'hemp seed', 'sesame seed', 'peanut butter', 'almond butter',
    'cashew butter', 'sunflower butter', 'nut butter', 'nutella', 'cookie butter',
    'popcorn', 'corn nut', 'rice cake', 'rice crisp', 'puffed rice', 'cheese puff',
    'tortilla chip', 'potato chip', 'veggie chip', 'pita chip', 'banana chip',
    'fruit snack', 'dried fruit', 'raisin', 'dried mango', 'dried apricot', 'craisin',
    'jerky', 'beef jerky', 'turkey jerky', 'meat stick', 'protein bar', 'granola bar',
    'energy bar', 'cereal bar', 'fig bar', 'cookie', 'biscotti', 'wafer'
  ];
  
  if (preparedKeywords.some(k => normalized.includes(k))) return 'Prepared Foods & Deli';
  if (frozenKeywords.some(k => normalized.includes(k))) return 'Frozen';
  if (produceKeywords.some(k => normalized.includes(k))) return 'Produce';
  if (meatKeywords.some(k => normalized.includes(k))) return 'Meat & Seafood';
  if (dairyKeywords.some(k => normalized.includes(k))) return 'Dairy & Eggs';
  if (breadKeywords.some(k => normalized.includes(k))) return 'Bread & Bakery';
  if (cannedKeywords.some(k => normalized.includes(k))) return 'Canned & Jarred';
  if (pastaGrainsKeywords.some(k => normalized.includes(k))) return 'Pasta, Rice & Grains';
  if (spiceKeywords.some(k => normalized.includes(k))) return 'Spices & Seasonings';
  if (oilsSaucesKeywords.some(k => normalized.includes(k))) return 'Oils, Sauces & Condiments';
  if (bakingKeywords.some(k => normalized.includes(k))) return 'Baking & Sweeteners';
  if (snackKeywords.some(k => normalized.includes(k))) return 'Snacks & Nuts';
  
  return 'Other';
}

const INITIAL_PANTRY: PantryItem[] = [
  { id: 'p1', name: 'Chicken Breast', normalizedName: 'chicken breast', foodGroup: 'Meat & Seafood', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p2', name: 'Olive Oil', normalizedName: 'olive oil', foodGroup: 'Oils, Sauces & Condiments', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p3', name: 'Eggs', normalizedName: 'egg', foodGroup: 'Dairy & Eggs', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p4', name: 'Rice', normalizedName: 'rice', foodGroup: 'Pasta, Rice & Grains', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p5', name: 'Garlic', normalizedName: 'garlic', foodGroup: 'Produce', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p6', name: 'Onion', normalizedName: 'onion', foodGroup: 'Produce', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p7', name: 'Salt', normalizedName: 'salt', foodGroup: 'Spices & Seasonings', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
  { id: 'p8', name: 'Pepper', normalizedName: 'pepper', foodGroup: 'Spices & Seasonings', state: 'have', lastUpdated: new Date().toISOString(), source: 'manual' },
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
  getMealAtSlot: (date: string, mealType: MealType) => PlannedMeal | undefined;
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
  
  getPlannerImpliedIngredients: () => Set<string>;
  addRecipeToCartWithDedupe: (recipe: Recipe, servings: number) => { added: boolean; message: string };
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
      lastCartAddKey: null,
      lastCartAddTime: 0,
      
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
      
      getPlannerImpliedIngredients: () => {
        const { planner } = get();
        const implied = new Set<string>();
        
        planner.forEach(meal => {
          const recipe = mockRecipes.find(r => r.id === meal.recipeId);
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
      
      addRecipeToCartWithDedupe: (recipe, servings) => {
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
        
        let addedCount = 0;
        let pantryCoveredCount = 0;
        
        recipe.ingredients.forEach(ing => {
          const normalized = normalizeIngredientName(ing.name);
          
          const inPantry = pantryNormalized.has(normalized) ||
            Array.from(pantryNormalized).some(p => p.includes(normalized) || normalized.includes(p));
          const inCart = cartNormalized.has(normalized) ||
            Array.from(cartNormalized).some(c => c.includes(normalized) || normalized.includes(c));
          
          if (inPantry) {
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
        
        let migratedCount = 0;
        const migratedPantry = state.pantry.map(item => {
          if (!isValidFoodGroup(item.foodGroup)) {
            migratedCount++;
            return {
              ...item,
              foodGroup: getIngredientFoodGroup(item.name)
            };
          }
          return item;
        });
        
        if (migratedCount > 0) {
          useDemoStore.setState({ pantry: migratedPantry });
          if (import.meta.env.DEV) {
            console.log(`[ReciPal] Migrated ${migratedCount} pantry items to new FoodGroup values`);
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
        }
      }
    }
  )
);
