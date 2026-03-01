import { create } from 'zustand';
import type { Recipe } from './mock-data';

interface RecipeSearchResult {
  recipes: Recipe[];
  page: number;
  limit: number;
}

// Separate state for each feed tab to prevent cross-contamination
interface FeedState {
  recipes: Recipe[];
  nextPage: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  varietyIndex: number;
}

interface RecipeStoreState {
  recipesById: Record<string, Recipe>;
  feedRecipes: Recipe[];
  feedPage: number;
  feedHasMore: boolean;
  feedLoading: boolean;
  feedError: string | null;
  searchQuery: string;
  
  // Separate state for For You and Something New feeds
  forYouFeed: FeedState;
  somethingNewFeed: FeedState;
  
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
  
  // New methods for separate feed state
  setForYouFeed: (state: Partial<FeedState>) => void;
  setSomethingNewFeed: (state: Partial<FeedState>) => void;
  resetForYouFeed: () => void;
  resetSomethingNewFeed: () => void;
}

const initialFeedState: FeedState = {
  recipes: [],
  nextPage: 0,
  hasMore: true,
  isLoadingMore: false,
  isRefreshing: false,
  varietyIndex: 0,
};

export const useRecipeStore = create<RecipeStoreState>((set, get) => ({
  recipesById: {},
  feedRecipes: [],
  feedPage: 0,
  feedHasMore: true,
  feedLoading: false,
  feedError: null,
  searchQuery: '',
  forYouFeed: { ...initialFeedState },
  somethingNewFeed: { ...initialFeedState },

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

  setForYouFeed: (update: Partial<FeedState>) => set((state) => ({
    forYouFeed: { ...state.forYouFeed, ...update },
  })),

  setSomethingNewFeed: (update: Partial<FeedState>) => set((state) => ({
    somethingNewFeed: { ...state.somethingNewFeed, ...update },
  })),

  resetForYouFeed: () => set({
    forYouFeed: { ...initialFeedState },
  }),

  resetSomethingNewFeed: () => set({
    somethingNewFeed: { ...initialFeedState },
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
  cuisine?: string;
  sub_category?: string;
  varietyIndex?: number;
  feedType?: 'forYou' | 'somethingNew';
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
    cuisine,
    sub_category,
    varietyIndex,
    feedType,
  } = options;

  const params = new URLSearchParams();
  
  params.append('limit', String(limit));
  params.append('page', String(page));

  const isFeed = requestType === 'FEED' && !query && !filter;

  if (isFeed && (feedType === 'forYou' || !feedType)) {
    if (cuisine) params.append('cuisine', cuisine);
    if (sub_category) params.append('sub_category', sub_category);
    const response = await fetch(`/api/recipes/feed/for-you?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch recipes');
    return response.json();
  }

  if (isFeed && feedType === 'somethingNew') {
    if (cuisine) params.append('cuisine', cuisine);
    if (sub_category) params.append('sub_category', sub_category);
    const response = await fetch(`/api/recipes/feed/something-new?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch recipes');
    return response.json();
  }

  const effectiveQuery = filter || query;
  if (effectiveQuery) params.append('q', effectiveQuery);

  const response = await fetch(`/api/recipes/search?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch recipes');
  }
  
  return response.json();
}

export interface FetchUntil20Options extends Omit<FetchRecipesOptions, 'limit' | 'page'> {
  pageStart?: number;
  targetCount?: number;
  maxPages?: number;
  excludeIds?: Set<string>;
}

export interface FetchUntil20Result {
  recipes: Recipe[];
  nextPage: number;
  hasMore: boolean;
}

export async function fetchUntil20(
  options: FetchUntil20Options = {}
): Promise<FetchUntil20Result> {
  const {
    pageStart = 0,
    targetCount = 20,
    maxPages = 5,
    excludeIds,
    ...fetchOptions
  } = options;

  const collected: Recipe[] = [];
  const seenIds = new Set<string>(excludeIds || []);
  let page = pageStart;
  let pagesFetched = 0;
  let apiHasMore = true;

  while (collected.length < targetCount && pagesFetched < maxPages && apiHasMore) {
    try {
      const result = await fetchRecipes({
        ...fetchOptions,
        limit: 20,
        page,
      });

      const newRecipes = result.recipes || [];
      
      if (newRecipes.length === 0) {
        apiHasMore = false;
        break;
      }

      if (newRecipes.length < 20) {
        apiHasMore = false;
      }

      for (const recipe of newRecipes) {
        if (!seenIds.has(recipe.id)) {
          seenIds.add(recipe.id);
          collected.push(recipe);
          if (collected.length >= targetCount) {
            break;
          }
        }
      }

      page++;
      pagesFetched++;
    } catch (err) {
      console.error('[fetchUntil20] Error fetching page', page, err);
      break;
    }
  }

  return {
    recipes: collected.slice(0, targetCount),
    nextPage: page,
    hasMore: apiHasMore && collected.length >= targetCount,
  };
}

export async function fetchRecipeById(id: string): Promise<Recipe> {
  const response = await fetch(`/api/recipes/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch recipe');
  }
  
  const data = await response.json();
  return data.recipe;
}
