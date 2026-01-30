interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface RecipeTypesCache {
  fetchedAt: number;
  names: string[];
}

let tokenCache: TokenCache | null = null;
let recipeTypesCache: RecipeTypesCache | null = null;

const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/server.api';
const RECIPE_TYPES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface SearchFilters {
  mealType?: string;
  timeDifficulty?: string;
  isDiabetic?: boolean;
  maxCarbPercent?: number | null;
  cuisine?: string;
  dietaryRestrictions?: string[];
  varietyIndex?: number;
  feedType?: 'forYou' | 'somethingNew';
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  
  if (tokenCache && tokenCache.expiresAt > now + 5 * 60 * 1000) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('FatSecret credentials not configured. Set FATSECRET_CLIENT_ID and FATSECRET_CLIENT_SECRET environment variables.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(FATSECRET_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FatSecret OAuth failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  console.log('[FatSecret] OAuth token acquired, expires in', data.expires_in, 'seconds');

  return tokenCache.accessToken;
}

export async function fatsecretCall(params: Record<string, string | number>): Promise<any> {
  const token = await getAccessToken();

  const searchParams = new URLSearchParams();
  searchParams.append('format', 'json');
  
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(key, String(value));
  }

  const relayUrl = process.env.RELAY_URL;
  const relayKey = process.env.RELAY_KEY;
  const targetUrl = relayUrl ? `${relayUrl}/fatsecret` : FATSECRET_API_URL;

  console.log('[FatSecret] via', relayUrl ? 'RELAY' : 'DIRECT', '- method:', params.method);

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (relayKey) {
    headers['x-relay-key'] = relayKey;
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: searchParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 && relayUrl) {
      console.error('[FatSecret] RELAY 401 Unauthorized - check RELAY_KEY is correct');
    }
    throw new Error(`FatSecret API error: ${response.status} ${errorText}`);
  }

  return response.json();
}

// Meal-type-specific variety keyword arrays for diverse results
// These include diverse proteins (beef, chicken, fish, pork, turkey, etc.) and food types
// Arrays are designed to be searched 3 at a time for maximum variety per page load
const BREAKFAST_VARIETY = [
  'omelet', 'pancake', 'smoothie', 'oatmeal', 'muffin', 'yogurt', 'breakfast bowl',
  'eggs benedict', 'french toast', 'breakfast burrito', 'hash browns', 'waffles',
  'bacon eggs', 'sausage breakfast', 'avocado toast', 'breakfast sandwich'
];

const LUNCH_VARIETY = [
  'salad', 'wrap', 'sandwich', 'soup', 'bowl', 'pasta salad',
  'chicken salad', 'tuna salad', 'turkey sandwich', 'grilled cheese', 'burger',
  'quesadilla', 'pita', 'rice bowl', 'noodle bowl', 'panini'
];

const DINNER_VARIETY = [
  // Proteins - diverse meats
  'ground beef', 'steak', 'chicken breast', 'salmon', 'shrimp', 'pork chop',
  'turkey', 'lamb', 'fish fillet', 'meatballs', 'pulled pork',
  // Popular dishes
  'tacos', 'birria', 'stir fry', 'curry', 'casserole', 'roast',
  'pasta', 'lasagna', 'enchiladas', 'fajitas', 'kabobs', 'stew',
  // Vegetarian options
  'tofu stir fry', 'vegetarian', 'bean burrito', 'stuffed peppers'
];

const SNACKS_VARIETY = [
  'dip', 'protein bar', 'trail mix', 'smoothie', 'snack bites',
  'nachos', 'wings', 'sliders', 'bruschetta', 'spring rolls', 'hummus'
];

const DESSERT_VARIETY = [
  'cookie', 'brownie', 'cheesecake', 'pudding', 'fruit', 'muffin',
  'cake', 'pie', 'ice cream', 'tiramisu', 'tart', 'mousse'
];

// Fallback variety for no meal type selected - diverse proteins and food types
const DEFAULT_VARIETY = [
  // Proteins - ensure diverse meats appear
  'ground beef', 'steak', 'chicken', 'salmon', 'shrimp', 'pork',
  'turkey', 'lamb', 'fish', 'meatballs',
  // Popular dishes
  'tacos', 'birria tacos', 'stir fry', 'curry', 'pasta', 'soup',
  'casserole', 'burger', 'enchiladas', 'fajitas',
  // Vegetarian
  'tofu', 'vegetarian', 'salad'
];

