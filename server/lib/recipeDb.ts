import { getSupabaseClient } from './supabaseServer';
import { randomUUID } from 'crypto';
import type { Recipe } from '../../client/src/lib/mock-data';
import type { SupabaseRecipe, SupabaseRecipeNutritionTotals, SupabaseRecipeIngredient } from '../../shared/supabase-types';
import { normalizeIngredientName, applyIngredientDefault } from '@shared/ingredient-intel';

// Normalize frontend filter values to DB meal_type values
const MEAL_TYPE_NORMALIZE: Record<string, string> = {
  'Snacks': 'Snack/Appetizer',
};
function normalizeMealType(val: string): string {
  return MEAL_TYPE_NORMALIZE[val] || val;
}

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

// --- Ingredient-level allergen & dietary filtering ---
// Mirrors the planner's filterRecipes() logic (client/src/lib/auto-populate.ts)
// but runs server-side after Supabase queries return.

// normalizeIngredientName now imported from @shared/ingredient-intel (single source of truth).

const MEAT_KEYWORDS = ['chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'tuna', 'bacon', 'steak', 'lamb', 'turkey', 'duck', 'venison', 'anchovy', 'crab', 'lobster', 'prawn'];
const ANIMAL_KEYWORDS = [...MEAT_KEYWORDS, 'egg', 'milk', 'cheese', 'butter', 'cream', 'yogurt', 'honey', 'whey', 'gelatin', 'lard'];

function filterByIngredients(
  recipes: Recipe[],
  allergens?: string[],
  dietaryRestrictions?: string[]
): Recipe[] {
  if ((!allergens || allergens.length === 0) && (!dietaryRestrictions || dietaryRestrictions.length === 0)) {
    return recipes;
  }

  // Normalize UI allergen labels → pipeline tag names (lowercase)
  const normalizedAllergens = (allergens || []).map(a => a.toLowerCase().trim());
  // Normalize UI dietary labels → pipeline tag names (lowercase)
  const normalizedDietary = (dietaryRestrictions || []).map(d => d.toLowerCase().trim());

  return recipes.filter(recipe => {
    const hasStructuredAllergens = Array.isArray(recipe.allergens) && recipe.allergens.length > 0;
    const hasStructuredDietary = Array.isArray(recipe.dietary_restrictions) && recipe.dietary_restrictions.length > 0;

    // --- Allergen check ---
    if (normalizedAllergens.length > 0) {
      if (hasStructuredAllergens) {
        // Fast path: structured data from pipeline (recipes.allergens)
        const recipeAllergens = recipe.allergens!.map((a: string) => a.toLowerCase());
        for (const allergy of normalizedAllergens) {
          if (recipeAllergens.includes(allergy)) return false;
        }
      } else {
        // Legacy fallback: ingredient name scanning for pre-pipeline recipes
        const normalized = recipe.ingredients.map(i => normalizeIngredientName(i.name));
        for (const allergy of normalizedAllergens) {
          const allergyNorm = normalizeIngredientName(allergy);
          if (normalized.some(ing => ing.includes(allergyNorm))) return false;
        }
      }
    }

    // --- Dietary restriction check ---
    if (normalizedDietary.length > 0) {
      if (hasStructuredDietary) {
        // Fast path: structured data from pipeline (recipes.dietary_restrictions)
        const recipeDietary = recipe.dietary_restrictions!.map((d: string) => d.toLowerCase());
        for (const restriction of normalizedDietary) {
          // "none" means no dietary filter — skip
          if (restriction === 'none') continue;
          // If the recipe's dietary_restrictions doesn't include this restriction, exclude it.
          // E.g., user wants "vegan" but recipe only has ["vegetarian","gluten-free"] → excluded
          if (!recipeDietary.includes(restriction)) return false;
        }
      } else {
        // Legacy fallback: keyword-based check for untagged recipes
        const normalized = recipe.ingredients.map(i => normalizeIngredientName(i.name));
        if (normalizedDietary.includes('vegetarian')) {
          if (normalized.some(ing => MEAT_KEYWORDS.some(m => ing.includes(m)))) return false;
        }
        if (normalizedDietary.includes('vegan')) {
          if (normalized.some(ing => ANIMAL_KEYWORDS.some(a => ing.includes(a)))) return false;
        }
      }
    }

    return true;
  });
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

  const ingredients: {
    name: string; amount: string; unit: string; ingredient_id?: string; display_text?: string;
    weight_grams?: number; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number;
  }[] = [];
  if (ingredientRows && ingredientRows.length > 0) {
    for (const ing of ingredientRows) {
      const ingName = ing.name || 'Unknown';
      // Every ingredient must carry a real numeric amount + unit so it can flow through
      // scaling and Instacart — nothing is ever left "to taste" (NULL). The category-aware
      // default fills NULL/blank amounts (salt/pepper → 0.5 tsp, etc.). The decimal `amount`
      // is the canonical value; the client formats it as a fraction at display time. We store
      // it as a clean numeric string so existing string-based consumers keep working.
      const defaulted = applyIngredientDefault({ name: ingName, amount: ing.amount, unit: ing.unit });
      ingredients.push({
        name: ingName,
        amount: String(defaulted.amount),
        unit: defaulted.unit,
        ...(ing.ingredient_id ? { ingredient_id: ing.ingredient_id } : {}),
        ...(ing.display_text ? { display_text: ing.display_text } : {}),
        ...(ing.weight_grams != null ? { weight_grams: ing.weight_grams } : {}),
        ...(ing.calories != null ? { calories: ing.calories } : {}),
        ...(ing.protein_g != null ? { protein_g: ing.protein_g } : {}),
        ...(ing.carbs_g != null ? { carbs_g: ing.carbs_g } : {}),
        ...(ing.fat_g != null ? { fat_g: ing.fat_g } : {}),
      });
    }
  }

  const steps: (string | { step: number; time: string; location: string; instruction: string })[] = [];
  if (row.steps && Array.isArray(row.steps)) {
    for (const s of row.steps) {
      if (typeof s === 'string') {
        steps.push(s);
      } else if (s && typeof s === 'object' && (s as Record<string, unknown>).instruction) {
        const stepObj = s as Record<string, unknown>;
        const locationRaw = stepObj.location ?? stepObj.equipment;
        steps.push({
          step: Number(stepObj.step) || 0,
          time: String(stepObj.time || ''),
          location: String(locationRaw || ''),
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
    tags: Array.isArray(row.tags) ? row.tags : [],
    total_time_minutes: totalMinutes > 0 ? totalMinutes : undefined,
    prep_time_minutes: prepMinutes > 0 ? prepMinutes : undefined,
    cook_time_minutes: cookMinutes > 0 ? cookMinutes : undefined,
    passive_time_minutes: (row as any).passive_time_minutes ?? 0,
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
        recipe_ingredients (name, amount, unit, ingredient_id, display_text, sort_order, weight_grams, calories, protein_g, carbs_g, fat_g)
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
        query = query.in('meal_type', options.mealType.split(',').map(normalizeMealType));
      } else {
        query = query.eq('meal_type', normalizeMealType(options.mealType));
      }
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

    // Over-fetch to compensate for recipes filtered out by ingredient scanning
    const hasIngredientFilters = (options.allergens && options.allergens.length > 0) || (options.dietaryRestrictions && options.dietaryRestrictions.length > 0);
    const fetchLimit = hasIngredientFilters ? Math.ceil(limit * 1.5) : limit;

    const { data, error } = await query
      .order(strategy.column, { ascending: strategy.ascending })
      .range(offset, offset + fetchLimit - 1);

    if (error) {
      console.log(`[getForYouFeed] ${correlationId} error status=500 supabase_error=${error.message} code=${error.code} details=${error.details}`);
      throw new Error('Database query failed');
    }

    let recipes: Recipe[] = (data || []).map((row: SupabaseRecipe) => {
      const nutrition = Array.isArray(row.recipe_nutrition_totals)
        ? row.recipe_nutrition_totals[0]
        : row.recipe_nutrition_totals;
      return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
    });

    recipes = filterByIngredients(recipes, options.allergens, options.dietaryRestrictions).slice(0, limit);

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

  // Over-fetch to compensate for ingredient-level filtering
  const hasIngredientFilters = (options.allergens && options.allergens.length > 0) || (options.dietaryRestrictions && options.dietaryRestrictions.length > 0);
  const overFetchMultiplier = hasIngredientFilters ? 1.5 : 1;

  // 3:1 copycat ratio — 75% copycat, 25% non-copycat
  const copycatLimit = Math.ceil(limit * 0.75 * overFetchMultiplier);
  const nonCopycatLimit = Math.ceil((limit - Math.ceil(limit * 0.75)) * overFetchMultiplier);

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
          query = query.in('meal_type', options.mealType.split(',').map(normalizeMealType));
        } else {
          query = query.eq('meal_type', normalizeMealType(options.mealType));
        }
      }
      return query;
    };

    const selectClause = `*, recipe_nutrition_totals (*), recipe_ingredients (name, amount, unit, ingredient_id, display_text, sort_order, weight_grams, calories, protein_g, carbs_g, fat_g)`;

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

      copycatRecipes = filterByIngredients(mapRows(copycatResult.data || []), options.allergens, options.dietaryRestrictions);
      americanRecipes = filterByIngredients(mapRows(regularResult.data || []), options.allergens, options.dietaryRestrictions);
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

      copycatRecipes = filterByIngredients(mapRows(copycatResult.data || []), options.allergens, options.dietaryRestrictions);
      americanRecipes = filterByIngredients(mapRows(americanResult.data || []), options.allergens, options.dietaryRestrictions);
      otherRecipes = filterByIngredients(mapRows(otherResult.data || []), options.allergens, options.dietaryRestrictions);
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

    // Backfill: if pool-splitting left us short (common with narrow meal type filters), run a single unified query
    if (recipes.length < limit && options.mealType) {
      const existingIds = new Set(recipes.map(r => r.id));
      const backfillNeeded = limit - recipes.length;
      let backfillQuery = supabase.from('recipes').select(selectClause);
      backfillQuery = applySharedFilters(backfillQuery);
      const backfillResult = await backfillQuery
        .order(strategy.column, { ascending: strategy.ascending })
        .range(0, backfillNeeded + existingIds.size - 1);
      if (!backfillResult.error && backfillResult.data) {
        const backfillRecipes = filterByIngredients(mapRows(backfillResult.data), options.allergens, options.dietaryRestrictions).filter(r => !existingIds.has(r.id));
        recipes.push(...backfillRecipes.slice(0, backfillNeeded));
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
  allergens?: string[];
  dietaryRestrictions?: string[];
}): Promise<{
  recipes: Recipe[];
}> {
  const correlationId = randomUUID().slice(0, 8);
  const hasIngredientFilters = (options.allergens && options.allergens.length > 0) || (options.dietaryRestrictions && options.dietaryRestrictions.length > 0);
  const fetchLimit = hasIngredientFilters ? Math.ceil((options.limit ?? 7) * 1.5) : (options.limit ?? 7);
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
        recipe_ingredients (name, amount, unit, ingredient_id, display_text, sort_order, weight_grams, calories, protein_g, carbs_g, fat_g)
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
      .range(offset, offset + fetchLimit - 1);

    if (error) {
      console.log(`[getPlannerCandidates] ${correlationId} error status=500 supabase_error=${error.message} code=${error.code} details=${error.details}`);
      throw new Error('Database query failed');
    }

    const mapped: Recipe[] = (data || []).map((row: SupabaseRecipe) => {
      const nutrition = Array.isArray(row.recipe_nutrition_totals)
        ? row.recipe_nutrition_totals[0]
        : row.recipe_nutrition_totals;
      return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
    });

    const recipes = filterByIngredients(mapped, options.allergens, options.dietaryRestrictions).slice(0, limit);

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
  const hasIngredientFilters = (options.allergens && options.allergens.length > 0) || (options.dietaryRestrictions && options.dietaryRestrictions.length > 0);
  const fetchLimit = hasIngredientFilters ? Math.ceil(limit * 1.5) : limit;

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
        recipe_ingredients (name, amount, unit, ingredient_id, display_text, sort_order, weight_grams, calories, protein_g, carbs_g, fat_g)
      `)
      .or(`title.ilike.${searchTerm},cuisine.ilike.${searchTerm}`)
      .range(offset, offset + fetchLimit - 1)
      .order('created_at', { ascending: false })
      .order('recipe_id', { ascending: false });

    if (error) {
      console.log(`[searchRecipes] ${correlationId} error status=500`);
      throw new Error('Database query failed');
    }

    const mapped: Recipe[] = (data || []).map((row: SupabaseRecipe) => {
      const nutrition = Array.isArray(row.recipe_nutrition_totals)
        ? row.recipe_nutrition_totals[0]
        : row.recipe_nutrition_totals;
      return mapSupabaseRecipeToCanonical(row, nutrition, row.recipe_ingredients);
    });

    const recipes = filterByIngredients(mapped, options.allergens, options.dietaryRestrictions).slice(0, limit);

    console.log(`[searchRecipes] ${correlationId} q="${query}" recipes_source=supabase endpoint=/api/recipes/search page=${page} count=${recipes.length}`);
    return { recipes, page, limit };
  } catch (err: any) {
    console.log(`[searchRecipes] ${correlationId} status=500`);
    throw err;
  }
}
