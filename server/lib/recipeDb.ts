import { getSupabaseClient } from './supabaseServer';
import { randomUUID } from 'crypto';
import type { Recipe } from '../../client/src/lib/mock-data';

const DISH_TYPES = [
  "Baked Goods", "Beverage", "Bowl", "Bread", "Burger", "Candy", "Casserole",
  "Ceviche/raw", "Crepe/pancake", "Curry", "Dip/Spread", "Dumplings", "Flatbread",
  "Fritter", "Frozen Dessert", "Kebab/skewer", "Noodles", "Pasta", "Pie/Quiche",
  "Pizza", "Porridge/Oatmeal", "Rice Dish", "Salad", "Sandwich/Wrap",
  "Sauce/Condiment", "Savory Pastry", "Soup/Stew", "Stir-fry", "Sushi", "Taco/Burrito",
] as const;

const DISH_TYPE_KEYWORDS: Record<string, string[]> = {
  "Pasta": ["pasta", "spaghetti", "penne", "linguine", "fettuccine", "macaroni", "rigatoni", "fusilli", "orzo", "lasagna", "carbonara", "bolognese", "alfredo"],
  "Soup/Stew": ["soup", "broth", "bisque", "chowder", "consomme", "gazpacho", "minestrone", "pho", "stew", "goulash", "tagine", "bourguignon", "chupe"],
  "Salad": ["salad", "slaw", "coleslaw"],
  "Curry": ["curry", "tikka masala", "korma", "vindaloo", "dal"],
  "Stir-fry": ["stir fry", "stir-fry", "stirfry", "wok", "saltado"],
  "Pizza": ["pizza"],
  "Burger": ["burger", "hamburger", "cheeseburger"],
  "Sandwich/Wrap": ["sandwich", "sub", "hoagie", "panini", "club sandwich", "blt", "wrap"],
  "Taco/Burrito": ["taco", "burrito", "quesadilla", "enchilada", "fajita"],
  "Sushi": ["sushi", "maki", "nigiri", "sashimi"],
  "Rice Dish": ["rice", "risotto", "biryani", "paella", "pilaf", "fried rice", "jambalaya"],
  "Noodles": ["noodle", "ramen", "udon", "soba", "pad thai", "lo mein", "chow mein"],
  "Casserole": ["casserole"],
  "Baked Goods": ["cake", "cheesecake", "cookie", "cookies", "muffin", "muffins", "biscuit", "biscuits", "scone", "brownie", "cupcake"],
  "Pie/Quiche": ["pie", "tart", "quiche"],
  "Savory Pastry": ["pastry", "croissant", "danish", "empanada", "samosa", "puff pastry"],
  "Bread": ["bread", "loaf", "baguette", "ciabatta", "sourdough", "toast"],
  "Crepe/pancake": ["pancake", "crepe", "waffle"],
  "Bowl": ["smoothie bowl", "bowl", "acai", "buddha bowl", "poke bowl"],
  "Dumplings": ["dumpling", "gyoza", "wonton", "pierogi"],
  "Kebab/skewer": ["kebab", "skewer", "satay"],
  "Fritter": ["fritter", "fritters"],
  "Dip/Spread": ["dip", "spread", "salsa", "pesto", "hummus", "guacamole"],
  "Beverage": ["drink", "cocktail", "smoothie", "juice", "lemonade", "tea", "coffee"],
  "Porridge/Oatmeal": ["porridge", "oatmeal", "congee"],
  "Flatbread": ["flatbread", "naan", "pita"],
  "Candy": ["candy", "fudge", "truffle"],
  "Frozen Dessert": ["ice cream", "sorbet", "gelato", "frozen yogurt", "popsicle"],
  "Sauce/Condiment": ["sauce", "condiment", "chutney", "relish", "aioli", "vinaigrette", "salsa criolla"],
  "Ceviche/raw": ["ceviche", "cebiche", "tartare", "crudo", "poke"],
};

function classifyDishType(title: string, ingredients?: string[]): string {
  const text = title.toLowerCase();

  for (const [dishType, keywords] of Object.entries(DISH_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return dishType;
    }
  }

  return "Bowl";
}

function sanitizeSubCategory(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s.toUpperCase() === 'NULL') return null;
  return s;
}

function formatTime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—';
  return `${minutes} min`;
}

interface FeedOptions {
  limit?: number;
  page?: number;
  mealType?: string;
  cuisine?: string;
  sub_category?: string;
  dish_type?: string;
}