// Cuisine-specific variety arrays - signature dishes for each cuisine type
const AMERICAN_VARIETY = [
  'hamburger', 'cheeseburger', 'smash burger', 'grilled steak', 'ribeye steak',
  'fried chicken', 'hot dog', 'mac and cheese', 'BBQ ribs', 'pulled pork',
  'pot roast', 'meatloaf', 'buffalo wings', 'baked potato', 'clam chowder',
  'cornbread', 'apple pie', 'grilled cheese', 'BLT sandwich', 'club sandwich'
];

const MEXICAN_VARIETY = [
  'birria tacos', 'carnitas', 'carne asada', 'enchiladas', 'tamales',
  'pozole', 'chile relleno', 'fajitas', 'burrito', 'quesadilla',
  'tostadas', 'elote', 'street tacos', 'mole', 'churros',
  'fish tacos', 'al pastor', 'chorizo', 'guacamole', 'nachos'
];

const ITALIAN_VARIETY = [
  'lasagna', 'spaghetti bolognese', 'chicken parmesan', 'carbonara', 'risotto',
  'ravioli', 'fettuccine alfredo', 'gnocchi', 'osso buco', 'bruschetta',
  'minestrone', 'caprese', 'tiramisu', 'pesto pasta', 'margherita pizza',
  'eggplant parmesan', 'italian meatballs', 'cacciatore', 'primavera', 'cannoli'
];

const ASIAN_VARIETY = [
  'pad thai', 'kung pao chicken', 'teriyaki', 'pho', 'ramen',
  'fried rice', 'orange chicken', 'beef and broccoli', 'lo mein', 'spring rolls',
  'sushi', 'dumplings', 'general tso', 'sweet and sour', 'bibimbap',
  'tom yum', 'curry noodles', 'bulgogi', 'tempura', 'green curry'
];

const MEDITERRANEAN_VARIETY = [
  'falafel', 'hummus', 'shawarma', 'greek salad', 'moussaka',
  'gyro', 'tabbouleh', 'baba ganoush', 'lamb kebab', 'tzatziki',
  'spanakopita', 'dolmas', 'fattoush', 'souvlaki', 'baklava',
  'grilled fish', 'couscous', 'chickpea', 'olive oil pasta', 'stuffed grape leaves'
];

const INDIAN_VARIETY = [
  'butter chicken', 'tikka masala', 'tandoori chicken', 'biryani', 'korma',
  'vindaloo', 'saag paneer', 'dal', 'naan bread', 'samosa',
  'chana masala', 'rogan josh', 'keema', 'malai kofta', 'pakora',
  'aloo gobi', 'curry rice', 'chapati', 'raita', 'mango lassi'
];

const MIDDLE_EASTERN_VARIETY = [
  'shawarma', 'falafel', 'kebab', 'hummus', 'baba ganoush',
  'tabbouleh', 'fattoush', 'kibbeh', 'mansaf', 'kousa',
  'mahshi', 'labneh', 'zaatar', 'pita bread', 'lamb stew',
  'tahini', 'muhammara', 'musakhan', 'fatteh', 'knafeh'
];

const CARIBBEAN_VARIETY = [
  'jerk chicken', 'curry goat', 'rice and peas', 'oxtail', 'plantains',
  'ackee and saltfish', 'roti', 'doubles', 'callaloo', 'conch fritters',
  'escovitch fish', 'pepperpot', 'cou cou', 'festival', 'bammy',
  'coconut shrimp', 'island fish', 'rum cake', 'sorrel', 'patties'
];

const SOUTHERN_VARIETY = [
  'fried chicken', 'shrimp and grits', 'biscuits and gravy', 'collard greens', 'cornbread',
  'gumbo', 'jambalaya', 'pulled pork', 'chicken fried steak', 'black eyed peas',
  'po boy', 'crawfish', 'hush puppies', 'mac and cheese', 'pecan pie',
  'okra', 'catfish', 'banana pudding', 'deviled eggs', 'red beans and rice'
];

