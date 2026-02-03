import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, Heart, Clock, Users, Plus, Share2, ChefHat, Sparkles, Baby, DollarSign, Timer, Minus, ShoppingCart, Utensils, AlertTriangle, Loader2, X, Gauge } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CollapsibleFilterSection } from "@/components/collapsible-filter-section";
import { mockRecipes, Recipe } from "@/lib/mock-data";
import { useDemoStore, FoodGroup, MealType } from "@/lib/demo-store";
import { useRecipeStore, fetchRecipes, fetchUntil20, FetchRecipesOptions } from "@/lib/recipe-store";
import { getFilterQuery } from "@/lib/filter-mapping";
import { filterRecipesByCuisine, rankRecipes } from "@/lib/recipe-filters";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const RECIPES_NAV_STATE_KEY = "recipesNavState";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

/*
 * FILTER OPTIONS SPEC:
 * These filters reflect how people actually choose meals (meal type, time, cost, kid-friendly)
 * and must map to onboarding personalization inputs.
 */

const FILTER_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks"];

const CUISINE_CATEGORIES = [
  "American",
  "Italian", 
  "Mexican",
  "Asian",
  "Mediterranean",
  "Indian",
  "Middle Eastern",
  "Caribbean",
  "Southern / Comfort Food",
  "BBQ / Grill",
  "Healthy / Light",
  "Breakfast / Brunch",
  "Desserts / Baking"
];

const TIME_DIFFICULTY_OPTIONS = [
  { value: "quick", label: "Quick & easy" },
  { value: "comfortable", label: "Comfortable following recipes" },
  { value: "involved", label: "I enjoy more involved cooking" },
];

