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

  const response = await fetch(FATSECRET_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: searchParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FatSecret API error: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function searchRecipes(query: string, limit: number = 20, page: number = 0): Promise<any> {
  return fatsecretCall({
    method: 'recipes.search.v3',
    search_expression: query || 'healthy',
    max_results: limit,
    page_number: page,
    must_have_images: 'true',
    region: 'US',
    language: 'en',
  });
}

export async function getRecipeById(recipeId: string): Promise<any> {
  return fatsecretCall({
    method: 'recipe.get.v2',
    recipe_id: recipeId,
    region: 'US',
    language: 'en',
  });
}