const BBQ_VARIETY = [
  'BBQ ribs', 'pulled pork', 'brisket', 'smoked chicken', 'grilled steak',
  'BBQ chicken', 'burnt ends', 'smoked sausage', 'pork shoulder', 'tri tip',
  'grilled salmon', 'BBQ shrimp', 'grilled wings', 'smoked turkey', 'grilled lamb',
  'coleslaw', 'baked beans', 'cornbread', 'potato salad', 'grilled corn'
];

const HEALTHY_VARIETY = [
  'grilled chicken salad', 'salmon bowl', 'quinoa bowl', 'veggie stir fry', 'kale salad',
  'avocado toast', 'smoothie bowl', 'grilled fish', 'turkey lettuce wraps', 'zucchini noodles',
  'cauliflower rice', 'lean protein', 'steamed vegetables', 'greek yogurt', 'overnight oats',
  'chickpea salad', 'buddha bowl', 'lean beef', 'egg white omelet', 'fresh fruit'
];

// Get variety array for a given cuisine
function getVarietyArrayForCuisine(cuisine?: string): string[] | null {
  if (!cuisine) return null;
  
  switch (cuisine) {
    case 'American':
      return AMERICAN_VARIETY;
    case 'Mexican':
      return MEXICAN_VARIETY;
    case 'Italian':
      return ITALIAN_VARIETY;
    case 'Asian':
      return ASIAN_VARIETY;
    case 'Mediterranean':
      return MEDITERRANEAN_VARIETY;
    case 'Indian':
      return INDIAN_VARIETY;
    case 'Middle Eastern':
      return MIDDLE_EASTERN_VARIETY;
    case 'Caribbean':
      return CARIBBEAN_VARIETY;
    case 'Southern / Comfort Food':
      return SOUTHERN_VARIETY;
    case 'BBQ / Grill':
      return BBQ_VARIETY;
    case 'Healthy / Light':
      return HEALTHY_VARIETY;
    default:
      return null;
  }
}

// Get variety array for a given meal type
function getVarietyArrayForMealType(mealType?: string): string[] {
  if (!mealType) return DEFAULT_VARIETY;
  
  const lowerMealType = mealType.toLowerCase();
  switch (lowerMealType) {
    case 'breakfast':
      return BREAKFAST_VARIETY;
    case 'lunch':
      return LUNCH_VARIETY;
    case 'dinner':
      return DINNER_VARIETY;
    case 'snacks':
    case 'snack':
      return SNACKS_VARIETY;
    case 'dessert':
      return DESSERT_VARIETY;
    default:
      return DEFAULT_VARIETY;
  }
}

// Cuisine keyword mapping for search_expression
const CUISINE_KEYWORDS: Record<string, string> = {
  'American': 'american',
  'Italian': 'italian',
  'Mexican': 'mexican',
  'Asian': 'asian',
  'Mediterranean': 'mediterranean',
  'Indian': 'indian',
  'Middle Eastern': 'middle eastern',
  'Caribbean': 'caribbean',
  'Southern / Comfort Food': 'southern',
  'BBQ / Grill': 'bbq',
  'Healthy / Light': 'healthy',
  'Breakfast / Brunch': 'breakfast',
  'Desserts / Baking': 'dessert',
};

// Map cuisine selection to meal type if applicable
// "Breakfast / Brunch" and "Desserts / Baking" should behave like meal types
function getCuisineMealTypeOverride(cuisine?: string): string | undefined {
  if (!cuisine) return undefined;
  if (cuisine === 'Breakfast / Brunch') return 'breakfast';
  if (cuisine === 'Desserts / Baking') return 'dessert';
  return undefined;
}

