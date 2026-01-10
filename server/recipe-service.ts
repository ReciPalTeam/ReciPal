
import { type Recipe } from "@shared/schema";

interface RecipeService {
  searchRecipes(query: string, filters: any): Promise<Recipe[]>;
  getRecipeDetails(id: number): Promise<Recipe>;
  getNutritionFull(id: number): Promise<any>;
}

class MockRecipeService implements RecipeService {
  async searchRecipes(query: string, filters: any): Promise<Recipe[]> {
    // Return mock data based on seeded recipes or similar
    return []; 
  }

  async getRecipeDetails(id: number): Promise<Recipe> {
    throw new Error("Not implemented");
  }

  async getNutritionFull(id: number): Promise<any> {
    return {
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 20,
      vitamins: { A: "10%", C: "20%" }
    };
  }
}

export const recipeService = new MockRecipeService();
