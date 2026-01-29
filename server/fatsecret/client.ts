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

// Variety seeds for diverse recipe feed (neutral, broad terms)
const VARIETY_SEEDS = ['chicken', 'pasta', 'rice', 'salad', 'soup', 'tacos', 'stir fry', 'vegetarian', 'dessert', 'breakfast'];

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

// Variety feed: fetch from multiple seeds, merge, de-dupe
async function fetchVarietyFeed(
  limit: number, 
  page: number, 
  seedOffset: number = 0,
  filters?: SearchFilters
): Promise<any> {
  // Select 3 seeds based on page for variety across pagination
  const seedsPerPage = 3;
  const baseIndex = ((page * seedsPerPage) + seedOffset) % VARIETY_SEEDS.length;
  const selectedSeeds = [
    VARIETY_SEEDS[baseIndex],
    VARIETY_SEEDS[(baseIndex + 3) % VARIETY_SEEDS.length],
    VARIETY_SEEDS[(baseIndex + 6) % VARIETY_SEEDS.length],
  ];
  
  console.log('[FatSecret] Variety feed using seeds:', selectedSeeds);
  
  // Fetch from each seed (max 3 requests) with filters applied
  const recipesPerSeed = Math.ceil((limit + 10) / seedsPerPage); // Fetch extra to account for de-dupe
  const promises = selectedSeeds.map(seed => 
    singleSearch(seed, recipesPerSeed, 0, filters).catch(err => {
      console.error(`[FatSecret] Seed "${seed}" failed:`, err.message);
      return { recipes: { recipe: [] } };
    })
  );
  
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
  
  // Shuffle for variety (deterministic based on page)
  const shuffled = mergedRecipes.sort((a, b) => {
    const aScore = (parseInt(a.recipe_id) * (page + 1)) % 100;
    const bScore = (parseInt(b.recipe_id) * (page + 1)) % 100;
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
  console.log('[FatSecret] Searching recipes:', { q: query, limit, page, requestType, seedOffset, filters });
  
  // If query is provided, use it directly (user search or filter)
  if (query && query.trim() !== '') {
    return singleSearch(query, limit, page, filters);
  }
  
  // FEED mode with empty query: use variety strategy
  if (requestType === 'FEED') {
    return fetchVarietyFeed(limit, page, seedOffset, filters);
  }
  
  // SEARCH mode with empty query: return empty or use 'recipe' as neutral fallback
  return singleSearch('recipe', limit, page, filters);
}

export async function getRecipeById(recipeId: string): Promise<any> {
  return fatsecretCall({
    method: 'recipe.get.v2',
    recipe_id: recipeId,
    region: 'US',
    language: 'en',
  });
}
