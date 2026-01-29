import { create } from 'zustand';
import type { Recipe } from './mock-data';

interface RecipeSearchResult {
  recipes: Recipe[];
  page: number;
  limit: number;
}

interface RecipeStoreState {
  recipesById: Record<string, Recipe>;
  feedRecipes: Recipe[];
  feedPage: number;
  feedHasMore: boolean;
  feedLoading: boolean;
  feedError: string | null;
  searchQuery: string;
  
  setRecipe: (recipe: Recipe) => void;
  setRecipes: (recipes: Recipe[]) => void;
  getRecipeById: (id: string) => Recipe | undefined;
  
  setFeedRecipes: (recipes: Recipe[], append?: boolean) => void;
  setFeedPage: (page: number) => void;
  setFeedHasMore: (hasMore: boolean) => void;
  setFeedLoading: (loading: boolean) => void;
  setFeedError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  resetFeed: () => void;
}

export const useRecipeStore = create<RecipeStoreState>((set, get) => ({
  recipesById: {},
  feedRecipes: [],
  feedPage: 0,
  feedHasMore: true,
  feedLoading: false,
  feedError: null,
  searchQuery: '',

  setRecipe: (recipe: Recipe) => {
    set((state) => ({
      recipesById: { ...state.recipesById, [recipe.id]: recipe },
    }));
  },

  setRecipes: (recipes: Recipe[]) => {
    set((state) => {
      const newById = { ...state.recipesById };
      for (const recipe of recipes) {
        newById[recipe.id] = recipe;
      }
      return { recipesById: newById };
    });
  },

  getRecipeById: (id: string) => {
    return get().recipesById[id];
  },

  setFeedRecipes: (recipes: Recipe[], append = false) => {
    set((state) => {
      const newById = { ...state.recipesById };
      for (const recipe of recipes) {
        newById[recipe.id] = recipe;
      }
      
      if (append) {
        const existingIds = new Set(state.feedRecipes.map(r => r.id));
        const uniqueNew = recipes.filter(r => !existingIds.has(r.id));
        return {
          feedRecipes: [...state.feedRecipes, ...uniqueNew],
          recipesById: newById,
        };
      }
      
      return {
        feedRecipes: recipes,
        recipesById: newById,
      };
    });
  },

  setFeedPage: (page: number) => set({ feedPage: page }),
  setFeedHasMore: (hasMore: boolean) => set({ feedHasMore: hasMore }),
  setFeedLoading: (loading: boolean) => set({ feedLoading: loading }),
  setFeedError: (error: string | null) => set({ feedError: error }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  resetFeed: () => set({
    feedRecipes: [],
    feedPage: 0,
    feedHasMore: true,
    feedError: null,
  }),
}));

export type FeedRequestType = 'FEED' | 'SEARCH';

export interface FetchRecipesOptions {
  query?: string;
  limit?: number;
  page?: number;
  requestType?: FeedRequestType;
  seedOffset?: number;
  filter?: string;
  mealType?: string;
  timeDifficulty?: string;
  isDiabetic?: boolean;
  maxCarbPercent?: number | null;
}

export async function fetchRecipes(
  options: FetchRecipesOptions = {}
): Promise<RecipeSearchResult> {
  const {
    query = '',
    limit = 20,
    page = 0,
    requestType = 'FEED',
    seedOffset = 0,
    filter = '',
    mealType,
    timeDifficulty,
    isDiabetic,
    maxCarbPercent,
  } = options;

  const params = new URLSearchParams();
  
  // If filter is set, use it as the query (filter takes priority over empty query)
  const effectiveQuery = filter || query;
  if (effectiveQuery) params.append('q', effectiveQuery);
  
  params.append('limit', String(limit));
  params.append('page', String(page));
  params.append('type', requestType);
  params.append('seedOffset', String(seedOffset));
  
  // Add new filter params
  if (mealType) params.append('mealType', mealType);
  if (timeDifficulty) params.append('timeDifficulty', timeDifficulty);
  if (isDiabetic) params.append('isDiabetic', 'true');
  if (maxCarbPercent != null) params.append('maxCarbPercent', String(maxCarbPercent));

  const response = await fetch(`/api/fatsecret/recipes/search?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch recipes');
  }
  
  return response.json();
}

export async function fetchRecipeById(id: string): Promise<Recipe> {
  const response = await fetch(`/api/fatsecret/recipes/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch recipe');
  }
  
  const data = await response.json();
  return data.recipe;
}