// Build search expression with proper query construction
// Format: [base term] [meal type keyword] [variety keyword OR cuisine keyword]
// When varietyKeyword is provided, it takes priority over the generic cuisine keyword
// This allows cuisine-specific variety arrays to use specific dishes (e.g., "hamburger") 
// instead of the generic cuisine term (e.g., "american")
function buildSearchExpression(
  userQuery: string | undefined,
  filters: SearchFilters | undefined,
  varietyKeyword?: string
): string {
  const parts: string[] = [];
  
  // Base term: user query or neutral "recipe"
  const baseTerm = userQuery?.trim() || 'recipe';
  parts.push(baseTerm);
  
  // Add meal type keyword if set (for search_expression influence)
  // Note: We also use recipe_types filter, but keyword helps relevance
  if (filters?.mealType) {
    const mealKeyword = filters.mealType.toLowerCase();
    if (mealKeyword && !baseTerm.toLowerCase().includes(mealKeyword)) {
      parts.push(mealKeyword);
    }
  }
  
  // Priority: variety keyword > cuisine keyword
  // When cuisine variety arrays are used, varietyKeyword contains specific dishes
  // like "hamburger" or "birria tacos" which produce better search results than
  // generic terms like "american" or "mexican"
  if (varietyKeyword) {
    if (!parts.some(p => p.toLowerCase().includes(varietyKeyword.toLowerCase()))) {
      parts.push(varietyKeyword);
    }
  } else if (filters?.cuisine) {
    // Fall back to generic cuisine keyword only when no variety keyword is provided
    const cuisineKeyword = CUISINE_KEYWORDS[filters.cuisine];
    if (cuisineKeyword && !parts.some(p => p.toLowerCase().includes(cuisineKeyword))) {
      parts.push(cuisineKeyword);
    }
  }
  
  return parts.join(' ');
}

export type RequestType = 'FEED' | 'SEARCH';

// Fetch and cache FatSecret recipe type names (24h TTL)
export async function getRecipeTypeNames(): Promise<string[]> {
  const now = Date.now();
  
  if (recipeTypesCache && (now - recipeTypesCache.fetchedAt) < RECIPE_TYPES_CACHE_TTL) {
    return recipeTypesCache.names;
  }
  
  try {
    const response = await fatsecretCall({
      method: 'recipe_types.get.v2',
      region: 'US',
      language: 'en',
    });
    
    const typeNames: string[] = [];
    const recipeTypes = response?.recipe_types?.recipe_type;
    
    if (recipeTypes) {
      const typeArray = Array.isArray(recipeTypes) ? recipeTypes : [recipeTypes];
      for (const type of typeArray) {
        if (type?.recipe_type_name) {
          typeNames.push(type.recipe_type_name);
        }
      }
    }
    
    recipeTypesCache = {
      fetchedAt: now,
      names: typeNames,
    };
    
    console.log('[FatSecret] Recipe types fetched:', typeNames.length, 'types');
    return typeNames;
  } catch (err) {
    console.error('[FatSecret] FAIL-OPEN: recipe_types.get.v2 failed, continuing search without recipe_types filter:', (err as Error).message);
    return [];
  }
}

// Map UI meal type to FatSecret recipe_types (case-insensitive matching)
// Handles both "Snack" and "Snacks" variants from different UI paths
export function mapMealTypeToRecipeTypes(mealType: string, fatSecretTypeNames: string[]): string[] {
  const lowerMealType = mealType.toLowerCase();
  const matches: string[] = [];
  
  for (const typeName of fatSecretTypeNames) {
    const lowerTypeName = typeName.toLowerCase();
    
    if (lowerMealType === 'breakfast' && (lowerTypeName.includes('breakfast') || lowerTypeName.includes('brunch'))) {
      matches.push(typeName);
    } else if (lowerMealType === 'lunch' && lowerTypeName.includes('lunch')) {
      matches.push(typeName);
    } else if (lowerMealType === 'dinner' && lowerTypeName.includes('dinner')) {
      matches.push(typeName);
    } else if (lowerMealType === 'dessert' && lowerTypeName.includes('dessert')) {
      matches.push(typeName);
    } else if ((lowerMealType === 'snacks' || lowerMealType === 'snack') && lowerTypeName.includes('snack')) {
      matches.push(typeName);
    }
  }
  
  return matches;
}

// Build prep_time filter params based on timeDifficulty
function getPrepTimeParams(timeDifficulty?: string): Record<string, string> {
  if (!timeDifficulty) return {};
  
  switch (timeDifficulty) {
    case 'quick':
      return { 'prep_time.to': '30' };
    case 'comfortable':
      return { 'prep_time.from': '30', 'prep_time.to': '60' };
    case 'involved':
      return { 'prep_time.from': '60' };
    default:
      return {};
  }
}

