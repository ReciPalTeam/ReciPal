import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, LayoutGrid, List, Flame, Lock, Unlock, Calendar, Wand2, Minus, X, Search, RefreshCw, Repeat, UtensilsCrossed, ArrowLeftRight, Loader2, Undo2 } from "lucide-react";
import { CalorieCounterCard } from "@/components/calorie-counter-card";
import { MealDetailPopup } from "@/components/meal-detail-popup";
import { SwapIngredientPopup } from "@/components/swap-ingredient-popup";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { useDemoStore, MealType, PlannedMeal, IngredientOverride } from "@/lib/demo-store";
import type { Recipe } from "@/lib/mock-data";
import { useRecipeStore, fetchRecipeById } from "@/lib/recipe-store";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements } from "@/lib/entitlements";
import { useProfile } from "@/hooks/use-profile";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  generateWeekPlan, 
  GenerationSettings, 
  PreviewMeal, 
  GeneratedWeek, 
  AutoPopulateMealType,
  UserPreferences,
  getSwapSuggestions,
  searchRecipesForMealType,
  calculateProjectedTotals,
  filterRecipes,
  applyProHardLimits
} from "@/lib/auto-populate";
import { 
  computeTotalsFromConsumptionLogs, 
  computeMealNutritionSnapshot,
  computeDayTotals,
  getPlannerSummary,
  ConsumptionLogInput,
  PlannedMealInput,
  RecipeLookup,
  MacroTotals as PlannerMacroTotals
} from "@/lib/planner-totals";