const BREAKFAST_DISH_TYPES = new Set(["Crepe/pancake", "Porridge/Oatmeal"]);
const BREAKFAST_KEYWORDS = [
  "pancake", "waffle", "omelette", "omelet", "french toast", "cereal",
  "granola", "breakfast", "hash brown", "hashbrown", "scrambl", "benedict",
  "brunch", "morning", "eggs and", "egg and", "overnight oat",
];
const LUNCH_DISH_TYPES = new Set(["Salad", "Sandwich/Wrap", "Soup/Stew"]);
const LUNCH_KEYWORDS = ["salad", "sandwich", "wrap", "club", "soup", "lunch"];
const DINNER_DISH_TYPES = new Set([
  "Pasta", "Curry", "Stir-fry", "Pizza", "Burger", "Taco/Burrito",
  "Casserole", "Rice Dish", "Noodles", "Kebab/skewer", "Sushi", "Dumplings",
  "Ceviche/raw",
]);
const DESSERT_DISH_TYPES = new Set(["Baked Goods", "Frozen Dessert", "Candy"]);
const DESSERT_KEYWORDS = [
  "cake", "cookie", "brownie", "ice cream", "pudding", "dessert", "fudge",
  "cheesecake", "cupcake", "candy", "truffle", "sundae", "mousse",
  "tiramisu", "cobbler", "crumble", "sorbet", "gelato", "macaron",
  "donut", "doughnut", "churro", "s'more",
];
const SNACK_DISH_TYPES = new Set(["Dip/Spread", "Fritter", "Flatbread"]);
const SNACK_KEYWORDS = [
  "dip", "appetizer", "snack", "hummus", "guacamole", "salsa", "wings",
  "bites", "chips", "nachos", "spring roll", "egg roll", "bruschetta",
  "crostini", "poppers", "sliders",
];

function inferMealTypes(title: string, dishType: string, dbMealType: string | null): string[] {
  const types = new Set<string>();
  const titleLower = title.toLowerCase();

  if (BREAKFAST_DISH_TYPES.has(dishType) || BREAKFAST_KEYWORDS.some(k => titleLower.includes(k))) {
    types.add("breakfast");
  }

  if (DESSERT_DISH_TYPES.has(dishType) || DESSERT_KEYWORDS.some(k => titleLower.includes(k))) {
    types.add("dessert");
  } else if (dishType === "Pie/Quiche") {
    const sweetPieKeywords = ["cream", "chocolate", "banana", "apple", "cherry", "pecan", "pumpkin", "lemon", "berry", "fruit", "sweet"];
    if (sweetPieKeywords.some(k => titleLower.includes(k))) {
      types.add("dessert");
    } else {
      types.add("dinner");
    }
  }

  if (SNACK_DISH_TYPES.has(dishType) || SNACK_KEYWORDS.some(k => titleLower.includes(k))) {
    types.add("snack");
  }

  if (LUNCH_DISH_TYPES.has(dishType) || LUNCH_KEYWORDS.some(k => titleLower.includes(k))) {
    types.add("lunch");
    if (!types.has("breakfast") && !types.has("dessert") && !types.has("snack")) {
      types.add("dinner");
    }
  }

  if (DINNER_DISH_TYPES.has(dishType)) {
    types.add("dinner");
  }

  if (dishType === "Bread") {
    types.add("breakfast");
    types.add("snack");
  }

  if (dishType === "Beverage" || dishType === "Sauce/Condiment") {
    types.add("snack");
  }

  if (dishType === "Bowl") {
    if (BREAKFAST_KEYWORDS.some(k => titleLower.includes(k))) {
      types.add("breakfast");
    } else {
      types.add("lunch");
      types.add("dinner");
    }
  }

  if (dishType === "Savory Pastry") {
    types.add("lunch");
    types.add("snack");
  }

  if (types.size === 0) {
    if (dbMealType) {
      types.add(dbMealType.toLowerCase());
    } else {
      types.add("dinner");
    }
  }

  return Array.from(types);
}

