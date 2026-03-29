import { getSupabaseClient } from './supabaseServer';
import { randomUUID } from 'crypto';
import type { Recipe } from '../../client/src/lib/mock-data';
import type { SupabaseRecipe, SupabaseRecipeNutritionTotals, SupabaseRecipeIngredient } from '../../shared/supabase-types';

const DISH_TYPES = [
  "Beans/Legumes", "Beverage", "Braised/Stewed Meat", "Bread",
  "Breaded/Fried Entree", "Breakfast Plate", "Burger", "Candy",
  "Casserole", "Ceviche/raw", "Crepe/pancake", "Curry",
  "Dessert/Pudding", "Dip/Spread", "Dumplings", "Egg Dish",
  "Flatbread", "Fritter", "Frozen Dessert", "Kebab/skewer",
  "Meatballs/Patties", "Noodles", "Pasta", "Pie/Quiche",
  "Pizza", "Porridge/Oatmeal", "Rice Dish", "Roasted/Grilled Meat",
  "Salad", "Sandwich/Handheld", "Sauce/Condiment", "Savory Pastry",
  "Seafood", "Side Dish", "Skillet/Sauté", "Soup/Stew",
  "Stir-fry", "Stuffed", "Sushi", "Sweet Bakes",
  "Taco/Burrito", "Vegetable Main",
] as const;

const DISH_TYPE_KEYWORDS: Record<string, string[]> = {
  "Beans/Legumes": ["beans", "lentil", "lentils", "chickpea", "chickpeas", "dal", "black bean", "kidney bean", "pinto bean", "legume"],
  "Beverage": ["drink", "cocktail", "smoothie", "juice", "lemonade", "tea", "coffee", "shake", "milkshake"],
  "Braised/Stewed Meat": ["braised", "braise", "stewed", "pot roast", "short rib", "osso buco", "pulled pork", "carnitas"],
  "Bread": ["bread", "loaf", "baguette", "ciabatta", "sourdough", "toast", "rolls", "cornbread"],
  "Breaded/Fried Entree": ["fried chicken", "chicken tender", "chicken nugget", "schnitzel", "katsu", "tonkatsu", "breaded", "fried"],
  "Breakfast Plate": ["breakfast plate", "breakfast", "brunch", "eggs benedict", "french toast", "breakfast burrito"],
  "Burger": ["burger", "hamburger", "cheeseburger"],
  "Candy": ["candy", "fudge", "truffle", "caramel", "toffee"],
  "Casserole": ["casserole"],
  "Ceviche/raw": ["ceviche", "cebiche", "tartare", "crudo", "poke"],
  "Crepe/pancake": ["pancake", "crepe", "waffle"],
  "Curry": ["curry", "tikka masala", "korma", "vindaloo"],
  "Dessert/Pudding": ["pudding", "flan", "mousse", "custard", "tiramisu", "trifle", "panna cotta"],
  "Dip/Spread": ["dip", "spread", "salsa", "pesto", "hummus", "guacamole"],
  "Dumplings": ["dumpling", "gyoza", "wonton", "pierogi"],
  "Egg Dish": ["omelette", "omelet", "frittata", "scrambled egg", "deviled egg", "egg bake", "quiche"],
  "Flatbread": ["flatbread", "naan", "pita"],
  "Fritter": ["fritter", "fritters"],
  "Frozen Dessert": ["ice cream", "sorbet", "gelato", "frozen yogurt", "popsicle"],
  "Kebab/skewer": ["kebab", "skewer", "satay"],
  "Meatballs/Patties": ["meatball", "meatballs", "patty", "patties", "croquette", "falafel"],
  "Noodles": ["noodle", "ramen", "udon", "soba", "pad thai", "lo mein", "chow mein"],
  "Pasta": ["pasta", "spaghetti", "penne", "linguine", "fettuccine", "macaroni", "rigatoni", "fusilli", "orzo", "lasagna", "carbonara", "bolognese", "alfredo"],
  "Pie/Quiche": ["pie", "tart", "quiche", "pot pie"],
  "Pizza": ["pizza"],
  "Porridge/Oatmeal": ["porridge", "oatmeal", "congee"],
  "Rice Dish": ["rice", "risotto", "biryani", "paella", "pilaf", "fried rice", "jambalaya"],
  "Roasted/Grilled Meat": ["roast", "roasted", "grilled", "grilled chicken", "roast beef", "roasted pork", "bbq", "barbecue", "ribs", "spare ribs"],
  "Salad": ["salad", "slaw", "coleslaw", "pasta salad"],
  "Sandwich/Handheld": ["sandwich", "sub", "hoagie", "panini", "club sandwich", "blt", "wrap", "gyro", "shawarma"],
  "Sauce/Condiment": ["sauce", "condiment", "chutney", "relish", "aioli", "vinaigrette", "salsa criolla"],
  "Savory Pastry": ["pastry", "croissant", "danish", "empanada", "samosa", "puff pastry"],
  "Seafood": ["shrimp", "crab", "lobster", "clam", "mussel", "oyster", "scallop", "calamari", "fish", "salmon", "tuna", "cod"],
  "Side Dish": ["side dish", "side", "mashed potato", "green beans", "corn on the cob", "roasted vegetables"],
  "Skillet/Sauté": ["skillet", "sauté", "saute", "pan-fried", "pan fried"],
  "Soup/Stew": ["soup", "broth", "bisque", "chowder", "consomme", "gazpacho", "minestrone", "pho", "stew", "goulash", "tagine", "bourguignon", "chupe", "chili"],
  "Stir-fry": ["stir fry", "stir-fry", "stirfry", "wok", "saltado"],
  "Stuffed": ["stuffed", "stuffed pepper", "stuffed chicken", "stuffed mushroom", "dolma", "cabbage roll"],
  "Sushi": ["sushi", "maki", "nigiri", "sashimi"],
  "Sweet Bakes": ["cake", "cheesecake", "cookie", "cookies", "brownie", "cupcake", "muffin", "scone", "donut"],
  "Taco/Burrito": ["taco", "burrito", "quesadilla", "enchilada", "fajita", "chilaquiles"],
  "Vegetable Main": ["vegetable", "veggie", "vegetarian", "vegan", "ratatouille", "buddha bowl"],
};

