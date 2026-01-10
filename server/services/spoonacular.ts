const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const BASE_URL = "https://api.spoonacular.com";

export interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  nutrition: {
    nutrients: { name: string; amount: number; unit: string }[];
  };
  extendedIngredients: {
    name: string;
    amount: number;
    unit: string;
    aisle: string;
  }[];
  analyzedInstructions: {
    steps: { number: number; step: string }[];
  }[];
}

export interface RecipeSearchParams {
  query?: string;
  cuisine?: string;
  diet?: string;
  intolerances?: string[];
  maxReadyTime?: number;
  number?: number;
}

class SpoonacularService {
  private isDemo: boolean;
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private CACHE_DURATION = 90 * 24 * 60 * 60 * 1000; // 90 days

  constructor() {
    this.isDemo = !SPOONACULAR_API_KEY;
    if (this.isDemo) {
      console.log("[Spoonacular] Running in DEMO mode - no API key found");
    }
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, expires: Date.now() + this.CACHE_DURATION });
  }

  async searchRecipes(params: RecipeSearchParams): Promise<any[]> {
    if (this.isDemo) {
      return this.getMockRecipes(params);
    }

    const cacheKey = `search:${JSON.stringify(params)}`;
    const cached = this.getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = new URL(`${BASE_URL}/recipes/complexSearch`);
      url.searchParams.set("apiKey", SPOONACULAR_API_KEY!);
      url.searchParams.set("number", String(params.number || 10));
      url.searchParams.set("addRecipeNutrition", "true");
      
      if (params.query) url.searchParams.set("query", params.query);
      if (params.cuisine) url.searchParams.set("cuisine", params.cuisine);
      if (params.diet) url.searchParams.set("diet", params.diet);
      if (params.intolerances?.length) {
        url.searchParams.set("intolerances", params.intolerances.join(","));
      }
      if (params.maxReadyTime) {
        url.searchParams.set("maxReadyTime", String(params.maxReadyTime));
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      
      this.setCache(cacheKey, data.results || []);
      return data.results || [];
    } catch (error) {
      console.error("[Spoonacular] API error:", error);
      return this.getMockRecipes(params);
    }
  }

  async getRecipeDetails(id: number): Promise<any | null> {
    if (this.isDemo) {
      return this.getMockRecipeDetails(id);
    }

    const cacheKey = `details:${id}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${BASE_URL}/recipes/${id}/information?apiKey=${SPOONACULAR_API_KEY}&includeNutrition=true`;
      const res = await fetch(url);
      const data = await res.json();
      
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error("[Spoonacular] API error:", error);
      return this.getMockRecipeDetails(id);
    }
  }

  async getNutritionFull(id: number): Promise<any | null> {
    if (this.isDemo) {
      return this.getMockNutritionFull(id);
    }

    const cacheKey = `nutrition:${id}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${BASE_URL}/recipes/${id}/nutritionWidget.json?apiKey=${SPOONACULAR_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error("[Spoonacular] API error:", error);
      return this.getMockNutritionFull(id);
    }
  }

  private getMockRecipes(params: RecipeSearchParams): any[] {
    const mockRecipes = [
      {
        id: 1001,
        title: "Grilled Chicken Salad",
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
        readyInMinutes: 25,
        servings: 2,
        nutrition: { nutrients: [
          { name: "Calories", amount: 380, unit: "kcal" },
          { name: "Protein", amount: 35, unit: "g" },
          { name: "Carbohydrates", amount: 15, unit: "g" },
          { name: "Fat", amount: 18, unit: "g" }
        ]}
      },
      {
        id: 1002,
        title: "Vegetable Stir Fry",
        image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400",
        readyInMinutes: 20,
        servings: 3,
        nutrition: { nutrients: [
          { name: "Calories", amount: 280, unit: "kcal" },
          { name: "Protein", amount: 12, unit: "g" },
          { name: "Carbohydrates", amount: 35, unit: "g" },
          { name: "Fat", amount: 10, unit: "g" }
        ]}
      },
      {
        id: 1003,
        title: "Salmon with Quinoa",
        image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400",
        readyInMinutes: 35,
        servings: 2,
        nutrition: { nutrients: [
          { name: "Calories", amount: 520, unit: "kcal" },
          { name: "Protein", amount: 42, unit: "g" },
          { name: "Carbohydrates", amount: 30, unit: "g" },
          { name: "Fat", amount: 24, unit: "g" }
        ]}
      }
    ];

    return mockRecipes.slice(0, params.number || 10);
  }

  private getMockRecipeDetails(id: number): any {
    return {
      id,
      title: "Mock Recipe Details",
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
      readyInMinutes: 30,
      servings: 4,
      extendedIngredients: [
        { name: "chicken breast", amount: 2, unit: "pieces", aisle: "Meat" },
        { name: "olive oil", amount: 2, unit: "tbsp", aisle: "Oils" },
        { name: "garlic", amount: 3, unit: "cloves", aisle: "Produce" },
        { name: "lemon", amount: 1, unit: "whole", aisle: "Produce" }
      ],
      analyzedInstructions: [{
        steps: [
          { number: 1, step: "Preheat oven to 400°F" },
          { number: 2, step: "Season chicken with salt and pepper" },
          { number: 3, step: "Heat oil in pan and sear chicken" },
          { number: 4, step: "Transfer to oven and bake for 20 minutes" }
        ]
      }],
      nutrition: {
        nutrients: [
          { name: "Calories", amount: 380, unit: "kcal" },
          { name: "Protein", amount: 35, unit: "g" },
          { name: "Carbohydrates", amount: 8, unit: "g" },
          { name: "Fat", amount: 22, unit: "g" }
        ]
      }
    };
  }

  private getMockNutritionFull(id: number): any {
    return {
      calories: "380",
      carbs: "8g",
      fat: "22g",
      protein: "35g",
      nutrients: [
        { name: "Calories", amount: 380, unit: "kcal", percentOfDailyNeeds: 19 },
        { name: "Fat", amount: 22, unit: "g", percentOfDailyNeeds: 34 },
        { name: "Saturated Fat", amount: 5, unit: "g", percentOfDailyNeeds: 31 },
        { name: "Carbohydrates", amount: 8, unit: "g", percentOfDailyNeeds: 3 },
        { name: "Fiber", amount: 2, unit: "g", percentOfDailyNeeds: 8 },
        { name: "Sugar", amount: 2, unit: "g", percentOfDailyNeeds: 2 },
        { name: "Protein", amount: 35, unit: "g", percentOfDailyNeeds: 70 },
        { name: "Sodium", amount: 320, unit: "mg", percentOfDailyNeeds: 14 },
        { name: "Potassium", amount: 450, unit: "mg", percentOfDailyNeeds: 13 },
        { name: "Vitamin A", amount: 150, unit: "IU", percentOfDailyNeeds: 3 },
        { name: "Vitamin C", amount: 12, unit: "mg", percentOfDailyNeeds: 15 },
        { name: "Calcium", amount: 25, unit: "mg", percentOfDailyNeeds: 3 },
        { name: "Iron", amount: 1.5, unit: "mg", percentOfDailyNeeds: 8 }
      ],
      good: [
        { title: "Protein", amount: "35g", percentOfDailyNeeds: 70 },
        { title: "Vitamin C", amount: "12mg", percentOfDailyNeeds: 15 }
      ],
      bad: [
        { title: "Saturated Fat", amount: "5g", percentOfDailyNeeds: 31 }
      ]
    };
  }

  isDemoMode(): boolean {
    return this.isDemo;
  }
}

export const spoonacularService = new SpoonacularService();