function mapSupabaseRecipeToCanonical(
  row: any,
  nutritionRow: any,
  ingredientRows?: any[]
): Recipe {
  const prepMinutes = row.prep_time_minutes ?? 0;
  const cookMinutes = row.cook_time_minutes ?? 0;
  const totalMinutes = row.total_time_minutes ?? (prepMinutes + cookMinutes);

  const calories = nutritionRow?.calories_per_serving ?? 0;
  const protein = nutritionRow?.protein_per_serving ?? 0;
  const carbs = nutritionRow?.carbs_per_serving ?? 0;
  const fat = nutritionRow?.fat_per_serving ?? 0;

  const cuisineVal = row.cuisine || 'American';
  const titleStr = row.title || 'Untitled Recipe';

  const ingredients: { name: string; amount: string; unit: string }[] = [];
  if (ingredientRows && ingredientRows.length > 0) {
    for (const ing of ingredientRows) {
      ingredients.push({
        name: ing.name || 'Unknown',
        amount: String(ing.amount ?? '1'),
        unit: ing.unit || '',
      });
    }
  }

  const steps: (string | { step: number; time: string; equipment: string; instruction: string })[] = [];
  if (row.steps && Array.isArray(row.steps)) {
    for (const s of row.steps) {
      if (typeof s === 'string') {
        steps.push(s);
      } else if (s && typeof s === 'object' && s.instruction) {
        steps.push({
          step: Number(s.step) || 0,
          time: s.time || '',
          equipment: s.equipment || '',
          instruction: s.instruction,
        });
      }
    }
  }

  const dbDishType = row.dish_type;
  const dishType = dbDishType && DISH_TYPES.includes(dbDishType)
    ? dbDishType
    : classifyDishType(titleStr);

  const mealTypes = inferMealTypes(titleStr, dishType, row.meal_type);

  return {
    id: String(row.recipe_id),
    title: titleStr,
    image: row.image_url || '',
    cuisine: cuisineVal,
    sub_category: sanitizeSubCategory(row.sub_category),
    dish_type: dishType,
    prepTime: formatTime(prepMinutes),
    cookTime: formatTime(cookMinutes),
    totalTime: formatTime(totalMinutes),
    servings: Number(row.servings) || 1,
    calories: Math.round(Number(calories)),
    protein: Math.round(Number(protein)),
    carbs: Math.round(Number(carbs)),
    fat: Math.round(Number(fat)),
    mealTypes,
    cookingStyle: cuisineVal,
    ingredients,
    steps,
  };
}

export async function getForYouFeed(options: FeedOptions = {}): Promise<{
  recipes: Recipe[];
  page: number;
  limit: number;
}> {
  const correlationId = randomUUID().slice(0, 8);
  const limit = options.limit || 20;
  const page = options.page || 0;
  const offset = page * limit;

  console.log(`[getForYouFeed] ${correlationId} params cuisine=${options.cuisine || 'none'} sub_category=${options.sub_category || 'none'} dish_type=${options.dish_type || 'none'} page=${page} limit=${limit}`);

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('recipes')
      .select(`
        *,
        recipe_nutrition_totals (*),
        recipe_ingredients (name, amount, unit, sort_order)
      `);

    if (options.cuisine) {
      query = query.eq('cuisine', options.cuisine);
    }
    if (options.sub_category) {
      query = query.eq('sub_category', options.sub_category);
    }
    if (options.dish_type) {
      query = query.eq('dish_type', options.dish_type);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('recipe_id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.log(`[getForYouFeed] ${correlationId} error status=500 supabase_error=${error.message} code=${error.code} details=${error.details}`);
      throw new Error('Database query failed');
    }

    const recipes: Recipe[] = (data || []).map((row: any) => {
      const nutrition = Array.isArray(row.recipe_nutrition_totals)
        ? row.recipe_nutrition_totals[0]
        : row.recipe_nutrition_totals;
      return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
    });

    console.log(`[getForYouFeed] ${correlationId} status=200 count=${recipes.length}`);
    return { recipes, page, limit };
  } catch (err: any) {
    console.log(`[getForYouFeed] ${correlationId} status=500 error=${err?.message}`);
    throw err;
  }
}

export async function getSomethingNewFeed(options: FeedOptions = {}): Promise<{
  recipes: Recipe[];
  page: number;
  limit: number;
}> {
  const correlationId = randomUUID().slice(0, 8);
  const limit = options.limit || 20;
  const page = options.page || 0;
  const offset = page * limit;

  console.log(`[getSomethingNewFeed] ${correlationId} params cuisine=${options.cuisine || 'none'} sub_category=${options.sub_category || 'none'} page=${page} limit=${limit}`);

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('recipes')
      .select(`
        *,
        recipe_nutrition_totals (*),
        recipe_ingredients (name, amount, unit, sort_order)
      `);

    if (options.cuisine) {
      query = query.eq('cuisine', options.cuisine);
    }
    if (options.sub_category) {
      query = query.eq('sub_category', options.sub_category);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('recipe_id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.log(`[getSomethingNewFeed] ${correlationId} error status=500 supabase_error=${error.message} code=${error.code} details=${error.details}`);
      throw new Error('Database query failed');
    }

    const recipes: Recipe[] = (data || []).map((row: any) => {
      const nutrition = Array.isArray(row.recipe_nutrition_totals)
        ? row.recipe_nutrition_totals[0]
        : row.recipe_nutrition_totals;
      return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
    });

    console.log(`[getSomethingNewFeed] ${correlationId} status=200 count=${recipes.length}`);
    return { recipes, page, limit };
  } catch (err: any) {
    console.log(`[getSomethingNewFeed] ${correlationId} status=500 error=${err?.message}`);
    throw err;
  }
}

