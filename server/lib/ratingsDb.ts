import { getSupabaseClient } from './supabaseServer';

interface RatingResult {
  average: number;
  count: number;
}

/**
 * Fetch average ratings for a batch of recipe IDs.
 * Returns a map of recipeId → { average, count }.
 * Recipes with no ratings are omitted from the result.
 */
export async function getAverageRatings(
  recipeIds: string[]
): Promise<Record<string, RatingResult>> {
  if (!recipeIds.length) return {};

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('recipe_ratings')
    .select('recipe_id, rating')
    .in('recipe_id', recipeIds);

  if (error) {
    console.error('[getAverageRatings] supabase error:', error.message);
    throw new Error('Failed to fetch ratings');
  }

  // Aggregate in JS since Supabase REST doesn't support GROUP BY with AVG
  const buckets: Record<string, number[]> = {};
  for (const row of data || []) {
    if (!buckets[row.recipe_id]) buckets[row.recipe_id] = [];
    buckets[row.recipe_id].push(row.rating);
  }

  const result: Record<string, RatingResult> = {};
  for (const [recipeId, ratings] of Object.entries(buckets)) {
    const sum = ratings.reduce((a, b) => a + b, 0);
    result[recipeId] = {
      average: Math.round((sum / ratings.length) * 10) / 10, // 1 decimal
      count: ratings.length,
    };
  }

  return result;
}

/**
 * Insert or update a user's rating for a recipe.
 * Returns the new average rating and count for that recipe.
 */
export async function upsertRating(
  userId: number,
  recipeId: string,
  rating: number
): Promise<RatingResult> {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('Rating must be an integer between 1 and 5');
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('recipe_ratings')
    .upsert(
      { user_id: userId, recipe_id: recipeId, rating },
      { onConflict: 'user_id,recipe_id' }
    );

  if (error) {
    console.error('[upsertRating] supabase error:', error.message);
    throw new Error('Failed to save rating');
  }

  // Return updated average
  const result = await getAverageRatings([recipeId]);
  return result[recipeId] || { average: rating, count: 1 };
}