function classifyDishType(title: string, ingredients?: string[]): string {
  const text = title.toLowerCase();

  for (const [dishType, keywords] of Object.entries(DISH_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return dishType;
    }
  }

  return "Side Dish";
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
  maxServingSize?: number;
  allergens?: string[];
  dietaryRestrictions?: string[];
  timeDifficulty?: string;
  seed?: number;  // Changes ordering for variety on refresh
}

function mapSupabaseRecipeToCanonical(
  row: SupabaseRecipe,
  nutritionRow: SupabaseRecipeNutritionTotals | null | undefined,
  ingredientRows?: SupabaseRecipeIngredient[]
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
      } else if (s && typeof s === 'object' && (s as Record<string, unknown>).instruction) {
        const stepObj = s as Record<string, unknown>;
        steps.push({
          step: Number(stepObj.step) || 0,
          time: String(stepObj.time || ''),
          equipment: String(stepObj.equipment || ''),
          instruction: String(stepObj.instruction),
        });
      }
    }
  }

  const dbDishType = row.dish_type;
  const dishType = dbDishType && (DISH_TYPES as readonly string[]).includes(dbDishType)
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
    min_servings: row.min_servings ? Number(row.min_servings) : undefined,
    calories: Math.round(Number(calories)),
    protein: Math.round(Number(protein)),
    carbs: Math.round(Number(carbs)),
    fat: Math.round(Number(fat)),
    mealTypes,
    cookingStyle: cuisineVal,
    ingredients,
    steps,
    allergens: Array.isArray(row.allergens) ? row.allergens : [],
    dietary_restrictions: Array.isArray(row.dietary_restrictions) ? row.dietary_restrictions : [],
    total_time_minutes: totalMinutes > 0 ? totalMinutes : undefined,
    prep_time_minutes: prepMinutes > 0 ? prepMinutes : undefined,
    cook_time_minutes: cookMinutes > 0 ? cookMinutes : undefined,
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

  const seed = options.seed ?? 0;
  console.log(`[getForYouFeed] ${correlationId} params cuisine=${options.cuisine || 'none'} sub_category=${options.sub_category || 'none'} dish_type=${options.dish_type || 'none'} page=${page} limit=${limit} seed=${seed}`);

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
    if (options.maxServingSize) {
      query = query.or(`min_servings.is.null,min_servings.lte.${options.maxServingSize}`);
    }
    if (options.mealType) {
      if (options.mealType.includes(',')) {
        query = query.in('meal_type', options.mealType.split(','));
      } else {
        query = query.eq('meal_type', options.mealType);
      }
    }
    if (options.allergens && options.allergens.length > 0) {
      query = query.not('allergens', 'ov', `{${options.allergens.join(',')}}`);
    }
    if (options.dietaryRestrictions && options.dietaryRestrictions.length > 0) {
      query = query.contains('dietary_restrictions', options.dietaryRestrictions);
    }
    if (options.timeDifficulty) {
      if (options.timeDifficulty === 'quick') {
        query = query.lte('total_time_minutes', 30);
      } else if (options.timeDifficulty === 'comfortable') {
        query = query.gt('total_time_minutes', 30).lte('total_time_minutes', 60);
      } else if (options.timeDifficulty === 'involved') {
        query = query.gt('total_time_minutes', 60);
      }
    }

    // Vary ordering based on seed so refresh shows different recipes.
    // Alternate between different sort columns and directions.
    const sortStrategies = [
      { column: 'created_at', ascending: false },
      { column: 'title', ascending: true },
      { column: 'recipe_id', ascending: true },
      { column: 'created_at', ascending: true },
      { column: 'title', ascending: false },
      { column: 'recipe_id', ascending: false },
    ];
    const strategy = sortStrategies[seed % sortStrategies.length];

    const { data, error } = await query
      .order(strategy.column, { ascending: strategy.ascending })
      .range(offset, offset + limit - 1);

    if (error) {
      console.log(`[getForYouFeed] ${correlationId} error status=500 supabase_error=${error.message} code=${error.code} details=${error.details}`);
      throw new Error('Database query failed');
    }

    const recipes: Recipe[] = (data || []).map((row: SupabaseRecipe) => {
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
  const seed = options.seed ?? 0;

  // 3:1 copycat ratio — 75% copycat, 25% non-copycat
  const copycatLimit = Math.ceil(limit * 0.75);
  const nonCopycatLimit = limit - copycatLimit;

  // Within non-copycat: bias toward American (~60%)
  const nonCopycatAmericanLimit = Math.ceil(nonCopycatLimit * 0.6);
  const nonCopycatOtherLimit = nonCopycatLimit - nonCopycatAmericanLimit;

  console.log(`[getSomethingNewFeed] ${correlationId} page=${page} limit=${limit} seed=${seed} copycatLimit=${copycatLimit} nonCopycat=${nonCopycatAmericanLimit}US+${nonCopycatOtherLimit}other`);

  try {
    const supabase = getSupabaseClient();

    const sortStrategies = [
      { column: 'created_at', ascending: false },
      { column: 'title', ascending: true },
      { column: 'recipe_id', ascending: true },
      { column: 'created_at', ascending: true },
      { column: 'title', ascending: false },
      { column: 'recipe_id', ascending: false },
    ];
    const strategy = sortStrategies[seed % sortStrategies.length];

    // Shared filter builder
    const applySharedFilters = (query: any) => {
      if (options.mealType) {
        if (options.mealType.includes(',')) {
          query = query.in('meal_type', options.mealType.split(','));
        } else {
          query = query.eq('meal_type', options.mealType);
        }
      }
      if (options.allergens && options.allergens.length > 0) {
        query = query.not('allergens', 'ov', `{${options.allergens.join(',')}}`);
      }
      if (options.dietaryRestrictions && options.dietaryRestrictions.length > 0) {
        query = query.contains('dietary_restrictions', options.dietaryRestrictions);
      }
      return query;
    };

    const selectClause = `*, recipe_nutrition_totals (*), recipe_ingredients (name, amount, unit, sort_order)`;

    const mapRows = (rows: SupabaseRecipe[]): Recipe[] =>
      rows.map((row) => {
        const nutrition = Array.isArray(row.recipe_nutrition_totals)
          ? row.recipe_nutrition_totals[0]
          : row.recipe_nutrition_totals;
        return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
      });

    let copycatRecipes: Recipe[] = [];
    let americanRecipes: Recipe[] = [];
    let otherRecipes: Recipe[] = [];

    if (options.cuisine) {
      // Cuisine filter active: query within that cuisine, split by copycat title vs regular
      const copycatOffset = page * copycatLimit;
      const regularOffset = page * nonCopycatLimit;

      // Copycat recipes = cuisine:'Copycat' OR title starts with 'Copycat' within the selected cuisine
      let copycatQuery = supabase.from('recipes').select(selectClause)
        .or(`cuisine.eq.Copycat,and(cuisine.eq.${options.cuisine},title.ilike.Copycat%)`);
      copycatQuery = applySharedFilters(copycatQuery);

      let regularQuery = supabase.from('recipes').select(selectClause)
        .eq('cuisine', options.cuisine)
        .not('title', 'ilike', 'Copycat%');
      regularQuery = applySharedFilters(regularQuery);

      const [copycatResult, regularResult] = await Promise.all([
        copycatQuery.order(strategy.column, { ascending: strategy.ascending }).range(copycatOffset, copycatOffset + copycatLimit - 1),
        regularQuery.order(strategy.column, { ascending: strategy.ascending }).range(regularOffset, regularOffset + nonCopycatLimit - 1),
      ]);

      if (copycatResult.error) throw new Error(`Copycat query failed: ${copycatResult.error.message}`);
      if (regularResult.error) throw new Error(`Regular query failed: ${regularResult.error.message}`);

      copycatRecipes = mapRows(copycatResult.data || []);
      americanRecipes = mapRows(regularResult.data || []); // reuse as "non-copycat" pool
    } else {
      // No cuisine filter: default 3-query split (copycat / American / other)
      const copycatOffset = page * copycatLimit;
      const nonCopycatAmericanOffset = page * nonCopycatAmericanLimit;
      const nonCopycatOtherOffset = page * nonCopycatOtherLimit;

      let copycatQuery = supabase.from('recipes').select(selectClause).eq('cuisine', 'Copycat');
      copycatQuery = applySharedFilters(copycatQuery);

      let americanQuery = supabase.from('recipes').select(selectClause).neq('cuisine', 'Copycat').eq('cuisine', 'American');
      americanQuery = applySharedFilters(americanQuery);

      let otherQuery = supabase.from('recipes').select(selectClause).neq('cuisine', 'Copycat').neq('cuisine', 'American');
      otherQuery = applySharedFilters(otherQuery);

      const [copycatResult, americanResult, otherResult] = await Promise.all([
        copycatQuery.order(strategy.column, { ascending: strategy.ascending }).range(copycatOffset, copycatOffset + copycatLimit - 1),
        americanQuery.order(strategy.column, { ascending: strategy.ascending }).range(nonCopycatAmericanOffset, nonCopycatAmericanOffset + nonCopycatAmericanLimit - 1),
        otherQuery.order(strategy.column, { ascending: strategy.ascending }).range(nonCopycatOtherOffset, nonCopycatOtherOffset + nonCopycatOtherLimit - 1),
      ]);

      if (copycatResult.error) throw new Error(`Copycat query failed: ${copycatResult.error.message}`);
      if (americanResult.error) throw new Error(`American query failed: ${americanResult.error.message}`);
      if (otherResult.error) throw new Error(`Other query failed: ${otherResult.error.message}`);

      copycatRecipes = mapRows(copycatResult.data || []);
      americanRecipes = mapRows(americanResult.data || []);
      otherRecipes = mapRows(otherResult.data || []);
    }

    // Interleave: 3 copycat, then 1 non-copycat (alternating American/other)
    const recipes: Recipe[] = [];
    let ci = 0, ai = 0, oi = 0;
    let nonCopycatTurn = 0;

    while (recipes.length < limit) {
      let added = 0;
      while (added < 3 && ci < copycatRecipes.length) {
        recipes.push(copycatRecipes[ci++]);
        added++;
      }

      if (nonCopycatTurn % 2 === 0 && ai < americanRecipes.length) {
        recipes.push(americanRecipes[ai++]);
      } else if (oi < otherRecipes.length) {
        recipes.push(otherRecipes[oi++]);
      } else if (ai < americanRecipes.length) {
        recipes.push(americanRecipes[ai++]);
      }
      nonCopycatTurn++;

      if (ci >= copycatRecipes.length && ai >= americanRecipes.length && oi >= otherRecipes.length) break;

      if (added < 3 && ci >= copycatRecipes.length) {
        while (added < 3 && (ai < americanRecipes.length || oi < otherRecipes.length)) {
          if (ai < americanRecipes.length) recipes.push(americanRecipes[ai++]);
          else if (oi < otherRecipes.length) recipes.push(otherRecipes[oi++]);
          added++;
        }
      }
    }

    const finalRecipes = recipes.slice(0, limit);

    console.log(`[getSomethingNewFeed] ${correlationId} status=200 total=${finalRecipes.length} copycat=${copycatRecipes.length} american=${americanRecipes.length} other=${otherRecipes.length}`);
    return { recipes: finalRecipes, page, limit };
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

export async function getPlannerCandidates(options: {
  meal_type: string;
  offset?: number;
  limit?: number;
  exclude?: string[];
  maxServingSize?: number;
}): Promise<{
  recipes: Recipe[];
}> {
  const correlationId = randomUUID().slice(0, 8);
  const limit = options.limit ?? 7;
  const offset = options.offset ?? 0;
  const exclude = options.exclude ?? [];

  console.log(`[getPlannerCandidates] ${correlationId} meal_type=${options.meal_type} offset=${offset} limit=${limit} exclude_count=${exclude.length}`);

  try {
    const supabase = getSupabaseClient();

    let query_builder = supabase
      .from('recipes')
      .select(`
        *,
        recipe_nutrition_totals (*),
        recipe_ingredients (name, amount, unit, sort_order)
      `)
      .eq('meal_type', options.meal_type);

    if (exclude.length > 0) {
      query_builder = query_builder.not('recipe_id', 'in', `(${exclude.join(',')})`);
    }
    if (options.maxServingSize) {
      query_builder = query_builder.or(`min_servings.is.null,min_servings.lte.${options.maxServingSize}`);
    }

    const { data, error } = await query_builder
      .order('created_at', { ascending: false })
      .order('recipe_id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.log(`[getPlannerCandidates] ${correlationId} error status=500 supabase_error=${error.message} code=${error.code} details=${error.details}`);
      throw new Error('Database query failed');
    }

    const recipes: Recipe[] = (data || []).map((row: SupabaseRecipe) => {
      const nutrition = Array.isArray(row.recipe_nutrition_totals)
        ? row.recipe_nutrition_totals[0]
        : row.recipe_nutrition_totals;
      return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
    });

    console.log(`[getPlannerCandidates] ${correlationId} status=200 returned=${recipes.length}`);
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

    const recipes: Recipe[] = (data || []).map((row: SupabaseRecipe) => {
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
