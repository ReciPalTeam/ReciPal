import { getSupabaseClient } from './supabaseServer';
import { randomUUID } from 'crypto';
import type { Recipe } from '../../client/src/lib/mock-data';

const DISH_TYPES = [
  "Appetizer", "Biscuits", "Bread", "Bruschetta", "Burger", "Cake", "Candy",
  "Casserole", "Cookies", "Curry", "Custard/Pudding", "Dip/Spread", "Drink",
  "Dumplings", "Eggs", "Flatbread", "Fried Rice", "Fritters", "Frozen Dessert",
  "Grilled Meat", "Kebab", "Meatballs", "Muffins", "Noodles", "Other", "Pancake",
  "Pancakes/Crepes", "Pasta", "Pastry", "Pie/Tart", "Pizza", "Porridge", "Quiche",
  "Rice Dish", "Roast", "Salad", "Sandwich", "Seafood", "Side Dish", "Skillet",
  "Smoothie/Bowl", "Snack/Appetizer", "Soup", "Steak", "Stew", "Stir-Fry",
  "Sushi/Rolls", "Tacos/Wraps", "Toast",
] as const;

const DISH_TYPE_KEYWORDS: Record<string, string[]> = {
  "Pasta": ["pasta", "spaghetti", "penne", "linguine", "fettuccine", "macaroni", "rigatoni", "fusilli", "orzo", "lasagna", "carbonara", "bolognese", "alfredo"],
  "Soup": ["soup", "broth", "bisque", "chowder", "consomme", "gazpacho", "minestrone", "pho"],
  "Salad": ["salad", "slaw", "coleslaw"],
  "Stew": ["stew", "goulash", "tagine", "bourguignon"],
  "Curry": ["curry", "tikka masala", "korma", "vindaloo", "dal"],
  "Stir-Fry": ["stir fry", "stir-fry", "stirfry", "wok"],
  "Pizza": ["pizza"],
  "Burger": ["burger", "hamburger", "cheeseburger"],
  "Sandwich": ["sandwich", "sub", "hoagie", "panini", "club sandwich", "blt"],
  "Tacos/Wraps": ["taco", "burrito", "wrap", "quesadilla", "enchilada", "fajita"],
  "Sushi/Rolls": ["sushi", "roll", "maki", "nigiri", "sashimi"],
  "Rice Dish": ["rice", "risotto", "biryani", "paella", "pilaf", "fried rice", "jambalaya"],
  "Fried Rice": ["fried rice"],
  "Noodles": ["noodle", "ramen", "udon", "soba", "pad thai", "lo mein", "chow mein"],
  "Grilled Meat": ["grilled chicken", "grilled steak", "grilled pork", "grilled fish", "bbq", "barbecue"],
  "Steak": ["steak", "filet mignon", "ribeye", "sirloin", "t-bone"],
  "Roast": ["roast", "roasted"],
  "Seafood": ["shrimp", "salmon", "tuna", "cod", "tilapia", "crab", "lobster", "scallop", "fish"],
  "Casserole": ["casserole"],
  "Skillet": ["skillet"],
  "Cake": ["cake", "cheesecake"],
  "Cookies": ["cookie", "cookies"],
  "Pie/Tart": ["pie", "tart"],
  "Muffins": ["muffin", "muffins"],
  "Pastry": ["pastry", "croissant", "danish"],
  "Bread": ["bread", "loaf", "baguette", "ciabatta", "sourdough"],
  "Pancakes/Crepes": ["pancake", "crepe", "waffle"],
  "Smoothie/Bowl": ["smoothie", "bowl", "acai"],
  "Eggs": ["egg", "omelette", "omelet", "frittata", "scramble"],
  "Dumplings": ["dumpling", "gyoza", "wonton", "pierogi"],
  "Kebab": ["kebab", "skewer", "satay"],
  "Meatballs": ["meatball", "meatballs"],
  "Fritters": ["fritter", "fritters"],
  "Appetizer": ["appetizer", "bruschetta", "crostini"],
  "Snack/Appetizer": ["snack", "dip", "hummus", "guacamole"],
  "Dip/Spread": ["dip", "spread", "salsa", "pesto"],
  "Drink": ["drink", "cocktail", "smoothie", "juice", "lemonade"],
  "Porridge": ["porridge", "oatmeal", "congee"],
  "Quiche": ["quiche"],
  "Flatbread": ["flatbread", "naan", "pita"],
  "Toast": ["toast", "bruschetta"],
  "Biscuits": ["biscuit", "biscuits", "scone"],
  "Candy": ["candy", "fudge", "truffle"],
  "Frozen Dessert": ["ice cream", "sorbet", "gelato", "frozen yogurt", "popsicle"],
  "Custard/Pudding": ["custard", "pudding", "mousse", "panna cotta"],
  "Side Dish": ["side dish", "side"],
};

function classifyDishType(title: string, ingredients?: string[]): string {
  const text = title.toLowerCase();

  for (const [dishType, keywords] of Object.entries(DISH_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return dishType;
    }
  }

  return "Other";
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
  dish_type?: string;
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

  const steps: string[] = [];
  if (row.steps && Array.isArray(row.steps)) {
    for (const s of row.steps) {
      if (typeof s === 'string') {
        steps.push(s);
      } else if (s && typeof s === 'object' && s.instruction) {
        steps.push(s.instruction);
      }
    }
  }

  const dbDishType = row.dish_type;
  const dishType = dbDishType && DISH_TYPES.includes(dbDishType)
    ? dbDishType
    : classifyDishType(titleStr);

  const mealTypes: string[] = [];
  if (row.meal_type) {
    mealTypes.push(row.meal_type);
  }
  if (mealTypes.length === 0) {
    mealTypes.push('Dinner');
  }

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

  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('recipes')
      .select(`
        *,
        recipe_nutrition_totals (*),
        recipe_ingredients (name, amount, unit, sort_order)
      `)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })
      .order('recipe_id', { ascending: false });

    if (options.cuisine) {
      query = query.ilike('cuisine', `%${options.cuisine}%`);
    }
    if (options.dish_type) {
      query = query.eq('dish_type', options.dish_type);
    }

    const { data, error } = await query;

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

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        recipe_nutrition_totals (*),
        recipe_ingredients (name, amount, unit, sort_order)
      `)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })
      .order('recipe_id', { ascending: false });

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