// Single FatSecret search request with hard filters
async function singleSearch(
  searchExpression: string, 
  limit: number, 
  page: number,
  filters?: SearchFilters
): Promise<any> {
  const params: Record<string, string | number> = {
    method: 'recipes.search.v3',
    search_expression: searchExpression,
    max_results: limit,
    page_number: page,
    must_have_images: 'true',
    region: 'US',
    language: 'en',
  };
  
  // Apply meal type filter via recipe_types
  if (filters?.mealType) {
    const recipeTypeNames = await getRecipeTypeNames();
    
    if (recipeTypeNames.length === 0) {
      console.log('[FatSecret] FAIL-OPEN: No recipe types available (API may have failed), proceeding without recipe_types filter for mealType:', filters.mealType);
    } else {
      const matchedTypes = mapMealTypeToRecipeTypes(filters.mealType, recipeTypeNames);
      
      if (matchedTypes.length > 0) {
        params.recipe_types = matchedTypes.join(',');
        params.recipe_types_matchall = 'false';
      } else {
        console.log('[FatSecret] WARN: No recipe types matched for mealType:', filters.mealType);
      }
    }
  }
  
  // Apply prep_time filter based on timeDifficulty
  const prepTimeParams = getPrepTimeParams(filters?.timeDifficulty);
  Object.assign(params, prepTimeParams);
  
  // Apply carb_percentage filter for diabetics
  if (filters?.isDiabetic && filters?.maxCarbPercent != null && filters.maxCarbPercent >= 5 && filters.maxCarbPercent <= 80) {
    params['carb_percentage.to'] = String(filters.maxCarbPercent);
  }
  
  // Log final params for verification (especially for Breakfast+Quick+Diabetic case)
  if (filters?.mealType || filters?.timeDifficulty || filters?.isDiabetic) {
    console.log('[FatSecret] Search with filters:', {
      search_expression: searchExpression,
      mealType: filters.mealType,
      timeDifficulty: filters.timeDifficulty,
      isDiabetic: filters.isDiabetic,
      maxCarbPercent: filters.maxCarbPercent,
      finalParams: params,
    });
  }
  
  return fatsecretCall(params);
}

// Variety feed: fetch using meal-type-specific OR cuisine-specific variety keywords
async function fetchVarietyFeed(
  limit: number, 
  page: number, 
  varietyIndex: number = 0,
  filters?: SearchFilters
): Promise<any> {
  // Get the appropriate variety array - prioritize cuisine-specific, then meal type, then default
  const effectiveMealType = filters?.mealType || getCuisineMealTypeOverride(filters?.cuisine);
  
  // Check for cuisine-specific variety array first (for true cuisines, not meal type overrides)
  const cuisineVarietyArray = filters?.cuisine && !getCuisineMealTypeOverride(filters.cuisine)
    ? getVarietyArrayForCuisine(filters.cuisine)
    : null;
  
  // Use cuisine variety if available, otherwise fall back to meal type variety
  const varietyArray = cuisineVarietyArray || getVarietyArrayForMealType(effectiveMealType);
  const isCuisineVariety = cuisineVarietyArray !== null;
  
  // Select 3 variety keywords based on varietyIndex, page, and daily rotation for diversity
  // varietyIndex advances on refresh, page advances on infinite scroll
  // Daily offset rotates starting position each day to prevent same-protein dominance
  const seedsPerPage = 3;
  const dailyOffset = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % varietyArray.length;
  const feedTypeOffset = filters?.feedType === 'somethingNew' ? 5 : 0; // Different starting point per feed
  const baseIndex = ((page * seedsPerPage) + varietyIndex + dailyOffset + feedTypeOffset) % varietyArray.length;
  
  // Use larger spacing (step of 3) to get more diverse results from the array
  const step = Math.max(3, Math.floor(varietyArray.length / 6));
  const selectedKeywords = [
    varietyArray[baseIndex],
    varietyArray[(baseIndex + step) % varietyArray.length],
    varietyArray[(baseIndex + step * 2) % varietyArray.length],
  ];
  
  console.log('[FatSecret] Variety feed:', { 
    cuisine: isCuisineVariety ? filters?.cuisine : undefined,
    mealType: !isCuisineVariety ? effectiveMealType : undefined,
    varietySource: isCuisineVariety ? 'cuisine' : 'mealType',
    varietyIndex, 
    page, 
    keywords: selectedKeywords,
    feedType: filters?.feedType 
  });
  
  // Fetch from each variety keyword with filters applied
  const recipesPerSeed = Math.ceil((limit + 10) / seedsPerPage);
  const promises = selectedKeywords.map(keyword => {
    const searchExpr = buildSearchExpression(undefined, filters, keyword);
    return singleSearch(searchExpr, recipesPerSeed, 0, filters).catch(err => {
      console.error(`[FatSecret] Variety keyword "${keyword}" failed:`, err.message);
      return { recipes: { recipe: [] } };
    });
  });
  
  const results = await Promise.all(promises);
  
  // Merge and de-dupe by recipe_id
  const seenIds = new Set<string>();
  const mergedRecipes: any[] = [];
  
  for (const result of results) {
    const recipes = result?.recipes?.recipe || [];
    const recipeArray = Array.isArray(recipes) ? recipes : [recipes];
    
    for (const recipe of recipeArray) {
      const id = String(recipe.recipe_id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        mergedRecipes.push(recipe);
      }
    }
  }
  
  // Shuffle for variety (deterministic based on page + varietyIndex)
  const shuffled = mergedRecipes.sort((a, b) => {
    const aScore = (parseInt(a.recipe_id) * (page + varietyIndex + 1)) % 100;
    const bScore = (parseInt(b.recipe_id) * (page + varietyIndex + 1)) % 100;
    return aScore - bScore;
  });
  
  // Return first N recipes
  return {
    recipes: {
      recipe: shuffled.slice(0, limit),
      max_results: String(limit),
      page_number: String(page),
      total_results: String(mergedRecipes.length),
    }
  };
}

