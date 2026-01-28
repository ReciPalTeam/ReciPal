interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/server.api';

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

// Single FatSecret search request
async function singleSearch(searchExpression: string, limit: number, page: number): Promise<any> {
  return fatsecretCall({
    method: 'recipes.search.v3',
    search_expression: searchExpression,
    max_results: limit,
    page_number: page,
    must_have_images: 'true',
    region: 'US',
    language: 'en',
  });
}

// Variety feed: fetch from multiple seeds, merge, de-dupe
async function fetchVarietyFeed(limit: number, page: number, seedOffset: number = 0): Promise<any> {
  // Select 3 seeds based on page for variety across pagination
  const seedsPerPage = 3;
  const baseIndex = ((page * seedsPerPage) + seedOffset) % VARIETY_SEEDS.length;
  const selectedSeeds = [
    VARIETY_SEEDS[baseIndex],
    VARIETY_SEEDS[(baseIndex + 3) % VARIETY_SEEDS.length],
    VARIETY_SEEDS[(baseIndex + 6) % VARIETY_SEEDS.length],
  ];
  
  console.log('[FatSecret] Variety feed using seeds:', selectedSeeds);
  
  // Fetch from each seed (max 3 requests)
  const recipesPerSeed = Math.ceil((limit + 10) / seedsPerPage); // Fetch extra to account for de-dupe
  const promises = selectedSeeds.map(seed => 
    singleSearch(seed, recipesPerSeed, 0).catch(err => {
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
  seedOffset: number = 0
): Promise<any> {
  console.log('[FatSecret] Searching recipes:', { q: query, limit, page, requestType, seedOffset });
  
  // If query is provided, use it directly (user search or filter)
  if (query && query.trim() !== '') {
    return singleSearch(query, limit, page);
  }
  
  // FEED mode with empty query: use variety strategy
  if (requestType === 'FEED') {
    return fetchVarietyFeed(limit, page, seedOffset);
  }
  
  // SEARCH mode with empty query: return empty or use 'recipe' as neutral fallback
  return singleSearch('recipe', limit, page);
}

export async function getRecipeById(recipeId: string): Promise<any> {
  return fatsecretCall({
    method: 'recipe.get.v2',
    recipe_id: recipeId,
    region: 'US',
    language: 'en',
  });
}
