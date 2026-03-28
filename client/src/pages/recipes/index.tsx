import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, Heart, Clock, Users, Plus, Share2, ChefHat, Sparkles, Baby, Timer, Minus, ShoppingCart, Utensils, AlertTriangle, Loader2, X, Gauge, ChevronDown, ChevronUp, BookOpen, Pencil, Trash2 } from "lucide-react";
import { ManualEntrySheet } from "@/components/manual-entry-sheet";
import type { CustomRecipe } from "@shared/schema";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CollapsibleFilterSection } from "@/components/collapsible-filter-section";
import type { Recipe } from "@/lib/mock-data";
import { useDemoStore, FoodGroup, MealType, normalizeIngredientName } from "@/lib/demo-store";
import { useRecipeStore, fetchRecipes, fetchUntil20, FetchRecipesOptions } from "@/lib/recipe-store";
import { filterRecipesByCuisine, rankRecipes } from "@/lib/recipe-filters";
import { useProfile } from "@/hooks/use-profile";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RecipeCard } from "@/components/recipe-card";
import { mapCustomRecipeToFeedRecipe } from "@/lib/custom-recipe-adapter";

const RECIPES_NAV_STATE_KEY = "recipesNavState";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

/*
 * FILTER OPTIONS SPEC:
 * These filters reflect how people actually choose meals (meal type, time, cost, kid-friendly)
 * and must map to onboarding personalization inputs.
 */

const FILTER_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks", "Side"];

interface CuisineCategory {
  name: string;
  subCategories?: string[];
}

const CUISINE_CATEGORIES: CuisineCategory[] = [
  {
    name: "American",
    subCategories: [
      "Southern / Comfort Food",
      "Soul Food",
      "Barbecue (BBQ)",
      "Cajun",
      "Creole",
      "Tex-Mex",
      "Diner / Classic American",
      "Hawaiian",
    ],
  },
  { name: "Mexican" },
  { name: "Italian" },
  {
    name: "Latin American",
    subCategories: [
      "Brazilian",
      "Puerto Rican",
      "Peruvian",
      "Cuban",
      "Colombian",
      "Venezuelan",
      "Chilean",
      "Ecuadorian",
      "Bolivian",
      "Uruguayan",
    ],
  },
  {
    name: "Asian",
    subCategories: [
      "Chinese",
      "Japanese",
      "Korean",
      "Thai",
      "Vietnamese",
      "Filipino",
      "Indonesian",
      "Malaysian",
      "Pan-Asian",
      "Asian Fusion",
    ],
  },
  { name: "French" },
  { name: "Mediterranean" },
  { name: "Indian" },
  { name: "Middle Eastern" },
  {
    name: "Caribbean",
    subCategories: [
      "Jamaican",
      "Dominican",
      "Haitian",
      "Trinidadian",
      "Barbadian",
      "Caribbean Fusion",
    ],
  },
  {
    name: "African",
    subCategories: [
      "Ethiopian",
      "Moroccan",
      "Nigerian",
      "Senegalese",
      "Egyptian",
      "African Fusion",
    ],
  },
];

const MAIN_CUISINE_NAMES = new Set(CUISINE_CATEGORIES.map(c => c.name));

function resolveCuisineFilter(selected: string[]): { cuisine?: string; sub_category?: string } {
  if (selected.length === 0) return {};
  const first = selected[0];
  if (MAIN_CUISINE_NAMES.has(first)) {
    return { cuisine: first };
  }
  const parent = CUISINE_CATEGORIES.find(c => c.subCategories?.includes(first));
  if (parent) {
    return { cuisine: parent.name, sub_category: first };
  }
  return { cuisine: first };
}

const TIME_DIFFICULTY_OPTIONS = [
  { value: "quick", label: "Quick & easy" },
  { value: "comfortable", label: "Comfortable following recipes" },
  { value: "involved", label: "I enjoy more involved cooking" },
];

const DIETARY_RESTRICTIONS = [
  "None", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", 
  "Dairy-free", "Gluten-free", "Low-carb"
];

const ALLERGIES = [
  "Peanuts", "Tree nuts", "Shellfish", "Fish", "Dairy", 
  "Eggs", "Soy", "Gluten", "Sesame", "Other"
];

interface RecipeWithOverlap extends Recipe {
  overlap: { have: string[]; might: string[]; missing: string[] };
  overlapScore: number;
  pantryHaveCount: number;
  pantryMaybeCount: number;
  pantryNeedCount: number;
  pantryMissingIsSmall: boolean;
  pantryFitScore: number;
  isInjected?: boolean;
}

const COMFORT_MAP: Record<string, string[]> = {
  quick: ["American", "Mexican", "Diner / Classic American", "Tex-Mex", "Chinese", "Thai", "Vietnamese"],
  comfortable: ["Italian", "Asian", "Mediterranean", "Indian", "Korean", "Japanese", "Latin American", "French"],
  involved: ["Barbecue (BBQ)", "Southern / Comfort Food", "Soul Food", "Cajun", "Creole", "Middle Eastern", "Caribbean", "African", "Ethiopian", "Moroccan", "Peruvian"],
};

function hasAllergyConflict(recipe: Recipe, allergies: string[]): boolean {
  if (allergies.length === 0) return false;
  const ingredientNames = recipe.ingredients.map(i => i.name.toLowerCase());
  return allergies.some(allergy => {
    const allergyLower = allergy.toLowerCase();
    return ingredientNames.some(ing => ing.includes(allergyLower));
  });
}

function enrichWithOverlap(recipe: Recipe, getPantryOverlap: (r: Recipe) => { have: string[]; might: string[]; missing: string[] }): RecipeWithOverlap {
  const overlap = getPantryOverlap(recipe);
  const haveCount = overlap.have.length;
  const maybeCount = overlap.might.length;
  const needCount = overlap.missing.length;
  const total = recipe.ingredients.length;
  const overlapRatio = total > 0 ? ((haveCount * 2) + maybeCount) / (total * 2) : 0;
  const fitScore = (haveCount * 2) + maybeCount - needCount;
  return {
    ...recipe,
    overlap,
    overlapScore: overlapRatio,
    pantryHaveCount: haveCount,
    pantryMaybeCount: maybeCount,
    pantryNeedCount: needCount,
    pantryMissingIsSmall: needCount >= 2 && needCount <= 3,
    pantryFitScore: fitScore,
  };
}

