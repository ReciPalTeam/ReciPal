export interface SupabaseIngredient {
  ingredient_id: string;
  canonical_name: string;
  category: string | null;
  fatsecret_food_id: string | null;
  fatsecret_serving_id: string | null;
  metric_serving_unit: string | null;
  name_hash: string | null;
  created_at: string;
  updated_at: string;
  allergens: string[];
  dietary_flags: string[];
}

export interface SupabaseIngredientNutrients {
  nutrient_id: string;
  ingredient_id: string;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  saturated_fat_per_100g: number | null;
  polyunsaturated_fat_per_100g: number | null;
  monounsaturated_fat_per_100g: number | null;
  trans_fat_per_100g: number | null;
  cholesterol_mg_per_100g: number | null;
  sodium_mg_per_100g: number | null;
  potassium_mg_per_100g: number | null;
  calcium_mg_per_100g: number | null;
  iron_mg_per_100g: number | null;
  fiber_per_100g: number | null;
  sugar_per_100g: number | null;
  added_sugars_per_100g: number | null;
  vitamin_a_mcg_per_100g: number | null;
  vitamin_c_mg_per_100g: number | null;
  vitamin_d_mcg_per_100g: number | null;
  cached_at: string;
}

export interface SupabaseRecipeIngredient {
  line_id: string;
  recipe_id: string;
  ingredient_id: string | null;
  display_text: string;
  name: string;
  amount: number | null;
  unit: string | null;
  weight_grams: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  sort_order: number;
  created_at: string;
  ingredients?: SupabaseIngredient & { ingredient_nutrients?: SupabaseIngredientNutrients };
}

export interface SupabaseRecipeIngredientVariant {
  variant_id: string;
  recipe_id: string;
  servings: number;
  ingredients: SupabaseRecipeIngredient[];
  created_at: string | null;
  updated_at: string | null;
}

export interface SupabaseRecipeStepsVariant {
  variant_id: string;
  recipe_id: string;
  servings: number;
  steps: unknown[];
  cook_time_minutes: number;
  generated_at: string | null;
}

export interface SupabaseRecipeNutritionTotals {
  total_id: string;
  recipe_id: string;
  servings: number;
  calories_per_serving: number | null;
  protein_per_serving: number | null;
  carbs_per_serving: number | null;
  fat_per_serving: number | null;
  saturated_fat_per_serving: number | null;
  fiber_per_serving: number | null;
  sugar_per_serving: number | null;
  sodium_mg_per_serving: number | null;
  cholesterol_mg_per_serving: number | null;
  ingredients_matched: number | null;
  ingredients_total: number | null;
  match_rate: number | null;
  unmatched_ingredients: unknown[];
  calculated_at: string;
}

export interface SupabaseRecipe {
  recipe_id: string;
  job_id: string | null;
  title: string;
  cuisine: string;
  meal_type: string | null;
  sub_category: string | null;
  servings: number | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  steps: unknown[];
  source_url: string | null;
  source_domain: string | null;
  status: string;
  qa_status: string | null;
  image_url: string | null;
  title_hash: string | null;
  dish_type: string | null;
  cook_time_scale_type: 'invariant' | 'linear_batch' | 'weight_based' | 'surface_area' | null;
  min_servings: number | null;
  created_at: string;
  synced_at: string;
  allergens: string[];
  dietary_restrictions: string[];
  tags: string[];
  recipe_nutrition_totals?: SupabaseRecipeNutritionTotals | SupabaseRecipeNutritionTotals[];
  recipe_ingredients?: SupabaseRecipeIngredient[];
}

export interface SupabaseUserProfile {
  user_id: string;
  display_name: string | null;
  subscription_tier: 'free' | 'pro';
  onboarding_completed: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface SupabaseUserPreferences {
  user_id: string;
  daily_calories: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  preferred_serving_size: number | null;
  meals_per_day: number | null;
  meal_slots: string[];
  plan_days: number | null;
  max_cook_sessions_per_day: number | null;
  allow_leftovers: boolean | null;
  leftover_tolerance: number | null;
  dietary_restrictions: string[];
  allergies: string[];
  excluded_ingredients: string[];
  cuisine_preferences: string[];
  cooking_comfort: 'quick' | 'comfortable' | 'involved' | null;
  missing_tools: string[];
  created_at: string | null;
  updated_at: string | null;
}