const mealSlots: MealType[] = ["Breakfast", "Lunch", "Dinner", "Desserts", "Snackitizers"];

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function PlannerPage() {
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { entitlement } = useEntitlements();
  const isPro = entitlement.isPro;
  
  const { data: profile } = useProfile();
  const macrosSet = profile?.macrosSet === true;
  
  const { planner, removeFromPlanner, acceleratePantryDecay, markMealCooked, unmarkMealCooked, getMealState, addToPlanner, addToPlannerWithReplace, pantry, favorites } = useDemoStore();

  const [showCalorieGoalModal, setShowCalorieGoalModal] = useState(false);
  const [tempCalorieGoal, setTempCalorieGoal] = useState<string>("");

  const updateCalorieGoalMutation = useMutation({
    mutationFn: async (calorieGoal: number) => {
      return apiRequest("PATCH", "/api/profile", { calorieGoal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Calorie goal saved!", description: "Your daily calorie goal has been updated." });
      setShowCalorieGoalModal(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save calorie goal. Please try again.", variant: "destructive" });
    },
  });

  const handleUpdateGoals = () => {
    if (isPro) {
      setLocation("/macro-wizard");
    } else {
      setTempCalorieGoal(profile?.calorieGoal?.toString() || "");
      setShowCalorieGoalModal(true);
    }
  };

  const handleSaveCalorieGoal = () => {
    const value = parseInt(tempCalorieGoal, 10);
    if (isNaN(value) || value <= 0) {
      toast({ title: "Invalid value", description: "Please enter a number greater than 0.", variant: "destructive" });
      return;
    }
    updateCalorieGoalMutation.mutate(value);
  };

  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
  const [previewWeek, setPreviewWeek] = useState<GeneratedWeek | null>(null);
  const [lockedMealIds, setLockedMealIds] = useState<Set<string>>(new Set());
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    addDesserts: false,
    addSnackitizers: false,
    servings: {
      Breakfast: 1,
      Lunch: 1,
      Dinner: 1,
      Desserts: 1,
      Snackitizers: 1
    }
  });
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ meal: PreviewMeal; dayIndex: number } | null>(null);
  const [swapSearchQuery, setSwapSearchQuery] = useState("");
  const [swapSource, setSwapSource] = useState<'planner' | 'preview'>('preview');
  const [swapPlannerMeal, setSwapPlannerMeal] = useState<PlannedMeal | null>(null);
  const [selectedMealForDetail, setSelectedMealForDetail] = useState<PlannedMeal | null>(null);
  const [showMealDetail, setShowMealDetail] = useState(false);
  const [showSwapFork, setShowSwapFork] = useState(false);
  const [swapForkTarget, setSwapForkTarget] = useState<{ 
    type: 'planner' | 'preview';
    plannerMeal?: PlannedMeal;
    previewMeal?: PreviewMeal;
    dayIndex?: number;
  } | null>(null);
  const [isFetchingCandidates, setIsFetchingCandidates] = useState(false);
  const cachedCandidateRecipes = useRef<Recipe[]>([]);
  const cachedRecipeLookupMap = useRef<Map<string, Recipe>>(new Map());

  const [swapPreviewRecipeId, setSwapPreviewRecipeId] = useState<string | null>(null);
  const [previewOverrides, setPreviewOverrides] = useState<IngredientOverride[]>([]);
  const [previewSwapIngredient, setPreviewSwapIngredient] = useState<string>("");
  const [previewSwapPopupOpen, setPreviewSwapPopupOpen] = useState(false);

  const SUPABASE_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack/Appetizer'] as const;
  const BATCH_SIZE = 7;
  const MAX_FETCH_ITERATIONS = 10;

  const seenRecipeIds = useRef<Record<string, Set<string>>>({
    'Breakfast': new Set(),
    'Lunch': new Set(),
    'Dinner': new Set(),
    'Dessert': new Set(),
    'Snack/Appetizer': new Set(),
  });

  const batchOffsets = useRef<Record<string, number>>({
    'Breakfast': 0,
    'Lunch': 0,
    'Dinner': 0,
    'Dessert': 0,
    'Snack/Appetizer': 0,
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekEndDate = format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekStartDate = format(weekStart, 'yyyy-MM-dd');

  const { data: consumptionLogs = [] } = useQuery<ConsumptionLogInput[]>({
    queryKey: ['/api/consumption-logs', weekStartDate, weekEndDate],
    enabled: true,
  });

  const getLogsForDay = (dayDate: string): ConsumptionLogInput[] => {
    return consumptionLogs.filter(log => log.date === dayDate);
  };

  const getMealsForDay = (dateStr: string) => {
    return planner.filter(m => m.date === dateStr);
  };

  const { recipesById: storeRecipes } = useRecipeStore();
  
  const getRecipeById = (recipeId: string): Recipe | undefined => {
    return storeRecipes[recipeId] || cachedRecipeLookupMap.current.get(recipeId);
  };

  const recipeLookup = useMemo((): RecipeLookup => {
    const lookup: RecipeLookup = {};
    cachedCandidateRecipes.current.forEach(r => {
      lookup[r.id] = r;
    });
    Object.entries(storeRecipes).forEach(([id, recipe]) => {
      lookup[id] = recipe;
    });
    return lookup;
  }, [storeRecipes]);

  const hydratingIds = useRef<Set<string>>(new Set());
  const failedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const missingIds = planner
      .map(m => m.recipeId)
      .filter(id => !storeRecipes[id] && !cachedRecipeLookupMap.current.has(id) && !hydratingIds.current.has(id) && !failedIds.current.has(id));
    const uniqueMissing = [...new Set(missingIds)];
    if (uniqueMissing.length === 0) return;
    uniqueMissing.forEach(id => hydratingIds.current.add(id));
    Promise.all(
      uniqueMissing.map(id =>
        fetchRecipeById(id)
          .then(recipe => {
            useRecipeStore.getState().setRecipe(recipe);
          })
          .catch(() => {
            failedIds.current.add(id);
          })
          .finally(() => hydratingIds.current.delete(id))
      )
    );
  }, [planner, storeRecipes]);

  const getMealNutrition = (meal: PlannedMeal): PlannerMacroTotals => {
    const recipe = recipeLookup[meal.recipeId];
    return computeMealNutritionSnapshot(meal as PlannedMealInput, recipe);
  };

  const getDayMacros = (dayIndex: number): MacroTotals => {
    const dayDate = format(days[dayIndex], 'yyyy-MM-dd');
    const meals = getMealsForDay(dayDate);
    const dayLogs = getLogsForDay(dayDate);
    
    const cookedLogRecipeIds = new Set(
      dayLogs.filter(l => l.sourceType === 'cooknow_logged_recipe' && l.recipeId).map(l => String(l.recipeId))
    );
    const cookedLogNames = new Set(
      dayLogs.filter(l => l.sourceType === 'cooknow_logged_recipe' && l.name).map(l => l.name!.toLowerCase())
    );
    
    const mealsAsInput: PlannedMealInput[] = meals
      .filter(m => {
        const state = getMealState ? getMealState(m.id) : 'scheduled';
        if (state === 'cooked' || state === 'autoCounted') {
          if (cookedLogRecipeIds.has(m.recipeId)) return false;
          const recipe = getRecipeById(m.recipeId);
          if (recipe && cookedLogNames.has(recipe.title.toLowerCase())) return false;
        }
        return true;
      })
      .map(m => ({
        ...m,
        mealState: getMealState ? getMealState(m.id) : 'scheduled'
      }));
    
    return computeDayTotals(mealsAsInput, dayLogs, recipeLookup);
  };

  const getDayCalories = (dayIndex: number) => {
    const dayDate = format(days[dayIndex], 'yyyy-MM-dd');
    const meals = getMealsForDay(dayDate);
    return meals.reduce((sum, meal) => {
      const nutrition = getMealNutrition(meal);
      return sum + nutrition.calories;
    }, 0);
  };

  const getDayMacrosDisplay = (dayIndex: number): MacroTotals => {
    const dayDate = format(days[dayIndex], 'yyyy-MM-dd');
    const meals = getMealsForDay(dayDate);
    return meals.reduce((acc, meal) => {
      const nutrition = getMealNutrition(meal);
      return {
        calories: acc.calories + nutrition.calories,
        protein: acc.protein + nutrition.protein,
        carbs: acc.carbs + nutrition.carbs,
        fat: acc.fat + nutrition.fat,
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const getWeekTotals = (): MacroTotals => {
    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (let i = 0; i < 7; i++) {
      const dayMacros = getDayMacros(i);
      totals.calories += dayMacros.calories;
      totals.protein += dayMacros.protein;
      totals.carbs += dayMacros.carbs;
      totals.fat += dayMacros.fat;
    }
    return totals;
  };

  const getTodayIndex = () => {
    const todayDate = new Date();
    for (let i = 0; i < 7; i++) {
      if (format(days[i], 'yyyy-MM-dd') === format(todayDate, 'yyyy-MM-dd')) {
        return i;
      }
    }
    return -1;
  };

  const todayIndex = getTodayIndex();
  const todayMacros = todayIndex >= 0 ? getDayMacros(todayIndex) : { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const weekTotals = getWeekTotals();

  const handleRemoveMeal = (mealId: string) => {
    removeFromPlanner(mealId);
    toast({
      title: "Removed from plan",
      description: "Recipe removed from your meal plan",
    });
  };

  const handleMarkCooked = async (meal: typeof planner[0]) => {
    const recipe = getRecipeById(meal.recipeId);
    if (recipe) {
      if (markMealCooked) {
        markMealCooked(meal.id);
      }
      acceleratePantryDecay(recipe.ingredients.map(i => i.name));

      const nutrition = computeMealNutritionSnapshot(
        { id: meal.id, recipeId: meal.recipeId, servings: meal.servings ?? 1, mealState: meal.mealState, ingredientOverrides: meal.ingredientOverrides, dayIndex: meal.dayIndex, mealType: meal.mealType },
        recipe
      );
      const mealDate = meal.date || format(addDays(weekStart, meal.dayIndex), 'yyyy-MM-dd');
      try {
        await apiRequest('POST', '/api/consumption-logs', {
          date: mealDate,
          name: recipe.title,
          calories: nutrition.calories,
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
          recipeId: parseInt(recipe.id) || null,
          sourceType: 'cooknow_logged_recipe',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
      } catch (e) {
      }

      toast({
        title: "Marked as cooked",
        description: "Added to your daily totals",
      });
    }
  };

  const handleUndoCooked = async (meal: typeof planner[0]) => {
    const recipe = getRecipeById(meal.recipeId);
    if (unmarkMealCooked) {
      unmarkMealCooked(meal.id);
    }
    const mealDate = meal.date || format(addDays(weekStart, meal.dayIndex), 'yyyy-MM-dd');
    const matchingLog = consumptionLogs.find(
      log => log.sourceType === 'cooknow_logged_recipe' &&
        log.date === mealDate &&
        log.name && recipe && log.name.toLowerCase() === recipe.title.toLowerCase()
    );
    if (matchingLog) {
      try {
        await apiRequest('DELETE', `/api/consumption-logs/${matchingLog.id}`);
        queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
      } catch (e) {
      }
    }
    toast({
      title: "Undo cooked",
      description: "Meal reverted to scheduled",
    });
  };

  const buildUserPrefs = (): UserPreferences => {
    const allergies = (profile?.allergies as string[]) || [];
    const dietaryRestrictions = (profile?.dietaryPreferences as string[]) || [];
    const cookingComfort = (profile?.cookingComfort as string) || 'comfortable';
    const tools: string[] = [];

    const prefs: UserPreferences = {
      allergies,
      dietaryRestrictions,
      cookingComfort,
      tools,
    };

    if (isPro && profile?.targetCalories) {
      prefs.macroGoals = {
        targetCalories: profile.targetCalories || undefined,
        targetProtein: profile.targetProtein || undefined,
        targetCarbs: profile.targetCarbs || undefined,
        targetFat: profile.targetFat || undefined,
      };
    } else if (profile?.calorieGoal) {
      prefs.calorieGoal = profile.calorieGoal;
    }

    return prefs;
  };

  const mergePlannerMealsIntoPreview = (generated: GeneratedWeek, settings: GenerationSettings): { merged: GeneratedWeek; initialLockedIds: Set<string> } => {
    const plannerPreviewMeals: PreviewMeal[] = [];
    const initialLockedIds = new Set<string>();

    const mealTypesToInclude: AutoPopulateMealType[] = ['Breakfast', 'Lunch', 'Dinner'];
    if (settings.addDesserts) mealTypesToInclude.push('Desserts');
    if (settings.addSnackitizers) mealTypesToInclude.push('Snackitizers');

    const weekDates = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

    for (const pm of planner) {
      if (!weekDates.includes(pm.date)) continue;
      if (!mealTypesToInclude.includes(pm.mealType as AutoPopulateMealType)) continue;

      const resolvedRecipe = storeRecipes[pm.recipeId] || cachedRecipeLookupMap.current.get(pm.recipeId);
      if (!resolvedRecipe) continue;

      const dayIdx = weekDates.indexOf(pm.date);
      const previewId = `planner-${dayIdx}-${pm.mealType}-${pm.recipeId}`;
      plannerPreviewMeals.push({
        id: previewId,
        recipeId: pm.recipeId,
        dayIndex: dayIdx,
        mealType: pm.mealType as AutoPopulateMealType,
        servings: pm.servings || settings.servings[pm.mealType as AutoPopulateMealType] || 1,
        locked: true,
        fromPlanner: true,
      });
      initialLockedIds.add(previewId);
    }

    const mergedMeals = generated.meals.filter(gm => {
      return !plannerPreviewMeals.some(pm => pm.dayIndex === gm.dayIndex && pm.mealType === gm.mealType);
    });
    mergedMeals.push(...plannerPreviewMeals);
    mergedMeals.sort((a, b) => a.dayIndex - b.dayIndex || a.mealType.localeCompare(b.mealType));

    const projectedTotals = calculateProjectedTotals(mergedMeals, settings.servings, cachedRecipeLookupMap.current);
    return { merged: { meals: mergedMeals, projectedTotals }, initialLockedIds };
  };

  const fetchBatchForMealType = async (
    supabaseMealType: string,
    prefs: UserPreferences
  ): Promise<Recipe[]> => {
    const collected: Recipe[] = [];
    let iterations = 0;

    while (collected.length < BATCH_SIZE && iterations < MAX_FETCH_ITERATIONS) {
      iterations++;
      const offset = batchOffsets.current[supabaseMealType] || 0;
      const excludeIds = [...(seenRecipeIds.current[supabaseMealType] || [])];
      const excludeParam = excludeIds.length > 0 ? `&exclude=${excludeIds.join(',')}` : '';
      const url = `/api/recipes/feed/planner?meal_type=${encodeURIComponent(supabaseMealType)}&offset=${offset}&limit=${BATCH_SIZE}${excludeParam}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      const rawRecipes: Recipe[] = data.recipes || [];

      if (rawRecipes.length === 0) break;

      batchOffsets.current[supabaseMealType] = offset + rawRecipes.length;

      let filtered = filterRecipes(rawRecipes, prefs);
      if (isPro && prefs.macroGoals) {
        filtered = applyProHardLimits(filtered, prefs.macroGoals);
      }

      for (const r of filtered) {
        if (seenRecipeIds.current[supabaseMealType]?.has(r.id)) continue;
        seenRecipeIds.current[supabaseMealType]?.add(r.id);
        collected.push(r);
        if (collected.length >= BATCH_SIZE) break;
      }

      for (const r of rawRecipes) {
        seenRecipeIds.current[supabaseMealType]?.add(r.id);
      }
    }

    if (collected.length > 0) {
      cachedCandidateRecipes.current = [...cachedCandidateRecipes.current, ...collected];
      for (const r of collected) {
        cachedRecipeLookupMap.current.set(r.id, r);
      }
      useRecipeStore.getState().setRecipes(collected);
    }

    return collected;
  };

  const fetchAllMealTypeBatches = async (
    activeMealTypes: readonly string[],
    prefs: UserPreferences
  ): Promise<Recipe[]> => {
    const results = await Promise.all(
      activeMealTypes.map(mt => fetchBatchForMealType(mt, prefs))
    );
    return results.flat();
  };

  const resetFetchSession = () => {
    cachedCandidateRecipes.current = [];
    cachedRecipeLookupMap.current = new Map();
    for (const mt of SUPABASE_MEAL_TYPES) {
      seenRecipeIds.current[mt] = new Set();
      batchOffsets.current[mt] = 0;
    }
  };

  const handleOpenAutoPopulate = async () => {
    resetFetchSession();
    setPreviewWeek(null);
    setShowPreviewOverlay(true);
    setIsFetchingCandidates(true);
    try {
      const userPrefs = buildUserPrefs();
      const activeMealTypes: string[] = ['Breakfast', 'Lunch', 'Dinner'];
      if (generationSettings.addDesserts) activeMealTypes.push('Dessert');
      if (generationSettings.addSnackitizers) activeMealTypes.push('Snack/Appetizer');

      const candidates = await fetchAllMealTypeBatches(activeMealTypes, userPrefs);
      if (candidates.length === 0) {
        toast({ title: "No recipes found", description: "No matching recipes available. Try adjusting your preferences.", variant: "destructive" });
        setShowPreviewOverlay(false);
        return;
      }
      const favoriteIds = favorites || [];
      
      const generated = generateWeekPlan(
        generationSettings,
        userPrefs,
        pantry || [],
        favoriteIds,
        [],
        cachedCandidateRecipes.current
      );
      
      const { merged, initialLockedIds } = mergePlannerMealsIntoPreview(generated, generationSettings);
      setLockedMealIds(initialLockedIds);
      setPreviewWeek(merged);
    } catch (e) {
      toast({ title: "Error", description: "Failed to fetch recipes. Please try again.", variant: "destructive" });
      setShowPreviewOverlay(false);
    } finally {
      setIsFetchingCandidates(false);
    }
  };

  const handleRegenerate = async () => {
    if (!previewWeek) return;
    setIsFetchingCandidates(true);
    try {
      const userPrefs = buildUserPrefs();

      const currentLockedMeals = previewWeek.meals.filter(m => lockedMealIds.has(m.id));

      const activeMealTypes: string[] = ['Breakfast', 'Lunch', 'Dinner'];
      if (generationSettings.addDesserts) activeMealTypes.push('Dessert');
      if (generationSettings.addSnackitizers) activeMealTypes.push('Snack/Appetizer');

      await fetchAllMealTypeBatches(activeMealTypes, userPrefs);

      const favoriteIds = favorites || [];
      const lockedSlots = currentLockedMeals.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType, recipeId: m.recipeId, servings: m.servings }));

      const generated = generateWeekPlan(
        generationSettings,
        userPrefs,
        pantry || [],
        favoriteIds,
        lockedSlots,
        cachedCandidateRecipes.current
      );

      const mergedMeals = [...generated.meals, ...currentLockedMeals];
      mergedMeals.sort((a, b) => a.dayIndex - b.dayIndex || a.mealType.localeCompare(b.mealType));
      const projectedTotals = calculateProjectedTotals(mergedMeals, generationSettings.servings, cachedRecipeLookupMap.current);

      setPreviewWeek({ meals: mergedMeals, projectedTotals });
      toast({ title: "Regenerated", description: "New meal suggestions created" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to regenerate. Please try again.", variant: "destructive" });
    } finally {
      setIsFetchingCandidates(false);
    }
  };

  const handleConfirmPlan = () => {
    if (!previewWeek) return;
    
    let addedCount = 0;
    for (const meal of previewWeek.meals) {
      const mealDate = format(addDays(weekStart, meal.dayIndex), 'yyyy-MM-dd');
      
      const existingPlannerMeal = planner.find(m => 
        m.date === mealDate && m.mealType === meal.mealType
      );
      
      if (existingPlannerMeal && existingPlannerMeal.recipeId === meal.recipeId) {
        continue;
      }
      
      if (existingPlannerMeal) {
        removeFromPlanner(existingPlannerMeal.id);
      }
      
      addToPlanner({
        recipeId: meal.recipeId,
        dayIndex: meal.dayIndex,
        mealType: meal.mealType as MealType,
        servings: meal.servings || 1,
        date: mealDate
      });
      addedCount++;
    }
    
    setShowPreviewOverlay(false);
    setPreviewWeek(null);
    setLockedMealIds(new Set());
    toast({ 
      title: "Plan confirmed", 
      description: `Added ${addedCount} meals to your calendar` 
    });
  };

  const handleSwapMeal = (meal: PreviewMeal, dayIndex: number) => {
    setSwapTarget({ meal, dayIndex });
    setSwapSearchQuery("");
    setShowSwapModal(true);
  };

  const handleOpenSwapFork = (type: 'planner' | 'preview', plannerMeal?: PlannedMeal, previewMeal?: PreviewMeal, dayIndex?: number) => {
    setSwapForkTarget({ type, plannerMeal, previewMeal, dayIndex });
    setShowSwapFork(true);
  };

  const handleSwapForkIngredients = () => {
    setShowSwapFork(false);
    if (swapForkTarget?.type === 'planner' && swapForkTarget.plannerMeal) {
      setSelectedMealForDetail(swapForkTarget.plannerMeal);
      setShowMealDetail(true);
    } else if (swapForkTarget?.type === 'preview' && swapForkTarget.previewMeal) {
      const previewMeal = swapForkTarget.previewMeal;
      const dayIdx = swapForkTarget.dayIndex ?? previewMeal.dayIndex;
      const dateStr = format(days[dayIdx] || new Date(), 'yyyy-MM-dd');
      const tempPlannedMeal: PlannedMeal = {
        id: previewMeal.id,
        recipeId: previewMeal.recipeId,
        dayIndex: dayIdx,
        mealType: previewMeal.mealType as MealType,
        mealState: 'scheduled',
        servings: previewMeal.servings,
        date: dateStr,
        ingredientOverrides: []
      };
      setSelectedMealForDetail(tempPlannedMeal);
      setShowMealDetail(true);
    }
    setSwapForkTarget(null);
  };

  const handleSwapForkRecipe = () => {
    setShowSwapFork(false);
    if (swapForkTarget?.type === 'planner' && swapForkTarget.plannerMeal) {
      const meal = swapForkTarget.plannerMeal;
      const dayIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === meal.date);
      const previewMeal: PreviewMeal = {
        id: meal.id.toString(),
        recipeId: meal.recipeId,
        dayIndex: dayIdx >= 0 ? dayIdx : 0,
        mealType: meal.mealType as AutoPopulateMealType,
        servings: meal.servings
      };
      setSwapSource('planner');
      setSwapPlannerMeal(meal);
      setSwapTarget({ meal: previewMeal, dayIndex: dayIdx >= 0 ? dayIdx : 0 });
      setSwapSearchQuery("");
      setShowSwapModal(true);
    } else if (swapForkTarget?.type === 'preview' && swapForkTarget.previewMeal && swapForkTarget.dayIndex !== undefined) {
      setSwapSource('preview');
      setSwapPlannerMeal(null);
      handleSwapMeal(swapForkTarget.previewMeal, swapForkTarget.dayIndex);
    }
    setSwapForkTarget(null);
  };

  const handleSelectSwapRecipe = (recipeId: string, ingredientOverrides?: IngredientOverride[]) => {
    if (!swapTarget) return;

    if (swapSource === 'planner' && swapPlannerMeal) {
      const mealDate = swapPlannerMeal.date || format(addDays(weekStart, swapPlannerMeal.dayIndex), 'yyyy-MM-dd');
      addToPlannerWithReplace({
        recipeId,
        dayIndex: swapPlannerMeal.dayIndex,
        mealType: swapPlannerMeal.mealType,
        servings: swapPlannerMeal.servings,
        date: mealDate,
        ingredientOverrides: ingredientOverrides || []
      });
      const newRecipe = getRecipeById(recipeId);
      toast({
        title: "Recipe swapped",
        description: newRecipe ? `Now showing "${newRecipe.title}"` : "Recipe updated",
      });
      setShowSwapModal(false);
      setSwapTarget(null);
      setSwapPlannerMeal(null);
      setSwapPreviewRecipeId(null);
      setPreviewOverrides([]);
      return;
    }

    if (!previewWeek) return;
    const updatedMeals = previewWeek.meals.map(m => 
      m.id === swapTarget.meal.id 
        ? { ...m, recipeId } 
        : m
    );
    
    const newTotals = calculateProjectedTotals(updatedMeals, generationSettings.servings, cachedRecipeLookupMap.current);
    setPreviewWeek({ meals: updatedMeals, projectedTotals: newTotals });
    setShowSwapModal(false);
    setSwapTarget(null);
    setSwapPreviewRecipeId(null);
    setPreviewOverrides([]);
  };

  const updateServings = (mealType: AutoPopulateMealType, delta: number) => {
    const current = generationSettings.servings[mealType];
    const newValue = Math.max(1, Math.min(10, current + delta));
    
    setGenerationSettings(prev => ({
      ...prev,
      servings: { ...prev.servings, [mealType]: newValue }
    }));
    
    if (previewWeek) {
      const updatedMeals = previewWeek.meals.map(m => 
        m.mealType === mealType ? { ...m, servings: newValue } : m
      );
      const newTotals = calculateProjectedTotals(updatedMeals, { ...generationSettings.servings, [mealType]: newValue }, cachedRecipeLookupMap.current);
      setPreviewWeek({ meals: updatedMeals, projectedTotals: newTotals });
    }
  };

  const getSwapSuggestionsForMeal = (meal: PreviewMeal) => {
    if (!meal) return [];
    const usedIds = previewWeek
      ? new Set(previewWeek.meals.map(m => m.recipeId))
      : new Set(planner.map(m => m.recipeId));
    let candidates = cachedCandidateRecipes.current;
    if (candidates.length === 0) {
      candidates = Object.values(storeRecipes);
    }
    return getSwapSuggestions(
      meal.recipeId,
      meal.mealType,
      buildUserPrefs(),
      pantry || [],
      favorites || [],
      usedIds,
      candidates,
      6
    );
  };

  const searchSwapRecipes = (query: string, mealType: AutoPopulateMealType) => {
    if (!query.trim()) return [];
    let candidates = cachedCandidateRecipes.current;
    if (candidates.length === 0) {
      candidates = Object.values(storeRecipes);
    }
    return searchRecipesForMealType(
      query,
      mealType,
      buildUserPrefs(),
      candidates,
      10
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} data-testid="button-prev-week">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-semibold text-sm">
                {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} data-testid="button-next-week">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "card" | "list")}>
              <TabsList className="h-8">
                <TabsTrigger value="card" className="h-6 px-2" data-testid="button-card-view">
                  <LayoutGrid className="w-3 h-3" />
                </TabsTrigger>
                <TabsTrigger value="list" className="h-6 px-2" data-testid="button-list-view">
                  <List className="w-3 h-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isPro && !macrosSet && (
            <Card className="bg-amber-50 border-amber-200 mb-3" data-testid="banner-macros-not-set">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <p className="text-sm text-amber-800">
                  Macros not set — planning is limited until you finish setup.
                </p>
                <Button 
                  size="sm"
                  onClick={() => setLocation("/macro-wizard")}
                  className="bg-recipal-orange shrink-0"
                  data-testid="button-finish-setup"
                >
                  Finish setting up macros
                </Button>
              </CardContent>
            </Card>
          )}

          {(() => {
            const todayPlannedMeals = getMealsForDay(today);
            const totalPlanned = todayPlannedMeals.reduce((sum, meal) => {
              const nutrition = getMealNutrition(meal);
              return sum + nutrition.calories;
            }, 0);
            
            const goalCalories = isPro && profile?.targetCalories
              ? profile.targetCalories
              : (profile?.calorieGoal ? profile.calorieGoal : totalPlanned);
            const goalProtein = isPro && profile?.targetProtein ? profile.targetProtein : 0;
            const goalCarbs = isPro && profile?.targetCarbs ? profile.targetCarbs : 0;
            const goalFat = isPro && profile?.targetFat ? profile.targetFat : 0;

            return (
              <CalorieCounterCard
                isPro={isPro}
                macrosSet={macrosSet}
                goalCalories={goalCalories}
                goalProtein={goalProtein}
                goalCarbs={goalCarbs}
                goalFat={goalFat}
                consumed={todayMacros}
                onUpgrade={() => setLocation("/paywall")}
                onFinishSetup={() => setLocation("/macro-wizard")}
                onUpdateGoals={handleUpdateGoals}
              />
            );
          })()}

              <Button 
                onClick={handleOpenAutoPopulate}
                disabled={isFetchingCandidates}
                className="w-full mt-3 bg-[#ff6300] text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                data-testid="button-auto-populate"
              >
                {isFetchingCandidates ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                {isFetchingCandidates ? "Loading recipes..." : (isPro && macrosSet ? "Auto-populate Week (Optimized for Macros)" : "Auto-populate Week")}
              </Button>
              
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
          {viewMode === "card" ? (
            <div className="space-y-4">
              {days.map((day, dayIdx) => {
                const dayDate = format(day, 'yyyy-MM-dd');
                const dayMeals = getMealsForDay(dayDate);
                const dayCalories = getDayCalories(dayIdx);
                const dayMacrosDisplay = getDayMacrosDisplay(dayIdx);
                const isToday = dayDate === today;
                
                return (
                  <Card key={day.toISOString()} className={`border-0 shadow-[0_0_8px_rgba(0,0,0,0.35)] ${isToday ? 'ring-2 ring-recipal-orange' : ''}`} data-testid={`card-day-${format(day, 'yyyy-MM-dd')}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            {format(day, "EEEE, MMM d")}
                            {isToday && <Badge variant="secondary" className="text-[10px]">Today</Badge>}
                          </span>
                          {dayCalories > 0 && (
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-2 text-[11px] font-normal">
                                <span className="font-semibold text-black dark:text-white">Daily Total</span>
                                <span className="text-yellow-600 dark:text-yellow-500 font-medium">{dayCalories} kcal</span>
                              </div>
                              {isPro && (
                                <div className="flex gap-3 text-[11px] font-medium justify-end mt-0.5" data-testid={`macros-day-${dayIdx}`}>
                                  <span className="text-recipal-orange">P: {dayMacrosDisplay.protein}g</span>
                                  <span className="text-primary">C: {dayMacrosDisplay.carbs}g</span>
                                  <span className="text-blue-800 dark:text-blue-300">F: {dayMacrosDisplay.fat}g</span>
                                </div>
                              )}
                              {!isPro && dayMeals.length > 0 && (
                                <div className="flex gap-3 text-[11px] font-medium justify-end mt-0.5 blur-[2px] text-muted-foreground/50" data-testid={`macros-day-${dayIdx}-blurred`}>
                                  <span>P: --g</span>
                                  <span>C: --g</span>
                                  <span>F: --g</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {mealSlots.map((mealType) => {
                        const mealsOfType = dayMeals.filter(m => m.mealType === mealType);
                        
                        return (
                          <div key={mealType} className="space-y-1">
                            <div className="flex items-center justify-between py-1">
                              <span className="text-xs text-muted-foreground font-medium">{mealType}</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-xs gap-1"
                                onClick={() => setLocation("/recipes")}
                                data-testid={`button-add-${mealType.toLowerCase()}-${format(day, 'yyyy-MM-dd')}`}
                              >
                                <Plus className="w-3 h-3" /> Add
                              </Button>
                            </div>
                            
                            {mealsOfType.map((meal) => {
                              const recipe = getRecipeById(meal.recipeId);
                              if (!recipe) return null;
                              const mealState = getMealState ? getMealState(meal.id) : 'scheduled';
                              const isCooked = mealState === 'cooked' || mealState === 'autoCounted';
                              const mealNutrition = getMealNutrition(meal);
                              
                              return (
                                <div 
                                  key={meal.id} 
                                  className={`p-2 rounded-lg relative overflow-visible ${isCooked ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted'}`}
                                  data-testid={`meal-${meal.id}`}
                                >
                                  <button
                                    className="absolute -top-2 -right-2 z-10 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                                    onClick={() => handleRemoveMeal(meal.id)}
                                    data-testid={`button-remove-${meal.id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <img 
                                          src={recipe.image} 
                                          alt={recipe.title}
                                          className="w-10 h-10 rounded object-cover cursor-pointer"
                                          onClick={() => setLocation(`/recipe/${recipe.id}`)}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-muted-foreground leading-tight">{mealType}</p>
                                          <p className="text-xs font-medium truncate">{recipe.title}</p>
                                          <p className="text-[10px] text-muted-foreground">
                                            {meal.servings > 1 && <span>({meal.servings} srv)</span>}
                                            {isCooked && <span className="text-green-600">(counted)</span>}
                                          </p>
                                        </div>
                                      </div>
                                      {isPro && (
                                        <div className="flex gap-1 mt-1.5" data-testid={`meal-macros-${meal.id}`}>
                                          <div className="bg-recipal-orange/10 border border-recipal-orange/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                            <span className="text-[12px] font-bold text-recipal-orange leading-none">{mealNutrition.protein}g</span>
                                            <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Protein</span>
                                          </div>
                                          <div className="bg-primary/10 border border-primary/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                            <span className="text-[12px] font-bold text-primary leading-none">{mealNutrition.carbs}g</span>
                                            <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Carbs</span>
                                          </div>
                                          <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                            <span className="text-[12px] font-bold text-blue-800 dark:text-blue-300 leading-none">{mealNutrition.fat}g</span>
                                            <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Fat</span>
                                          </div>
                                          <div className="bg-yellow-100/30 border border-yellow-500/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                            <span className="text-[12px] font-bold text-yellow-600 dark:text-yellow-500 leading-none">{mealNutrition.calories}</span>
                                            <span className="text-[9px] text-black dark:text-white leading-none mt-[1px]">Calories</span>
                                          </div>
                                        </div>
                                      )}
                                      {!isPro && (
                                        <div className="flex gap-1 mt-1.5 blur-[1px] opacity-40" data-testid={`meal-macros-${meal.id}-blurred`}>
                                          <div className="bg-muted border border-muted-foreground/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                            <span className="text-[12px] font-bold leading-none">0g</span>
                                            <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Protein</span>
                                          </div>
                                          <div className="bg-muted border border-muted-foreground/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                            <span className="text-[12px] font-bold leading-none">0g</span>
                                            <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Carbs</span>
                                          </div>
                                          <div className="bg-muted border border-muted-foreground/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                            <span className="text-[12px] font-bold leading-none">0g</span>
                                            <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Fat</span>
                                          </div>
                                          <div className="bg-muted border border-muted-foreground/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                            <span className="text-[12px] font-bold leading-none">0</span>
                                            <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Calories</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-1 items-center justify-center flex-shrink-0">
                                      {!isCooked && (
                                        <Button
                                          size="sm"
                                          className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white px-2 w-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                                          onClick={() => handleOpenSwapFork('planner', meal)}
                                          data-testid={`button-detail-${meal.id}`}
                                        >
                                          <Repeat className="w-3 h-3 text-white" />
                                          <span className="text-[10px] font-medium text-white ml-1">Swap</span>
                                        </Button>
                                      )}
                                      {!isCooked && (
                                        <Button 
                                          size="sm"
                                          className="bg-[#22c55e] hover:bg-[#22c55e]/90 text-white px-2 w-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                                          onClick={() => handleMarkCooked(meal)}
                                          data-testid={`button-cooked-${meal.id}`}
                                        >
                                          <Flame className="w-3 h-3 text-white" />
                                          <span className="text-[10px] font-medium text-white ml-1">Cooked</span>
                                        </Button>
                                      )}
                                      {isCooked && (
                                        <Button
                                          size="sm"
                                          className="bg-[#ef4444] hover:bg-[#ef4444]/90 text-white px-2 w-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                                          onClick={() => handleUndoCooked(meal)}
                                          data-testid={`button-undo-cooked-${meal.id}`}
                                        >
                                          <Undo2 className="w-3 h-3 text-white" />
                                          <span className="text-[10px] font-medium text-white ml-1">Undo</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {days.map((day, dayIdx) => {
                const dayDate = format(day, 'yyyy-MM-dd');
                const dayMeals = getMealsForDay(dayDate);
                const dayCalories = getDayCalories(dayIdx);
                const isToday = dayDate === today;
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`p-3 rounded-lg shadow-[0_0_8px_rgba(0,0,0,0.35)] ${isToday ? 'ring-2 ring-recipal-orange' : ''}`} 
                    data-testid={`row-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm flex items-center gap-2">
                        {format(day, "EEE, MMM d")}
                        {isToday && <Badge variant="secondary" className="text-[10px]">Today</Badge>}
                      </span>
                      {dayMeals.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {dayMeals.length} meals
                          </Badge>
                          <span className="text-xs text-muted-foreground">{dayCalories} cal</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No meals planned</span>
                      )}
                    </div>
                    
                    {dayMeals.length > 0 && (
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {dayMeals.map((meal) => {
                          const recipe = getRecipeById(meal.recipeId);
                          if (!recipe) return null;
                          const mealState = getMealState ? getMealState(meal.id) : 'scheduled';
                          const isCooked = mealState === 'cooked' || mealState === 'autoCounted';
                          
                          return (
                            <div 
                              key={meal.id} 
                              className={`flex-shrink-0 text-center cursor-pointer ${isCooked ? 'opacity-60' : ''}`}
                              onClick={() => setLocation(`/recipe/${recipe.id}`)}
                            >
                              <img 
                                src={recipe.image} 
                                alt={recipe.title}
                                className={`w-12 h-12 rounded object-cover ${isCooked ? 'ring-2 ring-green-500' : ''}`}
                              />
                              <p className="text-[10px] text-muted-foreground mt-1">{meal.mealType}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {planner.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">No meals planned yet</p>
              <p className="text-xs mt-1">Browse recipes and add them to your plan</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setLocation("/recipes")}
                data-testid="button-browse-recipes"
              >
                Browse Recipes
              </Button>
            </div>
          )}

        </div>

      <Dialog open={showPreviewOverlay} onOpenChange={setShowPreviewOverlay}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6" data-testid="dialog-preview-overlay">
          <DialogHeader>
            <DialogTitle>Preview Your Week</DialogTitle>
            <p className="text-sm text-muted-foreground">Confirm or regenerate before saving</p>
          </DialogHeader>

          {isFetchingCandidates && !previewWeek && (
            <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="preview-loading">
              <Loader2 className="w-8 h-8 animate-spin text-[#ff6300]" />
              <p className="text-sm text-muted-foreground">Loading recipes...</p>
            </div>
          )}

          <div className="space-y-4 w-full min-w-0" style={{ display: isFetchingCandidates && !previewWeek ? 'none' : undefined }}>
            <div>
              <Label className="text-sm font-medium mb-2 block">Servings</Label>
              <div className="grid grid-cols-2 gap-3">
                {(['Breakfast', 'Lunch', 'Dinner'] as AutoPopulateMealType[]).map(mealType => (
                  <div key={mealType} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-xs font-medium">{mealType}</span>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => updateServings(mealType, -1)}
                        disabled={generationSettings.servings[mealType] <= 1}
                        data-testid={`button-servings-${mealType.toLowerCase()}-minus`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {generationSettings.servings[mealType] >= 10 ? '10+' : generationSettings.servings[mealType]}
                      </span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => updateServings(mealType, 1)}
                        disabled={generationSettings.servings[mealType] >= 10}
                        data-testid={`button-servings-${mealType.toLowerCase()}-plus`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="addDesserts"
                  checked={generationSettings.addDesserts}
                  onCheckedChange={async (checked) => {
                    const newSettings = { 
                      ...generationSettings, 
                      addDesserts: !!checked,
                      servings: { ...generationSettings.servings, Desserts: 1 }
                    };
                    setGenerationSettings(newSettings);
                    if (previewWeek && checked) {
                      const userPrefs = buildUserPrefs();
                      await fetchBatchForMealType('Dessert', userPrefs);
                      const currentLockedMeals = previewWeek.meals.filter(m => lockedMealIds.has(m.id));
                      const lockedSlots = currentLockedMeals.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType, recipeId: m.recipeId, servings: m.servings }));
                      const generated = generateWeekPlan(newSettings, userPrefs, pantry || [], favorites || [], lockedSlots, cachedCandidateRecipes.current);
                      const mergedMeals = [...generated.meals.filter(gm => !currentLockedMeals.some(lm => lm.dayIndex === gm.dayIndex && lm.mealType === gm.mealType)), ...currentLockedMeals];
                      mergedMeals.sort((a, b) => a.dayIndex - b.dayIndex || a.mealType.localeCompare(b.mealType));
                      const newTotals = calculateProjectedTotals(mergedMeals, newSettings.servings, cachedRecipeLookupMap.current);
                      setPreviewWeek({ meals: mergedMeals, projectedTotals: newTotals });
                    } else if (previewWeek && !checked) {
                      const filteredMeals = previewWeek.meals.filter(m => m.mealType !== 'Desserts');
                      const removedIds = previewWeek.meals.filter(m => m.mealType === 'Desserts').map(m => m.id);
                      const newLocked = new Set(lockedMealIds);
                      removedIds.forEach(id => newLocked.delete(id));
                      setLockedMealIds(newLocked);
                      const newTotals = calculateProjectedTotals(filteredMeals, newSettings.servings, cachedRecipeLookupMap.current);
                      setPreviewWeek({ meals: filteredMeals, projectedTotals: newTotals });
                    }
                  }}
                  data-testid="checkbox-add-desserts"
                />
                <Label htmlFor="addDesserts" className="text-sm">Add Desserts</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="addSnackitizers"
                  checked={generationSettings.addSnackitizers}
                  onCheckedChange={async (checked) => {
                    const newSettings = { 
                      ...generationSettings, 
                      addSnackitizers: !!checked,
                      servings: { ...generationSettings.servings, Snackitizers: 1 }
                    };
                    setGenerationSettings(newSettings);
                    if (previewWeek && checked) {
                      const userPrefs = buildUserPrefs();
                      await fetchBatchForMealType('Snack/Appetizer', userPrefs);
                      const currentLockedMeals = previewWeek.meals.filter(m => lockedMealIds.has(m.id));
                      const lockedSlots = currentLockedMeals.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType, recipeId: m.recipeId, servings: m.servings }));
                      const generated = generateWeekPlan(newSettings, userPrefs, pantry || [], favorites || [], lockedSlots, cachedCandidateRecipes.current);
                      const mergedMeals = [...generated.meals.filter(gm => !currentLockedMeals.some(lm => lm.dayIndex === gm.dayIndex && lm.mealType === gm.mealType)), ...currentLockedMeals];
                      mergedMeals.sort((a, b) => a.dayIndex - b.dayIndex || a.mealType.localeCompare(b.mealType));
                      const newTotals = calculateProjectedTotals(mergedMeals, newSettings.servings, cachedRecipeLookupMap.current);
                      setPreviewWeek({ meals: mergedMeals, projectedTotals: newTotals });
                    } else if (previewWeek && !checked) {
                      const filteredMeals = previewWeek.meals.filter(m => m.mealType !== 'Snackitizers');
                      const removedIds = previewWeek.meals.filter(m => m.mealType === 'Snackitizers').map(m => m.id);
                      const newLocked = new Set(lockedMealIds);
                      removedIds.forEach(id => newLocked.delete(id));
                      setLockedMealIds(newLocked);
                      const newTotals = calculateProjectedTotals(filteredMeals, newSettings.servings, cachedRecipeLookupMap.current);
                      setPreviewWeek({ meals: filteredMeals, projectedTotals: newTotals });
                    }
                  }}
                  data-testid="checkbox-add-snackitizers"
                />
                <Label htmlFor="addSnackitizers" className="text-sm">Add Snackitizers</Label>
              </div>
            </div>

            {(generationSettings.addDesserts || generationSettings.addSnackitizers) && (
              <div className="grid grid-cols-2 gap-3">
                {(['Desserts', 'Snackitizers'] as AutoPopulateMealType[])
                  .filter(mealType => {
                    if (mealType === 'Desserts') return generationSettings.addDesserts;
                    if (mealType === 'Snackitizers') return generationSettings.addSnackitizers;
                    return false;
                  })
                  .map(mealType => (
                  <div key={mealType} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-xs font-medium">{mealType}</span>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => updateServings(mealType, -1)}
                        disabled={generationSettings.servings[mealType] <= 1}
                        data-testid={`button-servings-${mealType.toLowerCase()}-minus`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {generationSettings.servings[mealType] >= 10 ? '10+' : generationSettings.servings[mealType]}
                      </span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => updateServings(mealType, 1)}
                        disabled={generationSettings.servings[mealType] >= 10}
                        data-testid={`button-servings-${mealType.toLowerCase()}-plus`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {previewWeek && (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const dayMeals = previewWeek.meals.filter(m => m.dayIndex === dayIdx);
                  if (dayMeals.length === 0) return null;
                  
                  return (
                    <div key={dayIdx} className="border rounded p-2 overflow-hidden" data-testid={`preview-day-${dayIdx}`}>
                      {(() => {
                        const dayTotals = dayMeals.reduce((acc, m) => {
                          const r = getRecipeById(m.recipeId);
                          if (r) {
                            acc.protein += Math.round((r.protein || 0) * m.servings);
                            acc.carbs += Math.round((r.carbs || 0) * m.servings);
                            acc.fat += Math.round((r.fat || 0) * m.servings);
                            acc.calories += Math.round((r.calories || 0) * m.servings);
                          }
                          return acc;
                        }, { protein: 0, carbs: 0, fat: 0, calories: 0 });
                        
                        return (
                          <div className="mb-2" data-testid={`preview-day-totals-${dayIdx}`}>
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-semibold truncate min-w-0">
                                {format(addDays(weekStart, dayIdx), "EEEE, MMM d")}
                              </p>
                              <div className="text-right flex-shrink-0">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-[11px] font-semibold text-black dark:text-white">Daily Total</span>
                                  <span className="text-[11px] text-yellow-600 dark:text-yellow-500 font-medium" data-testid={`preview-day-cal-${dayIdx}`}>{dayTotals.calories} kcal</span>
                                </div>
                                <div className="flex gap-3 text-[11px] font-medium justify-end mt-0.5">
                                  <span className="text-recipal-orange" data-testid={`preview-day-protein-${dayIdx}`}>P: {dayTotals.protein}g</span>
                                  <span className="text-primary" data-testid={`preview-day-carbs-${dayIdx}`}>C: {dayTotals.carbs}g</span>
                                  <span className="text-blue-800 dark:text-blue-300" data-testid={`preview-day-fat-${dayIdx}`}>F: {dayTotals.fat}g</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="space-y-1">
                        {(['Breakfast', 'Lunch', 'Dinner', 'Desserts', 'Snackitizers'] as AutoPopulateMealType[])
                          .filter(mealType => {
                            if (mealType === 'Desserts') return generationSettings.addDesserts;
                            if (mealType === 'Snackitizers') return generationSettings.addSnackitizers;
                            return true;
                          })
                          .map(mealType => {
                          const meal = dayMeals.find(m => m.mealType === mealType);
                          if (!meal) return null;
                          
                          const recipe = getRecipeById(meal.recipeId);
                          if (!recipe) return null;

                          const isLocked = lockedMealIds.has(meal.id);
                          
                          return (
                            <div 
                              key={meal.id}
                              className={`p-1.5 rounded relative overflow-visible ${isLocked ? 'bg-green-50 dark:bg-green-950/20 ring-1 ring-green-300 dark:ring-green-700' : 'bg-muted'}`}
                              data-testid={`preview-meal-${meal.id}`}
                            >
                              {!isLocked && (
                                <button
                                  onClick={() => {
                                    if (!previewWeek) return;
                                    const filteredMeals = previewWeek.meals.filter(m => m.id !== meal.id);
                                    const newTotals = calculateProjectedTotals(filteredMeals, generationSettings.servings, cachedRecipeLookupMap.current);
                                    setPreviewWeek({ meals: filteredMeals, projectedTotals: newTotals });
                                  }}
                                  className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                                  data-testid={`button-remove-meal-${meal.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                                  <div className="flex gap-2 items-start">
                                    <img 
                                      src={recipe.image} 
                                      alt={recipe.title}
                                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-[10px] text-muted-foreground">{mealType} - {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</p>
                                      <p className="text-xs font-medium truncate">{recipe.title}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1.5" data-testid={`preview-meal-macros-${meal.id}`}>
                                    <div className="bg-recipal-orange/10 border border-recipal-orange/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                      <span className="text-[12px] font-bold text-recipal-orange leading-none" data-testid={`preview-meal-protein-${meal.id}`}>{Math.round((recipe.protein || 0) * meal.servings)}g</span>
                                      <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Protein</span>
                                    </div>
                                    <div className="bg-primary/10 border border-primary/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                      <span className="text-[12px] font-bold text-primary leading-none" data-testid={`preview-meal-carbs-${meal.id}`}>{Math.round((recipe.carbs || 0) * meal.servings)}g</span>
                                      <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Carbs</span>
                                    </div>
                                    <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                      <span className="text-[12px] font-bold text-blue-800 dark:text-blue-300 leading-none" data-testid={`preview-meal-fat-${meal.id}`}>{Math.round((recipe.fat || 0) * meal.servings)}g</span>
                                      <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Fat</span>
                                    </div>
                                    <div className="bg-yellow-100/30 border border-yellow-500/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                      <span className="text-[12px] font-bold text-yellow-600 dark:text-yellow-500 leading-none" data-testid={`preview-meal-cal-${meal.id}`}>{Math.round((recipe.calories || 0) * meal.servings)}</span>
                                      <span className="text-[9px] text-black dark:text-white leading-none mt-[1px]">Calories</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 flex-shrink-0" style={{ marginTop: '7px' }}>
                                  {!isLocked && (
                                    <Button
                                      size="sm"
                                      className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white px-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                                      onClick={() => handleOpenSwapFork('preview', undefined, meal, dayIdx)}
                                      data-testid={`button-swap-meal-${meal.id}`}
                                    >
                                      <Repeat className="w-3 h-3 text-white" />
                                      <span className="text-[10px] font-medium text-white ml-1">Swap</span>
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    className={`px-2 font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 ${
                                      isLocked
                                        ? 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-white'
                                        : 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-white'
                                    }`}
                                    onClick={() => {
                                      const newLocked = new Set(lockedMealIds);
                                      if (isLocked) {
                                        newLocked.delete(meal.id);
                                      } else {
                                        newLocked.add(meal.id);
                                      }
                                      setLockedMealIds(newLocked);
                                    }}
                                    data-testid={`button-lock-meal-${meal.id}`}
                                  >
                                    {isLocked ? <Lock className="w-3 h-3 text-white" /> : <Unlock className="w-3 h-3 text-white" />}
                                    <span className="text-[10px] font-medium text-white ml-1">{isLocked ? 'Locked' : 'Lock'}</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleRegenerate}
                data-testid="button-regenerate"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button 
                className="flex-1 h-10 bg-recipal-orange text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
                onClick={handleConfirmPlan}
                data-testid="button-confirm-plan"
              >
                Confirm Plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSwapModal} onOpenChange={(open) => {
        setShowSwapModal(open);
        if (!open) {
          setSwapPreviewRecipeId(null);
          setPreviewOverrides([]);
        }
      }}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" data-testid="dialog-swap-meal">
          <DialogHeader>
            <DialogTitle>Swap Recipe</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose a replacement for "{swapTarget?.meal.recipeId ? getRecipeById(swapTarget.meal.recipeId)?.title || swapTarget.meal.mealType : swapTarget?.meal.mealType}"
            </p>
          </DialogHeader>

          <div className="space-y-3 overflow-hidden">
            {!swapPreviewRecipeId && (() => {
              const currentRecipe = swapTarget?.meal.recipeId ? getRecipeById(swapTarget.meal.recipeId) : null;
              if (!currentRecipe) return null;
              return (
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 border rounded-lg" data-testid="swap-current-meal">
                  <img
                    src={currentRecipe.image}
                    alt={currentRecipe.title}
                    className="w-10 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate max-w-[22ch]">{currentRecipe.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentRecipe.calories} cal · {currentRecipe.protein}P · {currentRecipe.carbs}C · {currentRecipe.fat}F
                    </p>
                  </div>
                </div>
              );
            })()}

            {!swapPreviewRecipeId && (
              <>
                {swapTarget?.meal.recipeId && getRecipeById(swapTarget.meal.recipeId) && (
                  <div className="border-b" />
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search recipes..."
                    value={swapSearchQuery}
                    onChange={(e) => setSwapSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-swap-search"
                  />
                </div>

                <div className="space-y-2 max-h-[512px] overflow-y-auto overflow-x-hidden">
                  {(() => {
                    if (!swapTarget) return null;
                    const results = swapSearchQuery.trim()
                      ? searchSwapRecipes(swapSearchQuery, swapTarget.meal.mealType)
                      : getSwapSuggestionsForMeal(swapTarget.meal);
                    if (results.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-swap-empty">
                          {swapSearchQuery.trim() ? "No matching recipes found" : "No swap suggestions available"}
                        </p>
                      );
                    }
                    return results.map(recipe => (
                      <div 
                        key={recipe.id}
                        className="flex items-center gap-3 px-3 py-2 border rounded cursor-pointer hover-elevate"
                        onClick={() => setSwapPreviewRecipeId(recipe.id)}
                        data-testid={`swap-option-${recipe.id}`}
                      >
                        <img 
                          src={recipe.image} 
                          alt={recipe.title}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate max-w-[22ch]">{recipe.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {recipe.calories} cal · {recipe.protein}P · {recipe.carbs}C · {recipe.fat}F
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}

            {swapPreviewRecipeId && (() => {
              const previewRecipe = getRecipeById(swapPreviewRecipeId);
              if (!previewRecipe) return null;

              const getPreviewDisplayName = (ingredientName: string) => {
                const override = previewOverrides.find(
                  o => o.originalIngredientName.toLowerCase() === ingredientName.toLowerCase()
                );
                return override ? override.replacementName : ingredientName;
              };

              const hasOverride = (ingredientName: string) => {
                return previewOverrides.some(
                  o => o.originalIngredientName.toLowerCase() === ingredientName.toLowerCase()
                );
              };

              return (
                <div className="space-y-3" data-testid="swap-preview-card">
                  <div className="flex items-center gap-3 px-3 py-2 border rounded-lg">
                    <img
                      src={previewRecipe.image}
                      alt={previewRecipe.title}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{previewRecipe.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {previewRecipe.calories} cal · {previewRecipe.protein}P · {previewRecipe.carbs}C · {previewRecipe.fat}F
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Ingredients</h4>
                    <div className="space-y-1.5 max-h-[360px] overflow-y-auto overflow-x-hidden">
                      {previewRecipe.ingredients.map((ing, idx) => {
                        const overridden = hasOverride(ing.name);
                        const displayName = getPreviewDisplayName(ing.name);
                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between gap-2 py-1.5 px-3 rounded border ${
                              overridden ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'border-transparent'
                            }`}
                            data-testid={`preview-ingredient-${idx}`}
                          >
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm truncate">{displayName}</span>
                              <span className="text-xs text-muted-foreground">{ing.amount} {ing.unit}</span>
                              {overridden && (
                                <span className="text-[10px] text-muted-foreground line-through">
                                  was: {ing.name}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              className="h-6 px-2 gap-1 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white text-[10px] font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 flex-shrink-0"
                              onClick={() => {
                                setPreviewSwapIngredient(ing.name);
                                setPreviewSwapPopupOpen(true);
                              }}
                              data-testid={`button-preview-swap-ingredient-${idx}`}
                            >
                              <Repeat className="h-3 w-3" /> Swap
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1 bg-[#ef4444] hover:bg-[#ef4444]/90 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                      onClick={() => {
                        setSwapPreviewRecipeId(null);
                        setPreviewOverrides([]);
                      }}
                      data-testid="button-swap-preview-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                      onClick={() => {
                        handleSelectSwapRecipe(swapPreviewRecipeId, previewOverrides.length > 0 ? previewOverrides : undefined);
                      }}
                      data-testid="button-swap-preview-confirm"
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <SwapIngredientPopup
        open={previewSwapPopupOpen}
        onOpenChange={setPreviewSwapPopupOpen}
        ingredientName={previewSwapIngredient}
        mealId={undefined}
        currentOverride={previewOverrides.find(
          o => o.originalIngredientName.toLowerCase() === previewSwapIngredient.toLowerCase()
        )}
        onSwapComplete={(replacement) => {
          setPreviewOverrides(prev => {
            const filtered = prev.filter(
              o => o.originalIngredientName.toLowerCase() !== previewSwapIngredient.toLowerCase()
            );
            return [...filtered, {
              originalIngredientName: previewSwapIngredient,
              replacementName: replacement.name,
              replacementNutrition: replacement.nutrition,
            }];
          });
        }}
      />

      <Dialog open={showSwapFork} onOpenChange={setShowSwapFork}>
        <DialogContent className="max-w-xs" data-testid="dialog-swap-fork">
          <DialogHeader>
            <DialogTitle className="text-center">What would you like to swap?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              size="lg"
              className="bg-[#22c55e] hover:bg-[#22c55e]/90 text-white w-[80%] mx-auto shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
              onClick={handleSwapForkIngredients}
              data-testid="button-swap-ingredients"
            >
              <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" style={{ fontSize: '17px' }}>Swap Ingredients</span>
            </Button>
            <Button
              size="lg"
              className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white w-[80%] mx-auto shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
              onClick={handleSwapForkRecipe}
              data-testid="button-swap-recipe"
            >
              <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" style={{ fontSize: '17px' }}>Swap Recipe</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedMealForDetail && (
        <MealDetailPopup
          open={showMealDetail}
          onOpenChange={setShowMealDetail}
          meal={selectedMealForDetail}
          recipe={getRecipeById(selectedMealForDetail.recipeId)!}
        />
      )}

      <Dialog open={showCalorieGoalModal} onOpenChange={setShowCalorieGoalModal}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle data-testid="text-calorie-goal-title">Update Calorie Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="calorie-goal-input">Daily Calorie Goal</Label>
              <Input
                id="calorie-goal-input"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 2000"
                value={tempCalorieGoal}
                onChange={(e) => setTempCalorieGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveCalorieGoal(); }}
                data-testid="input-calorie-goal"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCalorieGoalModal(false)}
                data-testid="button-calorie-goal-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCalorieGoal}
                disabled={updateCalorieGoalMutation.isPending}
                className="bg-recipal-orange"
                data-testid="button-calorie-goal-save"
              >
                {updateCalorieGoalMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