function rankForYouBatch(
  recipes: Recipe[],
  getPantryOverlap: (r: Recipe) => { have: string[]; might: string[]; missing: string[] },
  opts: { allergies: string[]; cookingComfort: string }
): Recipe[] {
  const enriched = recipes.map(r => enrichWithOverlap(r, getPantryOverlap));
  const safeRecipes = enriched.filter(r => !hasAllergyConflict(r, opts.allergies));
  const preferredCuisines = COMFORT_MAP[opts.cookingComfort] || [];

  const baseList = safeRecipes
    .filter(r => !r.pantryMissingIsSmall)
    .sort((a, b) => {
      const fitDiff = b.pantryFitScore - a.pantryFitScore;
      if (Math.abs(fitDiff) > 2) return fitDiff > 0 ? 1 : -1;
      const aComfort = preferredCuisines.includes(a.cookingStyle) ? 1 : 0;
      const bComfort = preferredCuisines.includes(b.cookingStyle) ? 1 : 0;
      if (aComfort !== bComfort) return bComfort - aComfort;
      return a.id.localeCompare(b.id);
    });

  const closeList = safeRecipes
    .filter(r => r.pantryMissingIsSmall)
    .sort((a, b) => a.pantryNeedCount - b.pantryNeedCount);

  const finalFeed: Recipe[] = [];
  let baseIndex = 0;
  let closeIndex = 0;
  const usedIds = new Set<string>();
  let position = 1;

  while (baseIndex < baseList.length || closeIndex < closeList.length) {
    if (position % 5 === 0 && closeIndex < closeList.length) {
      const recipe = closeList[closeIndex];
      if (!usedIds.has(recipe.id)) {
        finalFeed.push({ ...recipe, isInjected: true } as Recipe);
        usedIds.add(recipe.id);
        closeIndex++;
      }
    } else if (baseIndex < baseList.length) {
      const recipe = baseList[baseIndex];
      if (!usedIds.has(recipe.id)) {
        finalFeed.push(recipe);
        usedIds.add(recipe.id);
      }
      baseIndex++;
    } else if (closeIndex < closeList.length) {
      const recipe = closeList[closeIndex];
      if (!usedIds.has(recipe.id)) {
        finalFeed.push({ ...recipe, isInjected: true } as Recipe);
        usedIds.add(recipe.id);
      }
      closeIndex++;
    }
    position++;
  }

  return finalFeed;
}

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("for-you");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [myMealsSubTab, setMyMealsSubTab] = useState<"favorites" | "my-recipes">("favorites");
  const [editingRecipe, setEditingRecipe] = useState<{ id: number; name: string; ingredients: any[] } | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);

  const VALID_TAB_KEYS = ["for-you", "new", "favorites"];

  // Restore navigation state on mount (feed toggle + scroll position)
  useEffect(() => {
    const savedState = sessionStorage.getItem(RECIPES_NAV_STATE_KEY);
    if (savedState) {
      try {
        const { sourceFeedKey, scrollY } = JSON.parse(savedState);
        // Only restore if sourceFeedKey is a valid tab value
        if (sourceFeedKey && VALID_TAB_KEYS.includes(sourceFeedKey)) {
          setActiveTab(sourceFeedKey);
          // Restore scroll position after a short delay to allow DOM to render
          setTimeout(() => {
            if (scrollContainerRef.current && typeof scrollY === "number") {
              scrollContainerRef.current.scrollTop = scrollY;
            }
          }, 50);
        }
      } catch (e) {
        // Invalid state, ignore
      }
      // Clear state after restoring to prevent stale restores
      sessionStorage.removeItem(RECIPES_NAV_STATE_KEY);
    }
  }, []);

  // Save navigation state before navigating to recipe detail
  const navigateToRecipe = (recipeId: string) => {
    const scrollY = scrollContainerRef.current?.scrollTop || 0;
    sessionStorage.setItem(RECIPES_NAV_STATE_KEY, JSON.stringify({
      sourceFeedKey: activeTab,
      scrollY,
      sourceRecipeId: recipeId,
    }));
    setLocation(`/recipe/${recipeId}`);
  };
  
  // STAGED filter state - what user edits in the Sheet (not applied until "Apply Filters")
  const [stagedMealTypes, setStagedMealTypes] = useState<string[]>([]);
  const [stagedCuisines, setStagedCuisines] = useState<string[]>([]);
  const [expandedCuisines, setExpandedCuisines] = useState<string[]>([]);
  
  // ACTIVE filter state - what's actually used for filtering (applied on "Apply Filters")
  const [activeMealTypes, setActiveMealTypes] = useState<string[]>([]);
  const [activeCuisines, setActiveCuisines] = useState<string[]>([]);
  
  // User preferences state - PERSISTED to profile (affect For You)
  const [selectedServingSize, setSelectedServingSize] = useState<number>(1);
  const [kidFriendly, setKidFriendly] = useState(false);
  const [timeDifficulty, setTimeDifficulty] = useState<string>("");
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [isDiabetic, setIsDiabetic] = useState(false);
  const [carbLimitGrams, setCarbLimitGrams] = useState<number | null>(null);
  
  // Initialize preferences from profile when available (resets on every mount)
  useEffect(() => {
    if (profile) {
      setTimeDifficulty(profile.cookingComfort || "");
      setKidFriendly(false);
      setSelectedServingSize(profile.preferredServingSize || 1);
      setSelectedDietary(profile.dietaryPreferences || []);
      setSelectedAllergies(profile.allergies || []);
      setIsDiabetic(profile.isDiabetic || false);
      setCarbLimitGrams(profile.maxCarbGrams ?? null);
    }
  }, [profile]);
  
  // Active search state (when user manually searches via Enter key)
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>("");
  
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedDay, setSelectedDay] = useState("0");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");
  const [maybeResolutions, setMaybeResolutions] = useState<Record<string, "have" | "need">>({});

  const { getPantryOverlap, addToPlanner, pantry, updatePantryState } = useDemoStore();
  const { 
    feedRecipes: apiRecipes, 
    feedPage, 
    feedHasMore, 
    feedLoading,
    feedError,
    setFeedRecipes,
    setFeedPage,
    setFeedHasMore,
    setFeedLoading,
    setFeedError,
    setRecipes,
    getRecipeById,
    forYouFeed,
    somethingNewFeed,
    setForYouFeed,
    setSomethingNewFeed,
  } = useRecipeStore();
  
  const queryClient = useQueryClient();
  
  const { data: favoriteIds = [], isLoading: favoritesLoading } = useQuery<string[]>({
    queryKey: ['/api/user-favorites/ids'],
    select: (data: any) => data.ids || [],
  });
  
  const { data: dbFavoriteRecipes = [], isLoading: dbFavoritesLoading } = useQuery<Recipe[]>({
    queryKey: ['/api/user-favorites'],
    select: (data: any) => data.favorites || [],
    enabled: activeTab === 'favorites',
  });

  const { data: customRecipesList = [], isLoading: customRecipesLoading } = useQuery<CustomRecipe[]>({
    queryKey: ['/api/custom-recipes'],
    enabled: activeTab === 'favorites',
  });

  const deleteCustomRecipeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/custom-recipes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-recipes'] });
      toast({ title: "Deleted", description: "Custom recipe deleted" });
    },
  });
  
  const addFavoriteMutation = useMutation({
    mutationFn: async ({ recipeId, recipe }: { recipeId: string; recipe: Recipe }) => {
      return apiRequest('POST', `/api/user-favorites/${recipeId}`, { recipe });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-favorites/ids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-favorites'] });
    },
  });
  
  const removeFavoriteMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      return apiRequest('DELETE', `/api/user-favorites/${recipeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-favorites/ids'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-favorites'] });
    },
  });
  
  const handleToggleFavorite = (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    const isFavorited = favoriteIds.includes(recipe.id);
    
    if (isFavorited) {
      removeFavoriteMutation.mutate(recipe.id);
      toast({
        title: "Removed from favorites",
        description: `${recipe.title} removed from your favorites`,
      });
    } else {
      addFavoriteMutation.mutate({ recipeId: recipe.id, recipe });
      toast({
        title: "Added to favorites",
        description: `${recipe.title} saved to your favorites`,
      });
    }
  };

  const INITIAL_LOAD = 20;
  const LOAD_MORE_BATCH = 20;

  const loadRecipes = useCallback(async (
    page: number, 
    append: boolean = false,
    options: { seedOffset?: number; filter?: string; searchQuery?: string; varietyIndex?: number; skipCache?: boolean; force?: boolean; overrideMealTypes?: string[]; overrideCuisines?: string[] } = {}
  ) => {
    if (feedLoading && !options.force) return;
    
    setFeedLoading(true);
    setFeedError(null);
    
    try {
      const effectiveMealTypes = options.overrideMealTypes ?? activeMealTypes;
      const effectiveCuisines = options.overrideCuisines ?? activeCuisines;
      // Get selected meal type for hard filter (use first selected, or undefined)
      const mealTypeFilter = effectiveMealTypes.length > 0 ? effectiveMealTypes[0] : undefined;
      
      // Use filter panel timeDifficulty, or fall back to profile cookingComfort
      const effectiveTimeDifficulty = timeDifficulty || profile?.cookingComfort;
      
      const effectiveIsDiabetic = isDiabetic;
      const effectiveMaxCarbGrams = isDiabetic ? (carbLimitGrams ?? undefined) : undefined;
      
      // Use explicit searchQuery from options if provided (user-initiated search)
      const queryToUse = options.searchQuery ?? activeSearchQuery;
      const isUserSearch = queryToUse && queryToUse.trim() !== '';
      
      // Determine the seedOffset for this feed
      const seedOffset = isUserSearch ? 0 : (options.seedOffset ?? (activeTab === 'new' ? 5 : 0));
      const isForYou = activeTab === 'for-you' && !isUserSearch;
      const isSomethingNew = activeTab === 'new' && !isUserSearch;
      
      // For initial load (page 0, not append), use fetchUntil20 for guaranteed 20 cards
      if (page === 0 && !append && !isUserSearch) {
        // Check if we already have cached results for this feed (skip when filters just changed)
        if (!options.skipCache) {
          const cachedFeed = isForYou ? forYouFeed : (isSomethingNew ? somethingNewFeed : null);
          if (cachedFeed && cachedFeed.recipes.length >= 20) {
            setFeedRecipes(cachedFeed.recipes, false);
            setRecipes(cachedFeed.recipes);
            setFeedPage(0);
            setFeedHasMore(cachedFeed.hasMore);
            setFeedLoading(false);
            return;
          }
        }
        
        // Get varietyIndex from options or current feed state
        const currentFeed = isForYou ? forYouFeed : somethingNewFeed;
        const effectiveVarietyIndex = options.varietyIndex ?? currentFeed?.varietyIndex ?? 0;
        
        const resolved = resolveCuisineFilter(effectiveCuisines);
        
        const effectiveAllergens = selectedAllergies.length > 0 ? selectedAllergies : undefined;
        const effectiveDietary = selectedDietary.filter(d => d !== 'None').length > 0 ? selectedDietary.filter(d => d !== 'None') : undefined;
        const effectiveServingSize = isSomethingNew ? undefined : (selectedServingSize > 0 ? selectedServingSize : undefined);
        
        const result = await fetchUntil20({
          query: queryToUse || '',
          requestType: 'FEED',
          seedOffset,
          filter: isSomethingNew ? '' : (options.filter || ''),
          mealType: isSomethingNew ? undefined : mealTypeFilter,
          timeDifficulty: isSomethingNew ? undefined : effectiveTimeDifficulty,
          isDiabetic: isSomethingNew ? false : effectiveIsDiabetic,
          maxCarbGrams: isSomethingNew ? undefined : effectiveMaxCarbGrams,
          allergens: effectiveAllergens,
          dietaryRestrictions: effectiveDietary,
          servingSize: effectiveServingSize,
          cuisine: resolved.cuisine,
          sub_category: resolved.sub_category,
          varietyIndex: effectiveVarietyIndex,
          feedType: isForYou ? 'forYou' : 'somethingNew',
          pageStart: 0,
          targetCount: 20,
          maxPages: 5,
        });
        
        const rankedBatch = isForYou
          ? rankForYouBatch(result.recipes, getPantryOverlap, {
              allergies: selectedAllergies,
              cookingComfort: timeDifficulty || profile?.cookingComfort || 'comfortable',
            })
          : result.recipes;
        
        if (isForYou) {
          setForYouFeed({
            recipes: rankedBatch,
            nextPage: result.nextPage,
            hasMore: result.hasMore,
          });
        } else if (isSomethingNew) {
          setSomethingNewFeed({
            recipes: rankedBatch,
            nextPage: result.nextPage,
            hasMore: result.hasMore,
          });
        }
        
        setFeedRecipes(rankedBatch, false);
        setRecipes(rankedBatch);
        setFeedPage(0);
        setFeedHasMore(result.hasMore);
      } else {
        // For load more or search, use regular fetchRecipes
        const limit = page === 0 ? INITIAL_LOAD : LOAD_MORE_BATCH;
        
        const result = await fetchRecipes({
          query: queryToUse || '',
          limit,
          page,
          requestType: isUserSearch ? 'SEARCH' : 'FEED',
          seedOffset,
          filter: isUserSearch ? '' : (options.filter || ''),
          mealType: isUserSearch ? undefined : mealTypeFilter,
          timeDifficulty: effectiveTimeDifficulty,
          isDiabetic: effectiveIsDiabetic,
          maxCarbGrams: effectiveMaxCarbGrams,
        });
        
        if (result.recipes.length < limit) {
          setFeedHasMore(false);
        }
        
        setFeedRecipes(result.recipes, append);
        setRecipes(result.recipes);
        setFeedPage(page);
      }
    } catch (err) {
      console.error('[Recipes] Failed to load:', err);
      setFeedError('Failed to load recipes. Using cached data.');
    } finally {
      setFeedLoading(false);
    }
  }, [feedLoading, setFeedLoading, setFeedError, setFeedHasMore, setFeedRecipes, setRecipes, setFeedPage, activeMealTypes, activeCuisines, activeSearchQuery, activeTab, timeDifficulty, profile, forYouFeed, somethingNewFeed, setForYouFeed, setSomethingNewFeed, selectedAllergies, selectedDietary, selectedServingSize, isDiabetic, carbLimitGrams]);

  // Load more recipes (infinite scroll) - appends 20 new recipes
  const loadMore = useCallback(async () => {
    const isForYou = activeTab === 'for-you';
    const isSomethingNew = activeTab === 'new';
    
    // Only works for For You and Something New feeds
    if (!isForYou && !isSomethingNew) return;
    
    const currentFeed = isForYou ? forYouFeed : somethingNewFeed;
    
    // Gate: don't load if already loading or no more
    if (currentFeed.isLoadingMore || !currentFeed.hasMore) return;
    
    // Set loading state
    if (isForYou) {
      setForYouFeed({ isLoadingMore: true });
    } else {
      setSomethingNewFeed({ isLoadingMore: true });
    }
    
    try {
      const mealTypeFilter = activeMealTypes.length > 0 ? activeMealTypes[0] : undefined;
      const resolved = resolveCuisineFilter(activeCuisines);
      const effectiveTimeDifficulty = timeDifficulty || profile?.cookingComfort;
      const effectiveIsDiabetic = isDiabetic;
      const effectiveMaxCarbGrams = isDiabetic ? (carbLimitGrams ?? undefined) : undefined;
      const seedOffset = isSomethingNew ? 5 : 0;
      
      const existingIds = new Set(currentFeed.recipes.map(r => r.id));
      
      const effectiveAllergens = selectedAllergies.length > 0 ? selectedAllergies : undefined;
      const effectiveDietary = selectedDietary.filter(d => d !== 'None').length > 0 ? selectedDietary.filter(d => d !== 'None') : undefined;
      const effectiveServingSize = isSomethingNew ? undefined : (selectedServingSize > 0 ? selectedServingSize : undefined);
      
      const result = await fetchUntil20({
        query: '',
        requestType: 'FEED',
        seedOffset,
        filter: '',
        mealType: isSomethingNew ? undefined : mealTypeFilter,
        timeDifficulty: isSomethingNew ? undefined : effectiveTimeDifficulty,
        isDiabetic: isSomethingNew ? false : effectiveIsDiabetic,
        maxCarbGrams: isSomethingNew ? undefined : effectiveMaxCarbGrams,
        allergens: effectiveAllergens,
        dietaryRestrictions: effectiveDietary,
        servingSize: effectiveServingSize,
        cuisine: resolved.cuisine,
        sub_category: resolved.sub_category,
        varietyIndex: currentFeed.varietyIndex ?? 0,
        feedType: isForYou ? 'forYou' : 'somethingNew',
        pageStart: currentFeed.nextPage,
        targetCount: 20,
        maxPages: 5,
        excludeIds: existingIds,
      });
      
      const noNewRecipes = result.recipes.length === 0;
      
      const rankedNew = isForYou
        ? rankForYouBatch(result.recipes, getPantryOverlap, {
            allergies: selectedAllergies,
            cookingComfort: timeDifficulty || profile?.cookingComfort || 'comfortable',
          })
        : result.recipes;
      
      const combinedRecipes = [...currentFeed.recipes, ...rankedNew];
      
      if (isForYou) {
        setForYouFeed({
          recipes: combinedRecipes,
          nextPage: result.nextPage,
          hasMore: result.hasMore && !noNewRecipes,
          isLoadingMore: false,
        });
      } else {
        setSomethingNewFeed({
          recipes: combinedRecipes,
          nextPage: result.nextPage,
          hasMore: result.hasMore && !noNewRecipes,
          isLoadingMore: false,
        });
      }
      
      setFeedRecipes(rankedNew, true);
      setRecipes(rankedNew);
      setFeedHasMore(result.hasMore && !noNewRecipes);
    } catch (err) {
      console.error('[Recipes] Failed to load more:', err);
      if (isForYou) {
        setForYouFeed({ isLoadingMore: false });
      } else {
        setSomethingNewFeed({ isLoadingMore: false });
      }
    }
  }, [activeTab, forYouFeed, somethingNewFeed, setForYouFeed, setSomethingNewFeed, setFeedRecipes, setRecipes, setFeedHasMore, activeMealTypes, activeCuisines, timeDifficulty, profile, getPantryOverlap, selectedAllergies, selectedDietary, selectedServingSize, isDiabetic, carbLimitGrams]);

  // Refresh feed when re-tapping the active tab
  const refreshFeed = useCallback(async (feedType: 'for-you' | 'new') => {
    const isForYou = feedType === 'for-you';
    const currentFeed = isForYou ? forYouFeed : somethingNewFeed;
    
    // Debounce: If already refreshing, loading, or loading more, ignore
    if (currentFeed.isRefreshing || currentFeed.isLoadingMore || feedLoading) {
      return;
    }
    
    // Increment varietyIndex for fresh variety keywords
    const newVarietyIndex = (currentFeed.varietyIndex ?? 0) + 1;
    
    // Set refreshing flag and increment varietyIndex
    if (isForYou) {
      setForYouFeed({ isRefreshing: true, varietyIndex: newVarietyIndex });
    } else {
      setSomethingNewFeed({ isRefreshing: true, varietyIndex: newVarietyIndex });
    }
    
    // Clear current feed state to force fresh API call (bypass cache)
    setFeedRecipes([], false);
    setFeedPage(0);
    setFeedHasMore(true);
    
    // Clear the cached feed to force a fresh fetch (preserve varietyIndex)
    if (isForYou) {
      setForYouFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false, varietyIndex: newVarietyIndex });
    } else {
      setSomethingNewFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false, varietyIndex: newVarietyIndex });
    }
    
    // Scroll to top
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    
    // Load fresh recipes with new varietyIndex
    try {
      await loadRecipes(0, false, { seedOffset: feedType === 'new' ? 5 : 0, searchQuery: '', varietyIndex: newVarietyIndex });
    } finally {
      // Clear refreshing flag
      if (isForYou) {
        setForYouFeed({ isRefreshing: false });
      } else {
        setSomethingNewFeed({ isRefreshing: false });
      }
    }
  }, [forYouFeed, somethingNewFeed, feedLoading, setForYouFeed, setSomethingNewFeed, setFeedRecipes, setFeedPage, setFeedHasMore, loadRecipes]);

  // Handle tab click - detect re-tap to refresh
  const handleTabClick = useCallback((tabValue: string) => {
    if (tabValue === activeTab) {
      // Re-tapping active tab - refresh the feed
      if (tabValue === 'for-you' || tabValue === 'new') {
        refreshFeed(tabValue as 'for-you' | 'new');
      }
    } else {
      setActiveTab(tabValue);
      if (tabValue === 'new') {
        setFilterOpen(false);
      }
    }
  }, [activeTab, refreshFeed]);

  const handleSaveFilters = useCallback(() => {
    setFilterOpen(false);
    
    setActiveMealTypes(stagedMealTypes);
    setActiveCuisines(stagedCuisines);
    
    toast({
      title: "Filters applied",
      description: "Your recipe filters have been updated.",
      duration: 2000,
    });
    
    filterAppliedByHandler.current = true;
    
    if (activeTab !== 'favorites') {
      setSearchQuery('');
      setActiveSearchQuery('');
      setFeedRecipes([], false);
      setFeedPage(0);
      setFeedHasMore(true);
      
      if (activeTab === 'for-you') {
        setForYouFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
      } else if (activeTab === 'new') {
        setSomethingNewFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
      }
      
      loadRecipes(0, false, { seedOffset: activeTab === 'new' ? 5 : 0, searchQuery: '', skipCache: true, force: true, overrideMealTypes: stagedMealTypes, overrideCuisines: stagedCuisines });
    }
  }, [
    stagedMealTypes, stagedCuisines,
    toast, setForYouFeed, setSomethingNewFeed, activeTab, setFeedRecipes, setFeedPage, 
    setFeedHasMore, loadRecipes, setFilterOpen
  ]);

  // IntersectionObserver for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );
    
    observer.observe(sentinel);
    
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    if (apiRecipes.length === 0 && !feedLoading) {
      loadRecipes(0, false);
    }
  }, []);

  const prevTab = useRef(activeTab);
  useEffect(() => {
    if (prevTab.current !== activeTab && activeTab !== 'favorites') {
      setSearchQuery('');
      setActiveSearchQuery('');
      
      const isForYou = activeTab === 'for-you';
      const isSomethingNew = activeTab === 'new';
      const cachedFeed = isForYou ? forYouFeed : (isSomethingNew ? somethingNewFeed : null);
      
      if (cachedFeed && cachedFeed.recipes.length > 0) {
        setFeedRecipes(cachedFeed.recipes, false);
        setRecipes(cachedFeed.recipes);
        setFeedPage(0);
        setFeedHasMore(cachedFeed.hasMore);
      } else {
        setFeedRecipes([], false);
        setFeedPage(0);
        setFeedHasMore(true);
        loadRecipes(0, false, { seedOffset: activeTab === 'new' ? 5 : 0, searchQuery: '' });
      }
    }
    prevTab.current = activeTab;
  }, [activeTab, loadRecipes, forYouFeed, somethingNewFeed, setFeedRecipes, setRecipes, setFeedPage, setFeedHasMore]);

  const filterAppliedByHandler = useRef(false);

  const prevMealTypes = useRef<string[]>([]);
  useEffect(() => {
    if (filterAppliedByHandler.current) {
      prevMealTypes.current = activeMealTypes;
      return;
    }
    const mealTypesChanged = JSON.stringify(prevMealTypes.current) !== JSON.stringify(activeMealTypes);
    if (mealTypesChanged && prevMealTypes.current.length > 0 || (activeMealTypes.length > 0 && prevMealTypes.current.length === 0)) {
      if (activeTab !== 'favorites') {
        setSearchQuery('');
        setActiveSearchQuery('');
        setFeedRecipes([], false);
        setFeedPage(0);
        setFeedHasMore(true);
        
        if (activeTab === 'for-you') {
          setForYouFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
        } else if (activeTab === 'new') {
          setSomethingNewFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
        }
        
        loadRecipes(0, false, { seedOffset: activeTab === 'new' ? 5 : 0, searchQuery: '', skipCache: true, force: true });
      }
    }
    prevMealTypes.current = activeMealTypes;
  }, [activeMealTypes, activeTab, loadRecipes, setForYouFeed, setSomethingNewFeed]);

  const prevCuisines = useRef<string[]>([]);
  useEffect(() => {
    if (filterAppliedByHandler.current) {
      prevCuisines.current = activeCuisines;
      filterAppliedByHandler.current = false;
      return;
    }
    const cuisinesChanged = JSON.stringify(prevCuisines.current) !== JSON.stringify(activeCuisines);
    if (cuisinesChanged && (prevCuisines.current.length > 0 || activeCuisines.length > 0)) {
      if (activeTab !== 'favorites') {
        setSearchQuery('');
        setActiveSearchQuery('');
        setFeedRecipes([], false);
        setFeedPage(0);
        setFeedHasMore(true);

        if (activeTab === 'for-you') {
          setForYouFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
        } else if (activeTab === 'new') {
          setSomethingNewFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
        }

        loadRecipes(0, false, { seedOffset: activeTab === 'new' ? 5 : 0, searchQuery: '', skipCache: true, force: true });
      }
    }
    prevCuisines.current = activeCuisines;
  }, [activeCuisines, activeTab, loadRecipes, setForYouFeed, setSomethingNewFeed]);

  // NOTE: timeDifficulty changes no longer auto-reload the feed
  // Preference changes only take effect when the Save button is pressed
  // This prevents "auto-save" behavior per prompt 2J requirements

  // Get user's profile preferences for ranking
  const userDietaryPreferences = profile?.dietaryPreferences || [];
  const userAllergies = profile?.allergies || [];
  const userCookingComfort = profile?.cookingComfort || "comfortable";

  const recipesWithOverlap: RecipeWithOverlap[] = useMemo(() => {
    const recipesToUse = apiRecipes;
    return recipesToUse.map(recipe => {
      const overlap = getPantryOverlap(recipe);
      const total = recipe.ingredients.length;
      const haveCount = overlap.have.length;
      const maybeCount = overlap.might.length;
      const needCount = overlap.missing.length;
      const overlapRatio = total > 0 ? ((haveCount * 2) + maybeCount) / (total * 2) : 0;
      // Pantry fit score: (have*2) + maybe - need (higher = better fit)
      const fitScore = (haveCount * 2) + maybeCount - needCount;
      return { 
        ...recipe, 
        overlap, 
        overlapScore: overlapRatio,
        pantryHaveCount: haveCount,
        pantryMaybeCount: maybeCount,
        pantryNeedCount: needCount,
        pantryMissingIsSmall: needCount >= 2 && needCount <= 3,
        pantryFitScore: fitScore,
      };
    });
  }, [getPantryOverlap, apiRecipes, pantry]);

  const favoriteRecipes = useMemo(() => {
    if (activeTab === 'favorites' && dbFavoriteRecipes.length > 0) {
      return dbFavoriteRecipes.map(recipe => {
        const overlap = getPantryOverlap(recipe);
        const total = recipe.ingredients.length;
        const haveCount = overlap.have.length;
        const maybeCount = overlap.might.length;
        const needCount = overlap.missing.length;
        const overlapRatio = total > 0 ? ((haveCount * 2) + maybeCount) / (total * 2) : 0;
        const fitScore = (haveCount * 2) + maybeCount - needCount;
        return { 
          ...recipe, 
          overlap, 
          overlapScore: overlapRatio,
          pantryHaveCount: haveCount,
          pantryMaybeCount: maybeCount,
          pantryNeedCount: needCount,
          pantryMissingIsSmall: needCount >= 2 && needCount <= 3,
          pantryFitScore: fitScore,
        };
      });
    }
    return recipesWithOverlap.filter(r => favoriteIds.includes(r.id));
  }, [recipesWithOverlap, favoriteIds, dbFavoriteRecipes, activeTab, getPantryOverlap, pantry]);

  const getFilteredRecipes = () => {
    let recipes: RecipeWithOverlap[];
    
    switch (activeTab) {
      case "new":
        recipes = recipesWithOverlap;
        break;
      case "favorites":
        recipes = favoriteRecipes;
        break;
      default:
        recipes = recipesWithOverlap;
    }

    const profileAllergies = profile?.allergies || [];
    if (profileAllergies.length > 0 && activeTab !== 'favorites') {
      recipes = recipes.filter(r => !hasAllergyConflict(r, profileAllergies));
    }

    // Apply user-selected filters
    // Note: When activeSearchQuery is set, search was done via API - skip client-side search filter
    // Only apply client-side search filter for Favorites tab (which doesn't use API search)
    if (searchQuery && !activeSearchQuery && activeTab === 'favorites') {
      recipes = recipes.filter(r => 
        r.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Skip client-side mealType filter when API is handling it (For You / Something New tabs)
    // Only apply for Favorites tab
    if (activeMealTypes.length > 0 && activeTab === 'favorites') {
      recipes = recipes.filter(r => 
        r.mealTypes.some(mt => activeMealTypes.includes(mt))
      );
    }

    // Apply client-side cuisine filter using keyword matching (API doesn't support cuisine filtering)
    recipes = filterRecipesByCuisine(recipes, activeCuisines);
    
    if (activeTab === 'for-you') {
      recipes = rankRecipes(recipes, {
        cookingComfort: profile?.cookingComfort,
        dietaryPreferences: profile?.dietaryPreferences,
        allergies: profile?.allergies,
        missingTools: profile?.missingTools,
        cuisinePreferences: activeCuisines.length > 0 ? activeCuisines : undefined,
        preferredServingSize: profile?.preferredServingSize ?? undefined,
      });
    }

    // Apply carb limit filter if user has set one
    // Uses profile values since local state may not be synced yet on initial load
    const effectiveCarbLimit = profile?.maxCarbGrams ?? carbLimitGrams;
    const effectiveIsDiabetic = profile?.isDiabetic ?? isDiabetic;
    if (effectiveIsDiabetic && effectiveCarbLimit != null && effectiveCarbLimit > 0) {
      recipes = recipes.filter(r => {
        // If recipe has no carb data (null/undefined), allow it through (do not exclude)
        if (r.carbs == null) return true;
        // Otherwise, filter by carb limit
        return r.carbs <= effectiveCarbLimit;
      });
    }

    // Serving size filter only applies for Favorites tab
    // (For You/Something New rely on API filtering)
    if (selectedServingSize > 1 && activeTab === 'favorites') {
      recipes = recipes.filter(r => {
        const minServ = r.min_servings || r.servings;
        if (selectedServingSize >= 10) return minServ <= 10;
        return minServ <= selectedServingSize;
      });
    }

    // Allergy filter only applies for Favorites tab
    // (For You/Something New rely on API filtering via profile allergies)
    if (selectedAllergies.length > 0 && activeTab === 'favorites') {
      recipes = recipes.filter(r => !hasAllergyConflict(r, selectedAllergies));
    }

    return recipes;
  };

  const filteredRecipes = getFilteredRecipes();

  const hasActiveFilters = activeMealTypes.length > 0 || activeCuisines.length > 0 || 
    selectedServingSize > 1 || kidFriendly || timeDifficulty || 
    selectedDietary.length > 0 || selectedAllergies.length > 0 || isDiabetic;

  const handleOpenPlanDialog = (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    setSelectedRecipe(recipe);
    setSelectedDay("0");
    setSelectedMealType(recipe.mealTypes[0] as MealType || "Lunch");
    setMaybeResolutions({});
    setPlanDialogOpen(true);
  };

  const syncMaybeResolutionsToPantry = () => {
    Object.entries(maybeResolutions).forEach(([itemName, decision]) => {
      const normalized = normalizeIngredientName(itemName);
      const pantryItem = pantry.find(p => 
        p.state === 'might' && (
          p.normalizedName.includes(normalized) || normalized.includes(p.normalizedName)
        )
      );
      if (!pantryItem) return;
      if (decision === "have") {
        updatePantryState(pantryItem.id, 'have');
      } else if (decision === "need") {
        updatePantryState(pantryItem.id, 'gone');
      }
    });
  };

  const handleConfirmAddToPlan = () => {
    if (!selectedRecipe) return;
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + parseInt(selectedDay));
    const dateStr = targetDate.toISOString().split('T')[0];
    
    addToPlanner({
      recipeId: selectedRecipe.id,
      dayIndex: parseInt(selectedDay),
      mealType: selectedMealType,
      servings: 1,
      date: dateStr,
    });
    syncMaybeResolutionsToPantry();
    setPlanDialogOpen(false);
    toast({
      title: "Added to meal plan!",
      description: `${selectedRecipe.title} added to ${WEEKDAYS[parseInt(selectedDay)]} ${selectedMealType}`,
    });
    setSelectedRecipe(null);
  };

  const handleShare = (e: React.MouseEvent, recipeId: string, recipeTitle: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/share/recipe/${recipeId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Share this recipe with friends and family",
    });
  };

  const toggleMealType = (type: string) => {
    setStagedMealTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleCuisine = (cuisine: string) => {
    const category = CUISINE_CATEGORIES.find(c => c.name === cuisine);
    if (category?.subCategories) {
      const isChecked = stagedCuisines.includes(cuisine);
      if (isChecked) {
        setStagedCuisines(prev => prev.filter(c => c !== cuisine && !category.subCategories!.includes(c)));
      } else {
        setStagedCuisines(prev => [...new Set([...prev, cuisine, ...category.subCategories!])]);
      }
    } else {
      const parentCategory = CUISINE_CATEGORIES.find(c => c.subCategories?.includes(cuisine));
      setStagedCuisines(prev => {
        const next = prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine];
        if (parentCategory) {
          const allSubs = parentCategory.subCategories!;
          const checkedSubs = allSubs.filter(s => next.includes(s));
          if (checkedSubs.length === 0) {
            return next.filter(c => c !== parentCategory.name);
          } else if (!next.includes(parentCategory.name)) {
            return [...next, parentCategory.name];
          }
        }
        return next;
      });
    }
  };

  const toggleExpandCuisine = (cuisine: string) => {
    setExpandedCuisines(prev =>
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
    );
  };

  // Handle search submission (Enter key) - triggers FatSecret API search
  const handleSearchSubmit = () => {
    const query = searchQuery.trim();
    if (query) {
      // User initiated a search - set active search query and trigger SEARCH request
      setActiveSearchQuery(query);
      setFeedRecipes([], false);
      setFeedPage(0);
      setFeedHasMore(true);
      loadRecipes(0, false, { searchQuery: query });
    } else {
      // Clearing search - reset to FEED mode
      setActiveSearchQuery('');
      setFeedRecipes([], false);
      setFeedPage(0);
      setFeedHasMore(true);
      loadRecipes(0, false, { searchQuery: '' });
    }
  };

  // Handle clearing the search to go back to feed mode
  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
    setFeedRecipes([], false);
    setFeedPage(0);
    setFeedHasMore(true);
    loadRecipes(0, false, { searchQuery: '' });
  };

  const incrementServingSize = () => {
    setSelectedServingSize(prev => Math.min(prev + 1, 10));
  };

  const decrementServingSize = () => {
    setSelectedServingSize(prev => Math.max(prev - 1, 1));
  };

  const toggleDietary = (diet: string) => {
    if (diet === "None") {
      setSelectedDietary(["None"]);
    } else {
      setSelectedDietary(prev => {
        const filtered = prev.filter(d => d !== "None");
        return filtered.includes(diet) ? filtered.filter(d => d !== diet) : [...filtered, diet];
      });
    }
  };

  const toggleAllergy = (allergy: string) => {
    setSelectedAllergies(prev => 
      prev.includes(allergy) ? prev.filter(a => a !== allergy) : [...prev, allergy]
    );
  };

  const clearFilters = () => {
    // Clear staged filters (what user sees in Sheet)
    setStagedMealTypes([]);
    setStagedCuisines([]);
    // Clear active filters (what's applied)
    setActiveMealTypes([]);
    setActiveCuisines([]);
    // Clear other preferences
    setSelectedServingSize(1);
    setKidFriendly(false);
    setTimeDifficulty("");
    setSelectedDietary([]);
    setSelectedAllergies([]);
  };

  const getOverlapBadge = (recipe: RecipeWithOverlap) => {
    const { pantryHaveCount, pantryMaybeCount, pantryNeedCount } = recipe;
    const total = recipe.ingredients.length;
    
    // Always show the Have/Maybe/Need summary
    return (
      <Badge 
        variant="secondary" 
        className="bg-black/60 backdrop-blur-sm text-white text-[8px] px-1.5 py-0.5 font-medium"
        data-testid={`badge-pantry-status-${recipe.id}`}
      >
        <span className="text-green-400">Have {pantryHaveCount}</span>
        <span className="mx-0.5">•</span>
        <span className="text-yellow-400">Maybe {pantryMaybeCount}</span>
        <span className="mx-0.5">•</span>
        <span className="text-red-400">Need {pantryNeedCount}</span>
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background p-4 space-y-4 border-b">
        <div className="flex items-center gap-2">
          <Sheet open={filterOpen} onOpenChange={(open) => {
            if (open) {
              setStagedMealTypes(activeMealTypes);
              setStagedCuisines(activeCuisines);
            }
            setFilterOpen(open);
          }}>
            {activeTab !== 'new' && (
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                data-testid="button-filter"
                className={`bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70 ${hasActiveFilters ? "ring-2 ring-primary" : ""}`}
              >
                <SlidersHorizontal className="w-4 h-4 text-recipal-deep-green dark:text-foreground" />
              </Button>
            </SheetTrigger>
            )}
            <SheetContent side="left" className="w-80 p-0 flex flex-col">
              <div className="flex-1 overflow-y-auto p-6">
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-between">
                    Filter Recipes
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                        Clear
                      </Button>
                    )}
                  </SheetTitle>
                </SheetHeader>
                
                <div className="py-6 space-y-4">
                {/* 1) Meal Type - default open */}
                <CollapsibleFilterSection 
                  title="Meal Type" 
                  icon={<Utensils className="w-4 h-4" />}
                  defaultOpen={true}
                  testId="meal-type"
                >
                  <div className="space-y-2">
                    {FILTER_MEAL_TYPES.map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`meal-${type}`}
                          checked={stagedMealTypes.includes(type)}
                          onCheckedChange={() => toggleMealType(type)}
                          data-testid={`checkbox-meal-${type.toLowerCase()}`}
                        />
                        <Label htmlFor={`meal-${type}`} className="text-sm cursor-pointer">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleFilterSection>

                {/* 2) Cuisine Categories - default open */}
                <CollapsibleFilterSection 
                  title="Cuisine" 
                  icon={<ChefHat className="w-4 h-4" />}
                  defaultOpen={true}
                  testId="cuisine"
                >
                  <div className="space-y-1">
                    {CUISINE_CATEGORIES.map(category => {
                      const hasSubs = !!category.subCategories && category.subCategories.length > 0;
                      const isExpanded = expandedCuisines.includes(category.name);
                      const testSlug = category.name.toLowerCase().replace(/[\s\/]+/g, '-');
                      return (
                        <div key={category.name}>
                          <div className="flex items-center gap-2 py-1">
                            <Checkbox
                              id={`cuisine-${category.name}`}
                              checked={stagedCuisines.includes(category.name)}
                              onCheckedChange={() => toggleCuisine(category.name)}
                              data-testid={`checkbox-cuisine-${testSlug}`}
                            />
                            <Label htmlFor={`cuisine-${category.name}`} className="text-sm cursor-pointer flex-1">
                              {category.name}
                            </Label>
                            {hasSubs && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-[25px] mr-[25px]"
                                onClick={() => toggleExpandCuisine(category.name)}
                                data-testid={`button-expand-cuisine-${testSlug}`}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                          {hasSubs && isExpanded && (
                            <div className="ml-6 space-y-1 pb-1">
                              {category.subCategories!.map(sub => {
                                const subSlug = sub.toLowerCase().replace(/[\s\/]+/g, '-');
                                return (
                                  <div key={sub} className="flex items-center gap-2 py-1">
                                    <Checkbox
                                      id={`cuisine-${sub}`}
                                      checked={stagedCuisines.includes(sub)}
                                      onCheckedChange={() => toggleCuisine(sub)}
                                      data-testid={`checkbox-cuisine-${subSlug}`}
                                    />
                                    <Label htmlFor={`cuisine-${sub}`} className="text-xs cursor-pointer">
                                      {sub}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleFilterSection>

                {/* 3) Serving Size - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Serving Size" 
                  icon={<Users className="w-4 h-4" />}
                  testId="serving-size"
                >
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={decrementServingSize}
                      disabled={selectedServingSize <= 1}
                      data-testid="button-serving-minus"
                      className="shadow-md border-0"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="text-lg font-semibold min-w-[3rem] text-center" data-testid="text-serving-size">
                      {selectedServingSize >= 10 ? "10+" : selectedServingSize}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={incrementServingSize}
                      disabled={selectedServingSize >= 10}
                      data-testid="button-serving-plus"
                      className="shadow-md border-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </CollapsibleFilterSection>

                {/* 4) Kid Friendly - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Kid Friendly" 
                  icon={<Baby className="w-4 h-4" />}
                  testId="kid-friendly"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kid-friendly" className="text-sm font-medium">Kid Friendly</Label>
                    <Switch 
                      id="kid-friendly"
                      checked={kidFriendly}
                      onCheckedChange={setKidFriendly}
                      data-testid="switch-kid-friendly"
                    />
                  </div>
                </CollapsibleFilterSection>

                {/* 5) Time / Difficulty - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Time / Difficulty" 
                  icon={<Timer className="w-4 h-4" />}
                  testId="time-difficulty"
                >
                  <RadioGroup value={timeDifficulty} onValueChange={setTimeDifficulty}>
                    {TIME_DIFFICULTY_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.value} id={`time-${opt.value}`} data-testid={`radio-time-${opt.value}`} />
                        <Label htmlFor={`time-${opt.value}`} className="text-sm cursor-pointer">
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CollapsibleFilterSection>

                {/* 7) Dietary Restrictions / Preferences - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Dietary Restrictions" 
                  icon={<Utensils className="w-4 h-4" />}
                  testId="dietary"
                >
                  <div className="space-y-2">
                    {DIETARY_RESTRICTIONS.map(diet => (
                      <div key={diet} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`diet-${diet}`}
                          checked={selectedDietary.includes(diet)}
                          onCheckedChange={() => toggleDietary(diet)}
                          data-testid={`checkbox-diet-${diet.toLowerCase()}`}
                        />
                        <Label htmlFor={`diet-${diet}`} className="text-sm cursor-pointer">
                          {diet}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleFilterSection>

                {/* 8) Allergies - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Allergies" 
                  icon={<AlertTriangle className="w-4 h-4" />}
                  testId="allergies"
                >
                  <div className="space-y-2">
                    {ALLERGIES.map(allergy => (
                      <div key={allergy} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`allergy-${allergy}`}
                          checked={selectedAllergies.includes(allergy)}
                          onCheckedChange={() => toggleAllergy(allergy)}
                          data-testid={`checkbox-allergy-${allergy.toLowerCase()}`}
                        />
                        <Label htmlFor={`allergy-${allergy}`} className="text-sm cursor-pointer">
                          {allergy}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleFilterSection>

                {/* 9) Carb Limit - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Carb Limit" 
                  icon={<Gauge className="w-4 h-4" />}
                  testId="carb-limit"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="diabetic-toggle" className="text-sm font-medium">Set carb limit</Label>
                      <Switch 
                        id="diabetic-toggle"
                        checked={isDiabetic}
                        onCheckedChange={(checked) => {
                          setIsDiabetic(checked);
                          if (checked && carbLimitGrams === null) {
                            setCarbLimitGrams(60);
                          }
                          if (!checked) {
                            setCarbLimitGrams(null);
                          }
                        }}
                        data-testid="switch-diabetic"
                      />
                    </div>
                    {isDiabetic && (
                      <div className="space-y-2">
                        <Label htmlFor="carb-limit-input" className="text-sm">Carb limit (grams)</Label>
                        <input
                          id="carb-limit-input"
                          type="number"
                          min={0}
                          max={999}
                          step={1}
                          value={carbLimitGrams ?? 60}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val >= 0 && val <= 999) {
                              setCarbLimitGrams(val);
                            }
                          }}
                          className="w-24 h-10 px-3 border rounded-md bg-background text-foreground text-center"
                          data-testid="input-carb-limit"
                        />
                        <p className="text-xs text-muted-foreground">
                          This feature is for personal preference tracking and does not provide medical advice.
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleFilterSection>
                
                </div>
              </div>
                
              {/* Fixed bottom Save Button - applies all filters and closes sheet */}
              <div className="shrink-0 p-4 bg-background border-t">
                <Button 
                  onClick={handleSaveFilters}
                  className="w-full"
                  data-testid="button-save-preferences"
                >
                  Apply Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit();
                }
              }}
              className={activeSearchQuery ? "pl-10 pr-10" : "pl-10"}
              data-testid="input-search"
            />
            {activeSearchQuery && (
              <Button
                onClick={handleClearSearch}
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                data-testid="button-clear-search"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} className="w-full">
          <TabsList 
            className="relative w-full grid grid-cols-3 p-0 h-auto rounded-[9999px] border border-white/50 dark:border-white/20"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.40) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: `
                0 12px 32px rgba(0,0,0,0.10),
                0 4px 12px rgba(0,0,0,0.06),
                inset 0 2px 3px rgba(255,255,255,0.9),
                inset 0 -1px 2px rgba(0,0,0,0.05),
                inset 2px 0 4px rgba(255,255,255,0.4)
              `,
            }}
          >
            {/* Top-left radial highlight overlay */}
            <div 
              className="absolute inset-0 rounded-[9999px] pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 60% 80% at 15% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)',
              }}
            />
            {/* Sliding green indicator - matches Add to Cart button style */}
            <div 
              className="absolute top-0 bottom-0 left-0 pointer-events-none rounded-[9999px] transition-transform duration-300 ease-out overflow-hidden"
              style={{
                width: 'calc(100% / 3)',
                transform: `translateX(${activeTab === 'for-you' ? '0%' : activeTab === 'new' ? '100%' : '200%'})`,
                borderTop: '1px solid rgba(255,255,255,0.35)',
                background: `
                  linear-gradient(180deg,
                    rgb(34, 197, 94) 0%,
                    rgb(22, 163, 74) 100%)
                `,
                boxShadow: `
                  inset 0 1px 1px rgba(255,255,255,0.4),
                  0 1px 2px rgba(0,0,0,0.2),
                  0 2px 6px rgba(0,0,0,0.12)
                `,
              }}
            >
              {/* Top highlight band */}
              <div 
                className="absolute pointer-events-none rounded-[9999px]"
                style={{
                  inset: '1.5% 4% auto 4%',
                  height: '34%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 100%)',
                  filter: 'blur(0.5px)',
                }}
              />
            </div>
            <TabsTrigger 
              value="for-you" 
              data-testid="tab-for-you"
              className="relative z-10 rounded-[9999px] text-sm font-medium py-2 px-3 transition-all duration-200 bg-transparent data-[state=inactive]:text-gray-600/80 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-white/20 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-none"
              style={{ textShadow: activeTab === 'for-you' ? '0 1px 4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)' : 'none' }}
              onClick={() => handleTabClick('for-you')}
            >
              For You
            </TabsTrigger>
            <TabsTrigger 
              value="new" 
              data-testid="tab-new"
              className="relative z-10 rounded-[9999px] text-sm font-medium py-2 px-3 transition-all duration-200 bg-transparent data-[state=inactive]:text-gray-600/80 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-white/20 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-none"
              style={{ textShadow: activeTab === 'new' ? '0 1px 4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)' : 'none' }}
              onClick={() => handleTabClick('new')}
            >
              Something New
            </TabsTrigger>
            <TabsTrigger 
              value="favorites" 
              data-testid="tab-favorites"
              className="relative z-10 rounded-[9999px] text-sm font-medium py-2 px-3 transition-all duration-200 bg-transparent data-[state=inactive]:text-gray-600/80 data-[state=inactive]:hover:text-gray-700 data-[state=inactive]:hover:bg-white/20 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-none"
              style={{ textShadow: activeTab === 'favorites' ? '0 1px 4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)' : 'none' }}
              onClick={() => handleTabClick('favorites')}
            >
              My Meals
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-4" ref={scrollContainerRef} data-testid="recipes-scroll-container">
        {feedLoading && apiRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Loading recipes...</p>
          </div>
        ) : feedError && apiRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertTriangle className="w-8 h-8 text-destructive mb-4" />
            <p className="text-sm text-destructive">{feedError}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => loadRecipes(0, false)}
            >
              Retry
            </Button>
          </div>
        ) : activeTab === "favorites" ? (
          <div className="space-y-4">
            <div 
              className="relative w-full grid grid-cols-2 p-0 h-auto rounded-[9999px] border border-white/50 dark:border-white/20"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.40) 100%)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: `
                  0 12px 32px rgba(0,0,0,0.10),
                  0 4px 12px rgba(0,0,0,0.06),
                  inset 0 2px 3px rgba(255,255,255,0.9),
                  inset 0 -1px 2px rgba(0,0,0,0.05),
                  inset 2px 0 4px rgba(255,255,255,0.4)
                `,
              }}
            >
              <div 
                className="absolute inset-0 rounded-[9999px] pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 60% 80% at 15% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)',
                }}
              />
              <div 
                className="absolute top-0 bottom-0 left-0 pointer-events-none rounded-[9999px] transition-transform duration-300 ease-out overflow-hidden"
                style={{
                  width: 'calc(100% / 2)',
                  transform: `translateX(${myMealsSubTab === 'favorites' ? '0%' : '100%'})`,
                  borderTop: '1px solid rgba(255,255,255,0.35)',
                  background: `
                    linear-gradient(180deg,
                      rgb(249, 115, 22) 0%,
                      rgb(234, 88, 12) 100%)
                  `,
                  boxShadow: `
                    inset 0 1px 1px rgba(255,255,255,0.4),
                    0 1px 2px rgba(0,0,0,0.2),
                    0 2px 6px rgba(0,0,0,0.12)
                  `,
                }}
              >
                <div 
                  className="absolute pointer-events-none rounded-[9999px]"
                  style={{
                    inset: '1.5% 4% auto 4%',
                    height: '34%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 100%)',
                    filter: 'blur(0.5px)',
                  }}
                />
              </div>
              <button
                onClick={() => setMyMealsSubTab("favorites")}
                className={`relative z-10 rounded-[9999px] text-xs font-medium py-2 px-3 flex items-center justify-center gap-1 transition-all duration-200 ${
                  myMealsSubTab === "favorites"
                    ? "text-white font-semibold"
                    : "text-gray-600/80 hover:text-gray-700 hover:bg-white/20"
                }`}
                style={myMealsSubTab === "favorites" ? { textShadow: '0 1px 4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)' } : {}}
                data-testid="button-subtab-favorites"
              >
                <Heart className="w-3 h-3" /> Favorites {favoriteIds.length > 0 && `(${favoriteIds.length})`}
              </button>
              <button
                onClick={() => setMyMealsSubTab("my-recipes")}
                className={`relative z-10 rounded-[9999px] text-xs font-medium py-2 px-3 flex items-center justify-center gap-1 transition-all duration-200 ${
                  myMealsSubTab === "my-recipes"
                    ? "text-white font-semibold"
                    : "text-gray-600/80 hover:text-gray-700 hover:bg-white/20"
                }`}
                style={myMealsSubTab === "my-recipes" ? { textShadow: '0 1px 4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)' } : {}}
                data-testid="button-subtab-my-recipes"
              >
                <BookOpen className="w-3 h-3" /> My Recipes {customRecipesList.length > 0 && `(${customRecipesList.length})`}
              </button>
            </div>

            {myMealsSubTab === "favorites" ? (
              favoriteIds.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <Heart className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No favorites yet</p>
                  <p className="text-xs mt-1">Tap the heart on any recipe to save it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 items-stretch">
                  {filteredRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      onCardClick={navigateToRecipe}
                      onToggleFavorite={handleToggleFavorite}
                      onShare={handleShare}
                      isFavorite={favoriteIds.includes(recipe.id)}
                      overlapBadge={getOverlapBadge(recipe)}
                    />
                  ))}
                </div>
              )
            ) : (
              <>
              <div className="mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => { setEditingRecipe(null); setManualEntryOpen(true); }}
                  data-testid="button-create-custom-recipe"
                >
                  <Plus className="w-3 h-3 mr-1" /> Build a New Meal
                </Button>
              </div>
              {customRecipesLoading ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : customRecipesList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No custom recipes yet</p>
                  <p className="text-xs mt-1">Tap "Build a New Meal" above to create one</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 items-stretch">
                  {[...customRecipesList]
                    .sort((a, b) => {
                      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                      return dateB - dateA;
                    })
                    .map((cr) => {
                      const feedRecipe = mapCustomRecipeToFeedRecipe(cr);
                      const enriched = {
                        ...feedRecipe,
                        ...enrichWithOverlap(feedRecipe, getPantryOverlap),
                      };
                      return (
                        <RecipeCard
                          key={cr.id}
                          recipe={enriched}
                          onCardClick={(id) => {
                            const { setRecipe } = useRecipeStore.getState();
                            setRecipe(feedRecipe);
                            navigateToRecipe(id);
                          }}
                          onToggleFavorite={handleToggleFavorite}
                          onShare={handleShare}
                          isFavorite={favoriteIds.includes(feedRecipe.id)}
                          overlapBadge={getOverlapBadge(enriched)}
                          showEditDelete
                          onEdit={() => {
                            setEditingRecipe({
                              id: cr.id,
                              name: cr.name,
                              ingredients: cr.ingredients as any[],
                            });
                            setManualEntryOpen(true);
                          }}
                          onDelete={() => deleteCustomRecipeMutation.mutate(cr.id)}
                        />
                      );
                    })}
                </div>
              )}
            </>
            )}

            <ManualEntrySheet 
              open={manualEntryOpen} 
              onOpenChange={(val) => { setManualEntryOpen(val); if (!val) setEditingRecipe(null); }} 
              editingRecipe={editingRecipe}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 items-stretch">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onCardClick={navigateToRecipe}
                onToggleFavorite={handleToggleFavorite}
                onShare={handleShare}
                isFavorite={favoriteIds.includes(recipe.id)}
                overlapBadge={getOverlapBadge(recipe)}
              />
            ))}
            
            {/* Sentinel for infinite scroll */}
            {(activeTab === 'for-you' || activeTab === 'new') && (
              <div 
                ref={sentinelRef} 
                className="col-span-2 h-4" 
                data-testid="infinite-scroll-sentinel"
              />
            )}
          </div>
        )}
        
        {/* Loading indicator for infinite scroll */}
        {(activeTab === 'for-you' && forYouFeed.isLoadingMore) || 
         (activeTab === 'new' && somethingNewFeed.isLoadingMore) ? (
          <div className="flex justify-center items-center gap-2 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading more...</span>
          </div>
        ) : null}
        
        {feedLoading && apiRecipes.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        
        {!feedHasMore && apiRecipes.length > 0 && activeTab !== 'favorites' && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No more recipes
          </div>
        )}
      </div>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Meal Plan</DialogTitle>
            <DialogDescription>
              {selectedRecipe && `Choose when you'd like to have ${selectedRecipe.title}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Maybe Items Resolution */}
            {selectedRecipe && (() => {
              const overlap = getPantryOverlap(selectedRecipe);
              if (overlap.might.length === 0) return null;
              return (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Uncertain Items</label>
                  <div className="space-y-1.5">
                    {overlap.might.map((item) => (
                      <div key={item} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-800/30" data-testid={`maybe-item-plan-${item}`}>
                        <span className="text-sm truncate flex-1 min-w-0 mr-2">{item}</span>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button
                            size="sm"
                            className={`h-6 px-2 text-[10px] font-medium text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 ${
                              maybeResolutions[item] === "have"
                                ? "bg-green-600 hover:bg-green-600/90 ring-2 ring-green-400"
                                : maybeResolutions[item] === "need"
                                  ? "bg-gray-400 opacity-40"
                                  : "bg-green-600 hover:bg-green-600/90"
                            }`}
                            onClick={() => setMaybeResolutions(prev => ({ ...prev, [item]: "have" }))}
                            data-testid={`button-have-it-plan-${item}`}
                          >
                            Have It
                          </Button>
                          <Button
                            size="sm"
                            className={`h-6 px-2 text-[10px] font-medium text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 ${
                              maybeResolutions[item] === "need"
                                ? "bg-red-600 hover:bg-red-600/90 ring-2 ring-red-400"
                                : maybeResolutions[item] === "have"
                                  ? "bg-gray-400 opacity-40"
                                  : "bg-red-600 hover:bg-red-600/90"
                            }`}
                            onClick={() => setMaybeResolutions(prev => ({ ...prev, [item]: "need" }))}
                            data-testid={`button-need-it-plan-${item}`}
                          >
                            Need It
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="text-sm font-medium">Day</label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger data-testid="select-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Meal</label>
              <Select value={selectedMealType} onValueChange={(v) => setSelectedMealType(v as MealType)}>
                <SelectTrigger data-testid="select-meal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmAddToPlan} data-testid="button-confirm-plan">
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