const COST_PREFERENCE_OPTIONS = [
  { value: "low", label: "Keeping costs low" },
  { value: "balanced", label: "A balance of cost and quality" },
  { value: "flexible", label: "I'm flexible" },
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
  // Pantry fit score for ranking: (have*2) + maybe - need
  pantryFitScore: number;
}

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("for-you");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const { mutate: updateProfile, isPending: isSavingPreferences } = useUpdateProfile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Valid tab keys for restoration
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
  
  // ACTIVE filter state - what's actually used for filtering (applied on "Apply Filters")
  const [activeMealTypes, setActiveMealTypes] = useState<string[]>([]);
  const [activeCuisines, setActiveCuisines] = useState<string[]>([]);
  
  // User preferences state - PERSISTED to profile (affect For You)
  const [selectedServingSize, setSelectedServingSize] = useState<number>(1);
  const [kidFriendly, setKidFriendly] = useState(false);
  const [timeDifficulty, setTimeDifficulty] = useState<string>("");
  const [costPreference, setCostPreference] = useState<string>("");
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [isDiabetic, setIsDiabetic] = useState(false);
  const [carbLimitGrams, setCarbLimitGrams] = useState<number | null>(null);
  
  // Track "saved" values from profile to detect dirty state
  const [savedPreferences, setSavedPreferences] = useState<{
    timeDifficulty: string;
    costPreference: string;
    kidFriendly: boolean;
    servingSize: number;
    dietary: string[];
    allergies: string[];
    isDiabetic: boolean;
    carbLimitGrams: number | null;
  } | null>(null);
  
  // Track if initialization has run to prevent overwriting user changes
  const hasInitializedFromProfile = useRef(false);
  
  // Initialize preferences from profile when available (only once)
  useEffect(() => {
    if (profile && !hasInitializedFromProfile.current) {
      hasInitializedFromProfile.current = true;
      const prefs = {
        timeDifficulty: profile.cookingComfort || "",
        costPreference: profile.costPreference || "",
        kidFriendly: false, // Not in profile schema yet
        servingSize: 1, // Not in profile schema yet
        dietary: profile.dietaryPreferences || [],
        allergies: profile.allergies || [],
        isDiabetic: profile.isDiabetic || false,
        carbLimitGrams: profile.maxCarbPercent ?? null, // maxCarbPercent stores grams
      };
      setSavedPreferences(prefs);
      setTimeDifficulty(prefs.timeDifficulty);
      setCostPreference(prefs.costPreference);
      setKidFriendly(prefs.kidFriendly);
      setSelectedServingSize(prefs.servingSize);
      setSelectedDietary(prefs.dietary);
      setSelectedAllergies(prefs.allergies);
      setIsDiabetic(prefs.isDiabetic);
      setCarbLimitGrams(prefs.carbLimitGrams);
    }
  }, [profile]);
  
  // Compute dirty state by comparing current values to saved values
  const preferencesAreDirty = useMemo(() => {
    if (!savedPreferences) return false;
    
    const timeDiffDirty = timeDifficulty !== savedPreferences.timeDifficulty;
    const costDirty = costPreference !== savedPreferences.costPreference;
    const kidDirty = kidFriendly !== savedPreferences.kidFriendly;
    const servingDirty = selectedServingSize !== savedPreferences.servingSize;
    const diabeticDirty = isDiabetic !== savedPreferences.isDiabetic;
    const carbLimitDirty = carbLimitGrams !== savedPreferences.carbLimitGrams;
    
    // Compare arrays (sorted for order-independent comparison)
    const dietaryDirty = JSON.stringify([...selectedDietary].sort()) !== JSON.stringify([...savedPreferences.dietary].sort());
    const allergiesDirty = JSON.stringify([...selectedAllergies].sort()) !== JSON.stringify([...savedPreferences.allergies].sort());
    
    return timeDiffDirty || costDirty || kidDirty || servingDirty || dietaryDirty || allergiesDirty || diabeticDirty || carbLimitDirty;
  }, [savedPreferences, timeDifficulty, costPreference, kidFriendly, selectedServingSize, selectedDietary, selectedAllergies, isDiabetic, carbLimitGrams]);
  
  // Active search state (when user manually searches via Enter key)
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>("");
  
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedDay, setSelectedDay] = useState("0");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");

  const { getPantryOverlap, addToPlanner, pantry } = useDemoStore();
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
    options: { seedOffset?: number; filter?: string; searchQuery?: string; varietyIndex?: number } = {}
  ) => {
    if (feedLoading) return;
    
    setFeedLoading(true);
    setFeedError(null);
    
    try {
      const filterQuery = getFilterQuery(activeMealTypes, activeCuisines);
      
      // Get selected meal type for hard filter (use first selected, or undefined)
      const mealTypeFilter = activeMealTypes.length > 0 ? activeMealTypes[0] : undefined;
      
      // Use filter panel timeDifficulty, or fall back to profile cookingComfort
      const effectiveTimeDifficulty = timeDifficulty || profile?.cookingComfort;
      
      // Get diabetic preferences from profile
      const isDiabetic = profile?.isDiabetic || false;
      const maxCarbPercent = profile?.maxCarbPercent ?? undefined;
      
      // Use explicit searchQuery from options if provided (user-initiated search)
      const queryToUse = options.searchQuery ?? activeSearchQuery;
      const isUserSearch = queryToUse && queryToUse.trim() !== '';
      
      // Determine the seedOffset for this feed
      const seedOffset = isUserSearch ? 0 : (options.seedOffset ?? (activeTab === 'new' ? 5 : 0));
      const isForYou = activeTab === 'for-you' && !isUserSearch;
      const isSomethingNew = activeTab === 'new' && !isUserSearch;
      
      // For initial load (page 0, not append), use fetchUntil20 for guaranteed 20 cards
      if (page === 0 && !append && !isUserSearch) {
        // Check if we already have cached results for this feed
        const cachedFeed = isForYou ? forYouFeed : (isSomethingNew ? somethingNewFeed : null);
        if (cachedFeed && cachedFeed.recipes.length >= 20) {
          // Use cached results
          setFeedRecipes(cachedFeed.recipes, false);
          setRecipes(cachedFeed.recipes);
          setFeedPage(0);
          setFeedHasMore(cachedFeed.hasMore);
          setFeedLoading(false);
          return;
        }
        
        // Get varietyIndex from options or current feed state
        const currentFeed = isForYou ? forYouFeed : somethingNewFeed;
        const effectiveVarietyIndex = options.varietyIndex ?? currentFeed?.varietyIndex ?? 0;
        
        // Get selected cuisine for filter (use first selected, or undefined)
        const cuisineFilter = activeCuisines.length > 0 ? activeCuisines[0] : undefined;
        
        const result = await fetchUntil20({
          query: queryToUse || '',
          requestType: 'FEED',
          seedOffset,
          filter: options.filter || filterQuery,
          mealType: mealTypeFilter,
          timeDifficulty: effectiveTimeDifficulty,
          isDiabetic,
          maxCarbPercent,
          cuisine: cuisineFilter,
          varietyIndex: effectiveVarietyIndex,
          feedType: isForYou ? 'forYou' : 'somethingNew',
          pageStart: 0,
          targetCount: 20,
          maxPages: 5,
        });
        
        // Store in the appropriate feed cache
        if (isForYou) {
          setForYouFeed({
            recipes: result.recipes,
            nextPage: result.nextPage,
            hasMore: result.hasMore,
          });
        } else if (isSomethingNew) {
          setSomethingNewFeed({
            recipes: result.recipes,
            nextPage: result.nextPage,
            hasMore: result.hasMore,
          });
        }
        
        setFeedRecipes(result.recipes, false);
        setRecipes(result.recipes);
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
          filter: isUserSearch ? '' : (options.filter || filterQuery),
          mealType: isUserSearch ? undefined : mealTypeFilter,
          timeDifficulty: effectiveTimeDifficulty,
          isDiabetic,
          maxCarbPercent,
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
  }, [feedLoading, setFeedLoading, setFeedError, setFeedHasMore, setFeedRecipes, setRecipes, setFeedPage, activeMealTypes, activeCuisines, activeSearchQuery, activeTab, timeDifficulty, profile, forYouFeed, somethingNewFeed, setForYouFeed, setSomethingNewFeed]);

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
      const filterQuery = getFilterQuery(activeMealTypes, activeCuisines);
      const mealTypeFilter = activeMealTypes.length > 0 ? activeMealTypes[0] : undefined;
      const cuisineFilter = activeCuisines.length > 0 ? activeCuisines[0] : undefined;
      const effectiveTimeDifficulty = timeDifficulty || profile?.cookingComfort;
      const isDiabetic = profile?.isDiabetic || false;
      const maxCarbPercent = profile?.maxCarbPercent ?? undefined;
      const seedOffset = isSomethingNew ? 5 : 0;
      
      const result = await fetchUntil20({
        query: '',
        requestType: 'FEED',
        seedOffset,
        filter: filterQuery,
        mealType: mealTypeFilter,
        timeDifficulty: effectiveTimeDifficulty,
        isDiabetic,
        maxCarbPercent,
        cuisine: cuisineFilter,
        varietyIndex: currentFeed.varietyIndex ?? 0,
        feedType: isForYou ? 'forYou' : 'somethingNew',
        pageStart: currentFeed.nextPage,
        targetCount: 20,
        maxPages: 5,
      });
      
      // Dedupe against existing feed recipes
      const existingIds = new Set(currentFeed.recipes.map(r => r.id));
      const uniqueNewRecipes = result.recipes.filter(r => !existingIds.has(r.id));
      
      // If no new recipes after deduping, API might be exhausted
      const noNewRecipes = uniqueNewRecipes.length === 0;
      
      // Combine with existing
      const combinedRecipes = [...currentFeed.recipes, ...uniqueNewRecipes];
      
      // Update the appropriate feed
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
      
      // Also update the display feed
      setFeedRecipes(combinedRecipes, false);
      setRecipes(combinedRecipes);
      setFeedHasMore(result.hasMore && !noNewRecipes);
    } catch (err) {
      console.error('[Recipes] Failed to load more:', err);
      // Reset loading state on error
      if (isForYou) {
        setForYouFeed({ isLoadingMore: false });
      } else {
        setSomethingNewFeed({ isLoadingMore: false });
      }
    }
  }, [activeTab, forYouFeed, somethingNewFeed, setForYouFeed, setSomethingNewFeed, setFeedRecipes, setRecipes, setFeedHasMore, activeMealTypes, activeCuisines, timeDifficulty, profile]);

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
      // Normal tab switch
      setActiveTab(tabValue);
    }
  }, [activeTab, refreshFeed]);

  // Handle applying all filters and saving preferences
  const handleSaveFilters = useCallback(() => {
    if (isSavingPreferences) return;
    
    // Close the filter sheet first so user sees the filtered results
    setFilterOpen(false);
    
    // Copy staged filters → active filters
    // This triggers the useEffect that will reload recipes with new filters
    setActiveMealTypes(stagedMealTypes);
    setActiveCuisines(stagedCuisines);
    
    // Show confirmation toast
    toast({
      title: "Filters applied",
      description: "Your recipe filters have been updated.",
      duration: 2000,
    });
    
    // If preferences have changed, also save them to the profile
    if (preferencesAreDirty) {
      const updatedPrefs = {
        cookingComfort: timeDifficulty as "quick" | "comfortable" | "involved",
        costPreference: costPreference as "low" | "balanced" | "flexible",
        dietaryPreferences: selectedDietary,
        allergies: selectedAllergies,
        isDiabetic,
        maxCarbPercent: isDiabetic ? carbLimitGrams : null, // maxCarbPercent stores grams
      };
      
      updateProfile(updatedPrefs, {
        onSuccess: () => {
          // Update saved preferences to match current values
          setSavedPreferences({
            timeDifficulty,
            costPreference,
            kidFriendly,
            servingSize: selectedServingSize,
            dietary: selectedDietary,
            allergies: selectedAllergies,
            isDiabetic,
            carbLimitGrams: isDiabetic ? carbLimitGrams : null,
          });
          
          // Refresh For You feed ONLY (not Something New)
          // Clear For You cache and reload
          setForYouFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
          
          // If currently on For You tab, trigger reload
          if (activeTab === 'for-you') {
            setFeedRecipes([], false);
            setFeedPage(0);
            setFeedHasMore(true);
            loadRecipes(0, false, { seedOffset: 0, searchQuery: '' });
          }
        },
        onError: (err) => {
          toast({
            title: "Error saving preferences",
            description: err.message,
            variant: "destructive",
          });
        },
      });
    }
  }, [
    isSavingPreferences, preferencesAreDirty, timeDifficulty, costPreference, 
    kidFriendly, selectedServingSize, selectedDietary, selectedAllergies,
    isDiabetic, carbLimitGrams, stagedMealTypes, stagedCuisines,
    updateProfile, toast, setForYouFeed, activeTab, setFeedRecipes, setFeedPage, 
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
      // Clear search state when switching tabs to go back to FEED mode
      setSearchQuery('');
      setActiveSearchQuery('');
      setFeedRecipes([], false);
      setFeedPage(0);
      setFeedHasMore(true);
      
      // Reset the relevant feed state for fresh fetch
      if (activeTab === 'for-you') {
        setForYouFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
      } else if (activeTab === 'new') {
        setSomethingNewFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
      }
      
      loadRecipes(0, false, { seedOffset: activeTab === 'new' ? 5 : 0, searchQuery: '' });
    }
    prevTab.current = activeTab;
  }, [activeTab, loadRecipes, setForYouFeed, setSomethingNewFeed]);

  // Reload feed when meal type filter changes
  const prevMealTypes = useRef<string[]>([]);
  useEffect(() => {
    // Only trigger if mealTypes actually changed and not on initial mount
    const mealTypesChanged = JSON.stringify(prevMealTypes.current) !== JSON.stringify(activeMealTypes);
    if (mealTypesChanged && prevMealTypes.current.length > 0 || (activeMealTypes.length > 0 && prevMealTypes.current.length === 0)) {
      if (activeTab !== 'favorites') {
        // When filter changes, clear any active search to go back to FEED mode
        setSearchQuery('');
        setActiveSearchQuery('');
        setFeedRecipes([], false);
        setFeedPage(0);
        setFeedHasMore(true);
        
        // Reset the relevant feed state for fresh fetch with new filters
        if (activeTab === 'for-you') {
          setForYouFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
        } else if (activeTab === 'new') {
          setSomethingNewFeed({ recipes: [], nextPage: 0, hasMore: true, isLoadingMore: false });
        }
        
        loadRecipes(0, false, { seedOffset: activeTab === 'new' ? 5 : 0, searchQuery: '' });
      }
    }
    prevMealTypes.current = activeMealTypes;
  }, [activeMealTypes, activeTab, loadRecipes, setForYouFeed, setSomethingNewFeed]);

  // NOTE: timeDifficulty changes no longer auto-reload the feed
  // Preference changes only take effect when the Save button is pressed
  // This prevents "auto-save" behavior per prompt 2J requirements

  // Get user's profile preferences for ranking
  const userDietaryPreferences = profile?.dietaryPreferences || [];
  const userAllergies = profile?.allergies || [];
  const userCookingComfort = profile?.cookingComfort || "comfortable";
  const userCostPreference = profile?.costPreference || "balanced";

  const recipesWithOverlap: RecipeWithOverlap[] = useMemo(() => {
    const recipesToUse = apiRecipes.length > 0 ? apiRecipes : mockRecipes;
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

  // Check if recipe violates allergies (hard exclusion)
  const hasAllergyConflict = (recipe: Recipe, allergies: string[]) => {
    if (allergies.length === 0) return false;
    const ingredientNames = recipe.ingredients.map(i => i.name.toLowerCase());
    return allergies.some(allergy => {
      const allergyLower = allergy.toLowerCase();
      return ingredientNames.some(ing => ing.includes(allergyLower));
    });
  };

  // Check if recipe matches dietary preferences
  const matchesDietary = (recipe: Recipe, dietary: string[]) => {
    if (dietary.length === 0 || dietary.includes("None")) return true;
    // For now, basic matching based on cooking style / tags
    // In production, this would check recipe tags or categorization
    return true;
  };

  // For You feed with deterministic ranking
  const forYouRecipes = useMemo(() => {
    // Step 1: Filter out allergy conflicts (hard exclusion)
    const safeRecipes = recipesWithOverlap.filter(
      r => !hasAllergyConflict(r, userAllergies)
    );

    // Cost scoring: maps cuisine categories to estimated cost tier (1=low, 2=balanced, 3=premium)
    const getCostTier = (cuisine: string): number => {
      const costMap: Record<string, number> = {
        "American": 1,
        "Mexican": 1,
        "Southern / Comfort Food": 1,
        "Breakfast / Brunch": 1,
        "Desserts / Baking": 1,
        "Italian": 2,
        "Asian": 2,
        "Indian": 2,
        "Caribbean": 2,
        "BBQ / Grill": 2,
        "Healthy / Light": 2,
        "Mediterranean": 3,
        "Middle Eastern": 3,
      };
      return costMap[cuisine] || 2;
    };

    // Get preferred cost tier based on user preference
    const getPreferredCostTier = (pref: string): number => {
      switch (pref) {
        case "low": return 1;
        case "balanced": return 2;
        case "flexible": return 3;
        default: return 2;
      }
    };

    const preferredCostTier = getPreferredCostTier(userCostPreference);

    // Comfort map for cuisine preference matching based on cooking complexity
    const comfortMap: Record<string, string[]> = {
      quick: ["American", "Mexican", "Breakfast / Brunch", "Healthy / Light"],
      comfortable: ["Italian", "Asian", "Mediterranean", "Indian"],
      involved: ["BBQ / Grill", "Southern / Comfort Food", "Middle Eastern", "Caribbean", "Desserts / Baking"],
    };
    const preferredCuisines = comfortMap[userCookingComfort] || [];

    // Step 2: Create baseList (excludes recipes with 2-3 missing ingredients)
    // Deterministic ranking: pantryFitScore → comfort → cost → id
    // pantryFitScore = (have*2) + maybe - need (higher = better pantry fit)
    const baseList = safeRecipes
      .filter(r => !r.pantryMissingIsSmall)
      .sort((a, b) => {
        // Priority 1: Pantry fit score (higher is better)
        // Use significant difference threshold to group similar fits
        const fitDiff = b.pantryFitScore - a.pantryFitScore;
        if (Math.abs(fitDiff) > 2) return fitDiff > 0 ? 1 : -1;
        
        // Priority 2: Cuisine comfort match (boost matching recipes)
        const aComfortMatch = preferredCuisines.includes(a.cookingStyle) ? 1 : 0;
        const bComfortMatch = preferredCuisines.includes(b.cookingStyle) ? 1 : 0;
        if (aComfortMatch !== bComfortMatch) return bComfortMatch - aComfortMatch;

        // Priority 3: Cost preference (boost recipes closer to user's cost preference)
        const aCostTier = getCostTier(a.cookingStyle);
        const bCostTier = getCostTier(b.cookingStyle);
        const aCostDistance = Math.abs(aCostTier - preferredCostTier);
        const bCostDistance = Math.abs(bCostTier - preferredCostTier);
        if (aCostDistance !== bCostDistance) return aCostDistance - bCostDistance;

        // Priority 4: Deterministic tie-breaker using recipe id
        return a.id.localeCompare(b.id);
      });

    // Step 3: Create closeList (recipes with exactly 2-3 missing)
    const closeList = safeRecipes
      .filter(r => r.pantryMissingIsSmall)
      .sort((a, b) => a.pantryNeedCount - b.pantryNeedCount);

    // Step 4: Compose finalFeed with strict every-5th injection
    const finalFeed: (RecipeWithOverlap & { isInjected?: boolean })[] = [];
    let baseIndex = 0;
    let closeIndex = 0;
    const usedIds = new Set<string>();

    // Dev-only debug logging for top 10 recipes
    if (process.env.NODE_ENV === 'development') {
      console.log('=== For You Feed Debug ===');
      console.log('User preferences:', { 
        cookingComfort: userCookingComfort, 
        costPreference: userCostPreference,
        preferredCostTier,
      });
      console.log('Top 10 baseList recipes:', baseList.slice(0, 10).map(r => ({
        title: r.title,
        pantryFitScore: r.pantryFitScore,
        have: r.pantryHaveCount,
        maybe: r.pantryMaybeCount,
        need: r.pantryNeedCount,
        cookingStyle: r.cookingStyle,
        costTier: getCostTier(r.cookingStyle),
        costDistance: Math.abs(getCostTier(r.cookingStyle) - preferredCostTier),
      })));
      console.log('closeList recipes:', closeList.map(r => ({
        title: r.title,
        missingCount: r.pantryNeedCount,
      })));
    }

    let position = 1;
    while (baseIndex < baseList.length || closeIndex < closeList.length) {
      // Every 5th position: inject from closeList if available
      if (position % 5 === 0 && closeIndex < closeList.length) {
        const recipe = closeList[closeIndex];
        if (!usedIds.has(recipe.id)) {
          finalFeed.push({ ...recipe, isInjected: true });
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
        // If baseList is exhausted but we're not at position 5, still add from closeList
        const recipe = closeList[closeIndex];
        if (!usedIds.has(recipe.id)) {
          finalFeed.push({ ...recipe, isInjected: true });
          usedIds.add(recipe.id);
        }
        closeIndex++;
      }
      position++;
    }

    return finalFeed;
  }, [recipesWithOverlap, userAllergies, userCookingComfort, userCostPreference]);

  // Something New feed - exploratory, enforces allergies/dietary but not cooking style preferences
  const somethingNewRecipes = useMemo(() => {
    // Always enforce allergies
    const safeRecipes = recipesWithOverlap.filter(
      r => !hasAllergyConflict(r, userAllergies)
    );
    
    // Always enforce dietary restrictions from profile
    const dietaryFiltered = safeRecipes.filter(r => matchesDietary(r, userDietaryPreferences));
    
    // NOT constrained by preferred cooking styles by default (exploratory)
    // Use stable sorting based on recipe id for deterministic behavior
    return dietaryFiltered.sort((a, b) => a.id.localeCompare(b.id));
  }, [recipesWithOverlap, userAllergies, userDietaryPreferences]);

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
        recipes = somethingNewRecipes;
        break;
      case "favorites":
        recipes = favoriteRecipes;
        break;
      default:
        recipes = forYouRecipes;
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
    
    // Apply future OpenAI ranking hook (currently no-op)
    recipes = rankRecipes(recipes, {
      cookingComfort: profile?.cookingComfort,
      costPreference: profile?.costPreference,
      dietaryPreferences: profile?.dietaryPreferences,
      allergies: profile?.allergies,
    });

    // Apply carb limit filter if user has set one
    // Uses profile values since local state may not be synced yet on initial load
    const effectiveCarbLimit = profile?.maxCarbPercent ?? carbLimitGrams;
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
        if (selectedServingSize >= 10) return r.servings >= 10;
        return r.servings === selectedServingSize;
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
    selectedServingSize > 1 || kidFriendly || timeDifficulty || costPreference || 
    selectedDietary.length > 0 || selectedAllergies.length > 0 || isDiabetic;

  const handleOpenPlanDialog = (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    setSelectedRecipe(recipe);
    setSelectedDay("0");
    setSelectedMealType(recipe.mealTypes[0] as MealType || "Lunch");
    setPlanDialogOpen(true);
  };

  const handleConfirmAddToPlan = () => {
    if (!selectedRecipe) return;
    // Calculate the date for the selected day
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + parseInt(selectedDay));
    const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    addToPlanner({
      recipeId: selectedRecipe.id,
      dayIndex: parseInt(selectedDay),
      mealType: selectedMealType,
      servings: 1,
      date: dateStr,
    });
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
    setStagedCuisines(prev => 
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
    setCostPreference("");
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
              // Sync staged filters from active when opening the Sheet
              setStagedMealTypes(activeMealTypes);
              setStagedCuisines(activeCuisines);
            }
            setFilterOpen(open);
          }}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                data-testid="button-filter"
                className={hasActiveFilters ? "border-primary" : ""}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="relative h-full overflow-y-auto p-6 pb-20">
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
                  <div className="space-y-2">
                    {CUISINE_CATEGORIES.map(cuisine => (
                      <div key={cuisine} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cuisine-${cuisine}`}
                          checked={stagedCuisines.includes(cuisine)}
                          onCheckedChange={() => toggleCuisine(cuisine)}
                          data-testid={`checkbox-cuisine-${cuisine.toLowerCase().replace(/[\s\/]+/g, '-')}`}
                        />
                        <Label htmlFor={`cuisine-${cuisine}`} className="text-sm cursor-pointer">
                          {cuisine}
                        </Label>
                      </div>
                    ))}
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

                {/* 6) Cost Preference - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Cost Preference" 
                  icon={<DollarSign className="w-4 h-4" />}
                  testId="cost-preference"
                >
                  <RadioGroup value={costPreference} onValueChange={setCostPreference}>
                    {COST_PREFERENCE_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.value} id={`cost-${opt.value}`} data-testid={`radio-cost-${opt.value}`} />
                        <Label htmlFor={`cost-${opt.value}`} className="text-sm cursor-pointer">
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
                
                  {/* Spacer for floating button */}
                  <div className="h-20" />
                </div>
                
                {/* Floating Save Button - applies all filters and closes sheet */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t z-50">
                  <Button 
                    onClick={handleSaveFilters}
                    disabled={isSavingPreferences}
                    className="w-full"
                    data-testid="button-save-preferences"
                  >
                    {isSavingPreferences ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      "Apply Filters"
                    )}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes... (press Enter)"
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
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger 
              value="for-you" 
              data-testid="tab-for-you"
              className="rounded-full data-[state=active]:bg-recipal-deep-green data-[state=active]:text-white transition-all duration-300"
              onClick={() => handleTabClick('for-you')}
            >
              For You
            </TabsTrigger>
            <TabsTrigger 
              value="new" 
              data-testid="tab-new"
              className="rounded-full data-[state=active]:bg-recipal-deep-green data-[state=active]:text-white transition-all duration-300"
              onClick={() => handleTabClick('new')}
            >
              Something New
            </TabsTrigger>
            <TabsTrigger 
              value="favorites" 
              data-testid="tab-favorites"
              className="rounded-full data-[state=active]:bg-recipal-deep-green data-[state=active]:text-white transition-all duration-300"
              onClick={() => handleTabClick('favorites')}
            >
              Favorites {favoriteIds.length > 0 && `(${favoriteIds.length})`}
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
        ) : activeTab === "favorites" && favoriteIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
            <Heart className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No favorites yet</p>
            <p className="text-xs mt-1">Tap the heart on any recipe to save it here</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 items-stretch">
            {filteredRecipes.map((recipe) => (
              <Card 
                key={recipe.id} 
                className="overflow-hidden cursor-pointer relative shadow-[0_0_8px_rgba(0,0,0,0.35)] border-0 flex flex-col h-full"
                onClick={() => navigateToRecipe(recipe.id)}
                data-testid={`card-recipe-${recipe.id}`}
              >
                {(recipe as RecipeWithOverlap & { isInjected?: boolean }).isInjected && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary/80 to-primary/60 text-white text-[9px] py-0.5 px-2 z-10 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Almost Ready
                  </div>
                )}
                <div className="w-full aspect-square bg-muted relative overflow-hidden flex-shrink-0">
                  <img 
                    src={recipe.image} 
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="bg-white/80 backdrop-blur-sm h-7 w-7"
                      onClick={(e) => handleShare(e, recipe.id, recipe.title)}
                      data-testid={`button-share-${recipe.id}`}
                    >
                      <Share2 className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`bg-white/80 backdrop-blur-sm h-7 w-7 ${favoriteIds.includes(recipe.id) ? "text-red-500" : ""}`}
                      onClick={(e) => handleToggleFavorite(e, recipe)}
                      data-testid={`button-favorite-${recipe.id}`}
                    >
                      <Heart className={`w-3 h-3 ${favoriteIds.includes(recipe.id) ? "fill-current" : ""}`} />
                    </Button>
                  </div>
                  
                  <div className="absolute bottom-2 left-2">
                    {getOverlapBadge(recipe)}
                  </div>
                </div>
                <CardContent className="p-3 flex flex-col flex-1 gap-1.5">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground -mt-1 -mb-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {recipe.cookTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {recipe.servings}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2">{recipe.title}</h3>
                  
                  {/* Bottom-aligned content */}
                  <div className="mt-auto flex flex-col gap-1.5">
                    {/* Macros display */}
                    <div className="flex gap-1 justify-center">
                      <div className="bg-recipal-orange/10 border border-recipal-orange/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
                        <span className="text-[10px] font-bold text-recipal-orange leading-none">{recipe.protein}g</span>
                        <span className="text-[7px] text-muted-foreground leading-none mt-[1px]">Protein</span>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
                        <span className="text-[10px] font-bold text-primary leading-none">{recipe.carbs}g</span>
                        <span className="text-[7px] text-muted-foreground leading-none mt-[1px]">Carbs</span>
                      </div>
                      <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
                        <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 leading-none">{recipe.fat}g</span>
                        <span className="text-[7px] text-muted-foreground leading-none mt-[1px]">Fat</span>
                      </div>
                      <div className="bg-yellow-100/30 border border-yellow-500/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
                        <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 leading-none">{recipe.calories}</span>
                        <span className="text-[7px] text-black dark:text-white leading-none mt-[1px]">Calories</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-full text-[11px] gap-1 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold px-4" 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToRecipe(recipe.id);
                        }}
                        data-testid={`button-add-plan-${recipe.id}`}
                      >
                        <Plus className="w-[12px] h-[12px]" /> Add to Plan
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-full text-[11px] gap-1 bg-green-600 hover:bg-green-600/90 text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold px-4" 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToRecipe(recipe.id);
                        }}
                        data-testid={`button-add-cart-${recipe.id}`}
                      >
                        <ShoppingCart className="w-[12px] h-[12px]" /> Add to Cart
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