export async function searchRecipes(
  query: string, 
  limit: number = 20, 
  page: number = 0,
  requestType: RequestType = 'FEED',
  seedOffset: number = 0,
  filters?: SearchFilters
): Promise<any> {
  // Use varietyIndex from filters if provided, else fall back to seedOffset (legacy)
  const varietyIndex = filters?.varietyIndex ?? seedOffset;
  
  // Handle Breakfast/Brunch and Desserts/Baking cuisine as meal type override
  const cuisineMealOverride = getCuisineMealTypeOverride(filters?.cuisine);
  const effectiveFilters: SearchFilters | undefined = cuisineMealOverride 
    ? { ...filters, mealType: filters?.mealType || cuisineMealOverride }
    : filters;
  
  // TODO: Dietary restriction mapping
  // FatSecret does NOT support dietary filters (Vegetarian, Vegan, etc.) as first-class API params
  // These would need to be handled client-side or via future OpenAI reranking
  // Supported restrictions: None via API currently
  // Unsupported: Vegetarian, Vegan, Pescatarian, Halal, Kosher, Dairy-free, Gluten-free, Low-carb
  if (effectiveFilters?.dietaryRestrictions?.length) {
    console.log('[FatSecret] TODO: Dietary restrictions not supported by API:', effectiveFilters.dietaryRestrictions);
  }
  
  console.log('[FatSecret] Searching recipes:', { 
    query, 
    limit, 
    page, 
    requestType, 
    varietyIndex, 
    filters: effectiveFilters,
    cuisineMealOverride
  });
  
  // If query is provided, build full search expression with filters
  if (query && query.trim() !== '') {
    const searchExpr = buildSearchExpression(query, effectiveFilters);
    console.log('[FatSecret] Search with query:', { originalQuery: query, searchExpr });
    return singleSearch(searchExpr, limit, page, effectiveFilters);
  }
  
  // FEED mode with empty query: use variety strategy
  if (requestType === 'FEED') {
    return fetchVarietyFeed(limit, page, varietyIndex, effectiveFilters);
  }
  
  // SEARCH mode with empty query: use neutral "recipe" as fallback
  const searchExpr = buildSearchExpression(undefined, effectiveFilters);
  return singleSearch(searchExpr, limit, page, effectiveFilters);
}

export async function getRecipeById(recipeId: string): Promise<any> {
  return fatsecretCall({
    method: 'recipe.get.v2',
    recipe_id: recipeId,
    region: 'US',
    language: 'en',
  });
}