export async function getRecipeByIdFromSupabase(recipeId: string): Promise<Recipe | null> {
  const correlationId = randomUUID().slice(0, 8);

  if (!recipeId || recipeId.trim() === '') {
    console.log(`[getRecipeById] ${correlationId} invalid_id status=400`);
    return null;
  }

  try {
    const supabase = getSupabaseClient();

    const { data: recipeRow, error: recipeError } = await supabase
      .from('recipes')
      .select(`
        *,
        recipe_nutrition_totals (*),
        recipe_ingredients (
          *,
          ingredients (
            *,
            ingredient_nutrients (*)
          )
        )
      `)
      .eq('recipe_id', recipeId)
      .single();

    if (recipeError || !recipeRow) {
      console.log(`[getRecipeById] ${correlationId} supabase_miss id=${recipeId} status=404`);
      return null;
    }

    const nutrition = Array.isArray(recipeRow.recipe_nutrition_totals)
      ? recipeRow.recipe_nutrition_totals[0]
      : recipeRow.recipe_nutrition_totals;

    const ingredientRows = recipeRow.recipe_ingredients || [];

    const recipe = mapSupabaseRecipeToCanonical(recipeRow, nutrition, ingredientRows);

    console.log(`[getRecipeById] ${correlationId} id=${recipeId} status=200`);
    return recipe;
  } catch (err: any) {
    console.log(`[getRecipeById] ${correlationId} supabase_error id=${recipeId} status=500`);
    return null;
  }
}

export async function getPlannerCandidates(options: { meal_type?: string } = {}): Promise<{
  recipes: Recipe[];
}> {
  const correlationId = randomUUID().slice(0, 8);
  const limit = 200;

  console.log(`[getPlannerCandidates] ${correlationId} params meal_type=${options.meal_type || 'none'} limit=${limit}`);

  try {
    const supabase = getSupabaseClient();

    let query_builder = supabase
      .from('recipes')
      .select(`
        *,
        recipe_nutrition_totals (*),
        recipe_ingredients (name, amount, unit, sort_order)
      `);

    if (options.meal_type) {
      query_builder = query_builder.eq('meal_type', options.meal_type);
    }

    const { data, error } = await query_builder
      .order('created_at', { ascending: false })
      .order('recipe_id', { ascending: false })
      .range(0, limit - 1);

    if (error) {
      console.log(`[getPlannerCandidates] ${correlationId} error status=500 supabase_error=${error.message} code=${error.code} details=${error.details}`);
      throw new Error('Database query failed');
    }

    const recipes: Recipe[] = (data || []).map((row: any) => {
      const nutrition = Array.isArray(row.recipe_nutrition_totals)
        ? row.recipe_nutrition_totals[0]
        : row.recipe_nutrition_totals;
      return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
    });

    console.log(`[getPlannerCandidates] ${correlationId} status=200 count=${recipes.length}`);
    return { recipes };
  } catch (err: any) {
    console.log(`[getPlannerCandidates] ${correlationId} status=500 error=${err?.message}`);
    throw err;
  }
}

export async function searchRecipesInSupabase(query: string, options: FeedOptions = {}): Promise<{
  recipes: Recipe[];
  page: number;
  limit: number;
}> {
  const correlationId = randomUUID().slice(0, 8);
  const limit = options.limit || 20;
  const page = options.page || 0;
  const offset = page * limit;

  if (!query || query.trim() === '') {
    return { recipes: [], page, limit };
  }

  try {
    const supabase = getSupabaseClient();
    const searchTerm = `%${query.trim()}%`;

    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        recipe_nutrition_totals (*),
        recipe_ingredients (name, amount, unit, sort_order)
      `)
      .or(`title.ilike.${searchTerm},cuisine.ilike.${searchTerm}`)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })
      .order('recipe_id', { ascending: false });

    if (error) {
      console.log(`[searchRecipes] ${correlationId} error status=500`);
      throw new Error('Database query failed');
    }

    const recipes: Recipe[] = (data || []).map((row: any) => {
      const nutrition = Array.isArray(row.recipe_nutrition_totals)
        ? row.recipe_nutrition_totals[0]
        : row.recipe_nutrition_totals;
      return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
    });

    console.log(`[searchRecipes] ${correlationId} q="${query}" recipes_source=supabase endpoint=/api/recipes/search page=${page} count=${recipes.length}`);
    return { recipes, page, limit };
  } catch (err: any) {
    console.log(`[searchRecipes] ${correlationId} status=500`);
    throw err;
  }
}
