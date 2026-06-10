import { useState, useEffect, useMemo, useRef, Fragment, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, ChevronUp, Flame, Lock, Unlock, Calendar, Wand2, Minus, X, Search, RefreshCw, Repeat, UtensilsCrossed, ArrowLeftRight, Loader2, Undo2, ChefHat } from "lucide-react";
import { CalorieCounterCard } from "@/components/calorie-counter-card";
import { MealDetailPopup } from "@/components/meal-detail-popup";
import { SwapIngredientPopup } from "@/components/swap-ingredient-popup";
import { SideMealCard } from "@/components/side-meal-card";
import { MealTotalRow } from "@/components/meal-total-row";
import { SidePickerModal } from "@/components/side-picker-modal";
import { SidesRadialPicker } from "@/components/sides-radial-picker";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { useDemoStore, MealType, PlannedMeal, IngredientOverride } from "@/lib/demo-store";
import type { Recipe } from "@/lib/mock-data";
import { useRecipeStore, fetchRecipeById } from "@/lib/recipe-store";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements } from "@/lib/entitlements";
import { useProfile } from "@/hooks/use-profile";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
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

const mealTypeToFilterParam: Record<string, string> = {
  Breakfast: "Breakfast",
  Lunch: "Lunch",
  Dinner: "Dinner",
  Desserts: "Dessert",
  Snackitizers: "Snacks",
};

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Solid-saturated "Daily Total" track — chosen mockup variant 01. Shared by the main
// planner day-card header and the auto-populate preview modal so both read identically.
// Light: WHITE pill (hairline border + soft shadow for definition on the near-white
// modal strip) with a BLACK label. Dark: a recessed charcoal pill (#0f1318, inset
// shadow) with a white label. Either way the track carries its own contrast on the
// orange header AND the neutral modal strip. Chip fills are inline (not bg-[#hex]
// classes) so the dark-mode macro→hsl remaps can't repaint them; label + white chip
// text come from classes, which aren't remapped.
function DailyTotalTrack({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 flex-wrap bg-[#ffffff] dark:bg-[#0f1318] border border-black/10 dark:border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.10)] dark:shadow-none ${className}`}>
      <span className="font-extrabold text-[9px] text-black dark:text-white/80 uppercase tracking-wide whitespace-nowrap">Daily Total</span>
      {children}
    </div>
  );
}

function MacroChip({ label, color, testId }: { label: string; color: string; testId?: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap"
      style={{ background: color, boxShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
      data-testid={testId}
    >
      {label}
    </span>
  );
}

export default function PlannerPage() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { entitlement } = useEntitlements();
  const isPro = entitlement.isPro;
  
  const { data: profile } = useProfile();
  const macrosSet = profile?.macrosSet === true;
  
  const { planner, removeFromPlanner, acceleratePantryDecay, markMealCooked, unmarkMealCooked, getMealState, addToPlanner, addToPlannerWithReplace, pantry, favorites, getSidesForMeal, addSideToMeal, removeSideFromMeal } = useDemoStore();

  // All tiers set goals through the macro wizard; the wizard itself gates the
  // auto calculator (Guide Me) behind Pro while manual entry stays free.
  const handleUpdateGoals = () => {
    setLocation("/macro-wizard?from=/plan");
  };

  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
  const [previewWeek, setPreviewWeek] = useState<GeneratedWeek | null>(null);
  const [lockedMealIds, setLockedMealIds] = useState<Set<string>>(new Set());
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    addDesserts: false,
    addSnackitizers: false,
    addSides: false,
    sidesMealTypes: { Breakfast: false, Lunch: false, Dinner: false },
    servings: {
      Breakfast: 1,
      Lunch: 1,
      Dinner: 1,
      Desserts: 1,
      Snackitizers: 1,
      Side: 1
    }
  });
  const [showSidesRadialPicker, setShowSidesRadialPicker] = useState(false);
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
  const [showSidePicker, setShowSidePicker] = useState(false);
  const [sidePickerParentMeal, setSidePickerParentMeal] = useState<PlannedMeal | null>(null);
  const [mealPrepPopupMealId, setMealPrepPopupMealId] = useState<string | null>(null);
  const cachedCandidateRecipes = useRef<Recipe[]>([]);
  const cachedRecipeLookupMap = useRef<Map<string, Recipe>>(new Map());

  const [swapPreviewRecipeId, setSwapPreviewRecipeId] = useState<string | null>(null);
  const [previewOverrides, setPreviewOverrides] = useState<IngredientOverride[]>([]);
  const [previewSwapIngredient, setPreviewSwapIngredient] = useState<string>("");
  const [previewSwapPopupOpen, setPreviewSwapPopupOpen] = useState(false);

  const SUPABASE_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack/Appetizer', 'Side'] as const;
  const BATCH_SIZE = 7;
  const MAX_FETCH_ITERATIONS = 10;

  const seenRecipeIds = useRef<Record<string, Set<string>>>({
    'Breakfast': new Set(),
    'Lunch': new Set(),
    'Dinner': new Set(),
    'Dessert': new Set(),
    'Snack/Appetizer': new Set(),
    'Side': new Set(),
  });

  const batchOffsets = useRef<Record<string, number>>({
    'Breakfast': 0,
    'Lunch': 0,
    'Dinner': 0,
    'Dessert': 0,
    'Snack/Appetizer': 0,
    'Side': 0,
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

  // Find duplicate instances of the same recipe (with same sides) in the current week
  const getWeekDuplicateMeals = (meal: PlannedMeal): PlannedMeal[] => {
    const weekDates = days.map(d => format(d, 'yyyy-MM-dd'));
    const mealSideIds = getSidesForMeal(meal.id)
      .map(s => s.recipeId)
      .sort()
      .join(',');

    return planner.filter(m => {
      if (m.id === meal.id) return false;
      if (!weekDates.includes(m.date)) return false;
      if (m.recipeId !== meal.recipeId) return false;
      if (m.parentMealId) return false; // skip side entries
      const otherSideIds = getSidesForMeal(m.id)
        .map(s => s.recipeId)
        .sort()
        .join(',');
      return otherSideIds === mealSideIds;
    });
  };

  const handleCookClick = (meal: PlannedMeal) => {
    const duplicates = getWeekDuplicateMeals(meal);
    if (duplicates.length > 0) {
      setMealPrepPopupMealId(meal.id);
    } else {
      setLocation(`/recipe/${meal.recipeId}?cookMealId=${meal.id}&tab=steps`);
    }
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
      // Only reduce pantry for freshly cooked meals, NOT leftovers
      if (!meal.isLeftover) {
        acceleratePantryDecay(recipe.ingredients.map(i => i.name));
      }

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
          sourceType: meal.isLeftover ? 'leftover_eaten' : 'cooknow_logged_recipe',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
      } catch (e) {
      }

      toast({
        title: meal.isLeftover ? "Leftovers eaten!" : "Marked as cooked",
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
      const isSupplementalType = supabaseMealType === 'Dessert' || supabaseMealType === 'Snack/Appetizer';
      if (isPro && prefs.macroGoals && !isSupplementalType) {
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
    if (!previewWeek || isFetchingCandidates) return;
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

    // Separate main meals from sides
    const mainMeals = previewWeek.meals.filter(m => !m.parentMealId);
    const sideMeals = previewWeek.meals.filter(m => !!m.parentMealId);

    // Map preview IDs to real planner IDs
    const previewToPlannerId = new Map<string, string>();

    let addedCount = 0;
    // First pass: commit main meals
    for (const meal of mainMeals) {
      const mealDate = format(addDays(weekStart, meal.dayIndex), 'yyyy-MM-dd');

      const existingPlannerMeal = planner.find(m =>
        m.date === mealDate && m.mealType === meal.mealType && !m.parentMealId
      );

      if (existingPlannerMeal && existingPlannerMeal.recipeId === meal.recipeId) {
        previewToPlannerId.set(meal.id, existingPlannerMeal.id);
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

      // Find the newly added meal in planner state to get its real ID
      const currentPlanner = useDemoStore.getState().planner;
      const justAdded = currentPlanner.find(m =>
        m.recipeId === meal.recipeId && m.date === mealDate && m.mealType === meal.mealType && !m.parentMealId
      );
      if (justAdded) {
        previewToPlannerId.set(meal.id, justAdded.id);
      }
      addedCount++;
    }

    // Second pass: commit side meals
    for (const side of sideMeals) {
      const parentPlannerId = previewToPlannerId.get(side.parentMealId!);
      if (!parentPlannerId) continue;

      const mealDate = format(addDays(weekStart, side.dayIndex), 'yyyy-MM-dd');
      addSideToMeal(parentPlannerId, {
        recipeId: side.recipeId,
        servings: side.servings || 1,
        date: mealDate,
        dayIndex: side.dayIndex,
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
      {/* Transparent toolbar (no bg/divider) so the body bloom flows through the whole
          planner — mirrors the .dark .bg-background.border-b override, but for light too. */}
      <div className="z-10">
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
            
          </div>

          {!macrosSet && (
            <Card className="bg-amber-50 border-amber-200 mb-3" data-testid="banner-macros-not-set">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <p className="text-sm text-amber-800">
                  Macros not set — planning is limited until you finish setup.
                </p>
                <Button 
                  size="sm"
                  onClick={() => setLocation("/macro-wizard?from=/plan")}
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
            
            // Macro targets are visible to every tier; only the auto calculator
            // (wizard Guide Me) stays Pro.
            const goalCalories = profile?.targetCalories
              ? profile.targetCalories
              : (profile?.calorieGoal ? profile.calorieGoal : totalPlanned);
            const goalProtein = profile?.targetProtein || 0;
            const goalCarbs = profile?.targetCarbs || 0;
            const goalFat = profile?.targetFat || 0;

            return (
              <CalorieCounterCard
                macrosSet={macrosSet}
                goalCalories={goalCalories}
                goalProtein={goalProtein}
                goalCarbs={goalCarbs}
                goalFat={goalFat}
                consumed={todayMacros}
                onFinishSetup={() => setLocation("/macro-wizard?from=/plan")}
                onUpdateGoals={handleUpdateGoals}
              />
            );
          })()}

              <Button 
                onClick={handleOpenAutoPopulate}
                disabled={isFetchingCandidates}
                className="w-full mt-3 text-white rounded-full font-bold py-3 border-0 bg-[#ff6300]"
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
            <div className="space-y-4">
              {days.map((day, dayIdx) => {
                const dayDate = format(day, 'yyyy-MM-dd');
                const dayMeals = getMealsForDay(dayDate);
                const dayCalories = getDayCalories(dayIdx);
                const dayMacrosDisplay = getDayMacrosDisplay(dayIdx);
                const isToday = dayDate === today;
                
                return (
                  <Card key={day.toISOString()} className="border-0 rp-card-depth overflow-hidden" data-testid={`card-day-${format(day, 'yyyy-MM-dd')}`}>
                    <div className="bg-gradient-to-r from-[#ff8533] via-[#ff6300] to-[#e85500] px-4 py-3 text-white">
                      {isToday && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/90 text-[#ff6300] w-fit mb-1">Today</span>}
                      <div className="text-[15px] font-bold">{format(day, "EEEE, MMM d")}</div>
                      {dayCalories > 0 && (
                        <DailyTotalTrack className="mt-2">
                          <span className="flex gap-1 flex-wrap" data-testid={`macros-day-${dayIdx}`}>
                            <MacroChip label={`P ${dayMacrosDisplay.protein}g`} color="#ff6300" />
                            <MacroChip label={`C ${dayMacrosDisplay.carbs}g`} color="#2ecc71" />
                            <MacroChip label={`F ${dayMacrosDisplay.fat}g`} color="#3498db" />
                            <MacroChip label={`${dayCalories} cal`} color="#e67e22" />
                          </span>
                        </DailyTotalTrack>
                      )}
                    </div>
                    <CardContent className="space-y-2">
                      {mealSlots.map((mealType) => {
                        const mealsOfType = dayMeals.filter(m => m.mealType === mealType && !m.parentMealId);
                        
                        return (
                          <div key={mealType} className="space-y-1">
                            <div className="flex items-center justify-between py-1">
                              <span className="text-xs text-muted-foreground font-medium meal-slot-label">{mealType}</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-xs gap-1"
                                onClick={() => setLocation(`/recipes?mealType=${mealTypeToFilterParam[mealType] || mealType}`)}
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
                                <Fragment key={meal.id}>
                                <div
                                  className={`-mx-3 px-3 py-2.5 rounded-lg relative ${isCooked ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted'}`}
                                  data-testid={`meal-${meal.id}`}
                                >
                                  <button
                                    className="absolute -top-2.5 -right-2.5 z-10 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                                    onClick={() => handleRemoveMeal(meal.id)}
                                    data-testid={`button-remove-${meal.id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  {/* Top row: image + text + buttons */}
                                  <div className="flex gap-2">
                                    <img
                                      src={recipe.image}
                                      alt={recipe.title}
                                      className="w-10 h-10 rounded object-cover cursor-pointer flex-shrink-0"
                                      onClick={() => setLocation(`/recipe/${recipe.id}`)}
                                    />
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                      <p className="text-[10px] text-muted-foreground leading-tight meal-slot-label">{mealType}</p>
                                      <p className="text-xs font-medium truncate">{recipe.title}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        <span>{meal.servings || 1} {(meal.servings || 1) === 1 ? 'serving' : 'servings'}</span>
                                        {isCooked && <span className="ml-1 text-green-600">(Cooked)</span>}
                                        {meal.isLeftover && <span className="ml-1 text-green-600 font-medium" data-testid={`leftover-badge-committed-${meal.id}`}>· Leftovers</span>}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ gap: '7.5px' }}>
                                      {!isCooked && (
                                        <Button
                                          size="sm"
                                          className="border-0 gap-0 bg-[#3b82f6] hover:opacity-90 text-white px-[9px] py-[5px] min-h-0 w-full rounded-full font-bold"
                                          onClick={() => handleOpenSwapFork('planner', meal)}
                                          data-testid={`button-detail-${meal.id}`}
                                        >
                                          <Repeat className="w-3 h-3 text-white" />
                                          <span className="text-[10px] font-medium text-white ml-1">Swap</span>
                                        </Button>
                                      )}
                                      {!isCooked && !meal.isLeftover && (
                                        <Button
                                          size="sm"
                                          className="border-0 gap-0 bg-[#16a34a] hover:opacity-90 text-white px-[9px] py-[5px] min-h-0 w-full rounded-full font-bold"
                                          onClick={() => handleCookClick(meal)}
                                          data-testid={`button-cook-${meal.id}`}
                                        >
                                          <ChefHat className="w-3 h-3 text-white" />
                                          <span className="text-[10px] font-medium text-white ml-1">Cook</span>
                                        </Button>
                                      )}
                                      {!isCooked && meal.isLeftover && (
                                        <Button
                                          size="sm"
                                          className="border-0 gap-0 bg-[#16a34a] hover:opacity-90 text-white px-[9px] py-[5px] min-h-0 w-full rounded-full font-bold"
                                          onClick={() => handleMarkCooked(meal)}
                                          data-testid={`button-eat-${meal.id}`}
                                        >
                                          <UtensilsCrossed className="w-3 h-3 text-white" />
                                          <span className="text-[10px] font-medium text-white ml-1">Eat</span>
                                        </Button>
                                      )}
                                      {isCooked && (
                                        <Button
                                          size="sm"
                                          className="border-0 gap-0 bg-[#ef4444] hover:opacity-90 text-white px-[9px] py-[5px] min-h-0 w-full rounded-full font-bold"
                                          onClick={() => handleUndoCooked(meal)}
                                          data-testid={`button-undo-cooked-${meal.id}`}
                                        >
                                          <Undo2 className="w-3 h-3 text-white" />
                                          <span className="text-[10px] font-medium text-white ml-1">Undo</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {/* Nutrient boxes — full width below the row (all tiers) */}
                                  <div className="flex gap-1 mt-2" data-testid={`meal-macros-${meal.id}`}>
                                      <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[36px]">
                                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#ff6300] to-[#ff8533]" />
                                        <p className="text-[12px] font-extrabold text-[#ff6300] leading-none mt-0.5">{mealNutrition.protein}g</p>
                                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Protein</p>
                                      </div>
                                      <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[36px]">
                                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2ecc71] to-[#27ae60]" />
                                        <p className="text-[12px] font-extrabold text-[#2ecc71] leading-none mt-0.5">{mealNutrition.carbs}g</p>
                                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Carbs</p>
                                      </div>
                                      <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[36px]">
                                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#3498db] to-[#2980b9]" />
                                        <p className="text-[12px] font-extrabold text-[#3498db] leading-none mt-0.5">{mealNutrition.fat}g</p>
                                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Fat</p>
                                      </div>
                                      <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[36px]">
                                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#f1c40f] to-[#e67e22]" />
                                        <p className="text-[12px] font-extrabold text-[#e67e22] leading-none mt-0.5">{mealNutrition.calories}</p>
                                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Calories</p>
                                      </div>
                                    </div>
                                  {/* === SIDES SECTION === */}
                                  {(() => {
                                    const sides = getSidesForMeal(meal.id);
                                    const hasSides = sides.length > 0;
                                    return (
                                      <>
                                        {hasSides && (
                                          <div className="mt-2 border border-[rgba(255,99,0,0.2)] rounded-lg overflow-visible bg-[rgba(255,99,0,0.03)]">
                                            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-[#ff6300] uppercase tracking-wide border-b border-[rgba(255,99,0,0.1)]">
                                              Sides
                                            </div>
                                            {sides.map(side => {
                                              const sideRecipe = getRecipeById(side.recipeId);
                                              if (!sideRecipe) return null;
                                              return (
                                                <SideMealCard
                                                  key={side.id}
                                                  recipe={sideRecipe}
                                                  servings={side.servings}
                                                  onSwap={() => {
                                                    setSidePickerParentMeal(meal);
                                                    removeSideFromMeal(side.id);
                                                    setShowSidePicker(true);
                                                  }}
                                                  onRemove={() => removeSideFromMeal(side.id)}
                                                  onClickImage={() => setLocation(`/recipe/${sideRecipe.id}`)}
                                                />
                                              );
                                            })}
                                            <div className="px-2 py-1.5 text-center">
                                              <button
                                                className="flex items-center justify-center gap-1 w-full text-[11px] font-semibold text-[#ff6300] py-1 border border-dashed border-[rgba(255,99,0,0.3)] rounded-md hover:bg-[rgba(255,99,0,0.05)]"
                                                onClick={() => {
                                                  setSidePickerParentMeal(meal);
                                                  setShowSidePicker(true);
                                                }}
                                              >
                                                <Plus className="w-3 h-3" />
                                                Add Side
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                        {!hasSides && !isCooked && (
                                          <button
                                            className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground hover:text-foreground py-0.5"
                                            onClick={() => {
                                              setSidePickerParentMeal(meal);
                                              setShowSidePicker(true);
                                            }}
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>Add Side</span>
                                          </button>
                                        )}
                                        {hasSides && (() => {
                                          const mainN = mealNutrition;
                                          const sidesN = sides.reduce((acc, s) => {
                                            const n = getMealNutrition(s);
                                            return {
                                              calories: acc.calories + n.calories,
                                              protein: acc.protein + n.protein,
                                              carbs: acc.carbs + n.carbs,
                                              fat: acc.fat + n.fat,
                                            };
                                          }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
                                          return (
                                            <MealTotalRow nutrition={{
                                              calories: mainN.calories + sidesN.calories,
                                              protein: mainN.protein + sidesN.protein,
                                              carbs: mainN.carbs + sidesN.carbs,
                                              fat: mainN.fat + sidesN.fat,
                                            }} />
                                          );
                                        })()}
                                      </>
                                    );
                                  })()}
                                </div>

                                {/* Meal Prep inline toast popup */}
                                {mealPrepPopupMealId === meal.id && (() => {
                                  const duplicates = getWeekDuplicateMeals(meal);
                                  const totalCount = duplicates.length + 1;
                                  const sides = getSidesForMeal(meal.id);
                                  const dayLabels = [meal, ...duplicates]
                                    .sort((a, b) => a.date.localeCompare(b.date))
                                    .map(m => format(new Date(m.date + 'T12:00:00'), 'EEE'));

                                  return (
                                    <div className="relative mt-2">
                                      {/* Arrow pointing up */}
                                      <div className="absolute -top-[6px] right-6 w-3 h-3 bg-white rotate-45 shadow-[-2px_-2px_4px_rgba(0,0,0,0.06)] z-[1]" />

                                      <div className="relative z-[2] bg-white rounded-2xl p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] border border-gray-200">
                                        <button
                                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 text-xs"
                                          onClick={() => setMealPrepPopupMealId(null)}
                                        >
                                          <X className="w-3 h-3" />
                                        </button>

                                        <div className="flex gap-2.5 mb-3">
                                          <img
                                            src={recipe.image}
                                            alt={recipe.title}
                                            className="w-11 h-11 rounded-[10px] object-cover flex-shrink-0"
                                          />
                                          <div>
                                            <p className="text-[13px] font-bold leading-tight">{recipe.title}</p>
                                            <div className="flex gap-1 mt-1 flex-wrap">
                                              {dayLabels.map((day, i) => (
                                                <span key={i} className="inline-flex items-center px-2 py-[2px] rounded-full text-[10px] font-bold text-white bg-gradient-to-b from-[#ff8533] to-[#ff6300]">
                                                  {day}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        </div>

                                        {sides.length > 0 && (
                                          <p className="text-[10px] text-gray-400 mb-2">
                                            <span className="font-semibold">Side:</span>{' '}
                                            {sides.map(s => getRecipeById(s.recipeId)?.title).filter(Boolean).join(', ')}
                                          </p>
                                        )}

                                        <p className="text-[12px] text-gray-500 leading-snug mb-3">
                                          Planned for <strong className="text-gray-900">{totalCount} days</strong> this week. Meal prep or cook single?
                                        </p>

                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            className="flex-1 border-0 gap-1 bg-[#ff6300] hover:opacity-90 text-white py-2.5 min-h-0 rounded-full font-bold text-[12px]"
                                            onClick={() => {
                                              const allMealIds = [meal.id, ...duplicates.map(d => d.id)];
                                              setMealPrepPopupMealId(null);
                                              setLocation(`/recipe/${meal.recipeId}?cookMealId=${meal.id}&tab=steps&mealPrep=${allMealIds.join(',')}&mealPrepCount=${totalCount}`);
                                            }}
                                          >
                                            <svg width="14" height="12" viewBox="0 0 28 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="9" cy="16" rx="8" ry="3"/><path d="M1 16v0c0-5 3.5-9 8-9s8 4 8 9"/><ellipse cx="19" cy="14" rx="8" ry="3" opacity="0.5"/><path d="M11 14v0c0-5 3.5-9 8-9s8 4 8 9" opacity="0.5"/></svg>
                                            Meal Prep
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="flex-1 border-0 gap-1 bg-[#16a34a] hover:opacity-90 text-white py-2.5 min-h-0 rounded-full font-bold text-[12px]"
                                            onClick={() => {
                                              setMealPrepPopupMealId(null);
                                              setLocation(`/recipe/${meal.recipeId}?cookMealId=${meal.id}&tab=steps`);
                                            }}
                                          >
                                            <svg width="14" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="17" rx="9" ry="3.5"/><path d="M3 17v0c0-5.5 4-10 9-10s9 4.5 9 10"/><line x1="12" y1="3" x2="12" y2="7"/></svg>
                                            Cook Single
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}

                                </Fragment>
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
        <DialogContent className="w-[calc(100%-1rem)] max-w-[450px] max-h-[90vh] overflow-hidden p-0 flex flex-col [&>button.absolute]:hidden" overlayClassName="bg-black/35 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '28px', border: 'none', boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)' }} data-testid="dialog-preview-overlay">
          {/* Orange gradient header with centered title + BLD servings */}
          <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #ff6300 0%, #ff9500 100%)', borderRadius: '28px 28px 0 0' }}>
            <div className="flex justify-center items-start relative">
              <div className="text-center">
                <DialogHeader className="p-0 space-y-0">
                  <DialogTitle className="text-xl font-extrabold text-white tracking-tight">Preview Your Week</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-white/75 mt-0.5">Review, tweak, then confirm</p>
              </div>
              <button
                onClick={() => setShowPreviewOverlay(false)}
                className="absolute right-0 top-0 w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            {/* BLD serving steppers — white pill cards (chosen mockup variant 01) with the
                app's flat-pill orange +/- buttons. Inline white bg + inline orange count
                keep them theme-independent: the .dark `bg-white`→card and `text-[#ff6300]`
                →macro remaps would otherwise repaint them inside this light-styled modal.
                The buttons carry `bg-[#ff6300]` so the app-wide flat-pill CSS (solid orange,
                white icon, full-pill, press cue) applies automatically when enabled. */}
            <div className="flex gap-2 mt-4">
              {(['Breakfast', 'Lunch', 'Dinner'] as AutoPopulateMealType[]).map(mealType => (
                <div key={mealType} className="flex-1 text-center rounded-full px-3 py-2.5" style={{ background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>{mealType}</p>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <button
                      onClick={() => updateServings(mealType, -1)}
                      disabled={generationSettings.servings[mealType] <= 1}
                      className="bg-[#ff6300] w-7 h-7 rounded-full flex items-center justify-center text-white disabled:opacity-40"
                      style={{ background: '#ff6300' }}
                      data-testid={`button-servings-${mealType.toLowerCase()}-minus`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-lg font-extrabold w-8 text-center" style={{ color: '#ff6300' }}>
                      {generationSettings.servings[mealType] >= 10 ? '10+' : generationSettings.servings[mealType]}
                    </span>
                    <button
                      onClick={() => updateServings(mealType, 1)}
                      disabled={generationSettings.servings[mealType] >= 10}
                      className="bg-[#ff6300] w-7 h-7 rounded-full flex items-center justify-center text-white disabled:opacity-40"
                      style={{ background: '#ff6300' }}
                      data-testid={`button-servings-${mealType.toLowerCase()}-plus`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isFetchingCandidates && !previewWeek && (
            <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="preview-loading">
              <Loader2 className="w-8 h-8 animate-spin text-[#ff6300]" />
              <p className="text-sm text-muted-foreground">Loading recipes...</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide space-y-4 w-full min-w-0 px-2.5 pt-3 pb-3" style={{ display: isFetchingCandidates && !previewWeek ? 'none' : undefined }}>

            {/* Centered toggle chips for Desserts, Snackitizers, Auto Sides */}
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                onClick={async () => {
                  const checked = !generationSettings.addDesserts;
                  const newSettings = {
                    ...generationSettings,
                    addDesserts: checked,
                    servings: { ...generationSettings.servings, Desserts: 1 }
                  };
                  setGenerationSettings(newSettings);
                  if (previewWeek && checked) {
                    const userPrefs = buildUserPrefs();
                    // Reset Dessert fetch state so we pull fresh from offset 0
                    seenRecipeIds.current['Dessert'] = new Set();
                    batchOffsets.current['Dessert'] = 0;
                    await fetchBatchForMealType('Dessert', userPrefs);
                    // Pass ALL existing meals (not just locked) so only Dessert slots are generated
                    const allExistingSlots = previewWeek.meals.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType, recipeId: m.recipeId, servings: m.servings }));
                    const generated = generateWeekPlan(newSettings, userPrefs, pantry || [], favorites || [], allExistingSlots, cachedCandidateRecipes.current);
                    // Append only the new Dessert meals to the existing preview
                    const newDessertMeals = generated.meals.filter(gm => gm.mealType === 'Desserts');
                    const mergedMeals = [...previewWeek.meals, ...newDessertMeals];
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
                className={`rp-sc-chip ${generationSettings.addDesserts ? 'is-active' : ''}`}
                data-testid="checkbox-add-desserts"
              >{generationSettings.addDesserts ? '✓ Desserts' : '+ Desserts'}</button>
              <button
                onClick={async () => {
                  const checked = !generationSettings.addSnackitizers;
                  const newSettings = {
                    ...generationSettings,
                    addSnackitizers: checked,
                    servings: { ...generationSettings.servings, Snackitizers: 1 }
                  };
                  setGenerationSettings(newSettings);
                  if (previewWeek && checked) {
                    const userPrefs = buildUserPrefs();
                    // Reset Snack/Appetizer fetch state so we pull fresh from offset 0
                    seenRecipeIds.current['Snack/Appetizer'] = new Set();
                    batchOffsets.current['Snack/Appetizer'] = 0;
                    await fetchBatchForMealType('Snack/Appetizer', userPrefs);
                    // Pass ALL existing meals (not just locked) so only Snackitizer slots are generated
                    const allExistingSlots = previewWeek.meals.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType, recipeId: m.recipeId, servings: m.servings }));
                    const generated = generateWeekPlan(newSettings, userPrefs, pantry || [], favorites || [], allExistingSlots, cachedCandidateRecipes.current);
                    // Append only the new Snackitizer meals to the existing preview
                    const newSnackMeals = generated.meals.filter(gm => gm.mealType === 'Snackitizers');
                    const mergedMeals = [...previewWeek.meals, ...newSnackMeals];
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
                className={`rp-sc-chip ${generationSettings.addSnackitizers ? 'is-active' : ''}`}
                data-testid="checkbox-add-snackitizers"
              >{generationSettings.addSnackitizers ? '✓ Snackitizers' : '+ Snackitizers'}</button>
              <button
                onClick={() => setShowSidesRadialPicker(true)}
                className={`rp-sc-chip ${generationSettings.addSides ? 'is-active' : ''}`}
                data-testid="checkbox-add-sides"
              >{generationSettings.addSides ? '✓ Add Sides' : '+ Add Sides'}</button>
            </div>

            {/* Optional Desserts/Snackitizers serving steppers */}
            {(generationSettings.addDesserts || generationSettings.addSnackitizers) && (
              <div className="flex gap-2 justify-center">
                {(['Desserts', 'Snackitizers'] as AutoPopulateMealType[])
                  .filter(mealType => {
                    if (mealType === 'Desserts') return generationSettings.addDesserts;
                    if (mealType === 'Snackitizers') return generationSettings.addSnackitizers;
                    return false;
                  })
                  .map(mealType => (
                  /* Same white-pill treatment as the BLD steppers above, but GREEN accent
                     (green flat-pill +/- buttons + green count) instead of orange. */
                  <div key={mealType} className="flex-1 max-w-[160px] text-center rounded-full px-3 py-2.5" style={{ background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>{mealType}</p>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <button
                        onClick={() => updateServings(mealType, -1)}
                        disabled={generationSettings.servings[mealType] <= 1}
                        className="bg-[#16a34a] w-7 h-7 rounded-full flex items-center justify-center text-white disabled:opacity-40"
                        style={{ background: '#16a34a' }}
                        data-testid={`button-servings-${mealType.toLowerCase()}-minus`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-lg font-extrabold w-8 text-center" style={{ color: '#16a34a' }}>
                        {generationSettings.servings[mealType] >= 10 ? '10+' : generationSettings.servings[mealType]}
                      </span>
                      <button
                        onClick={() => updateServings(mealType, 1)}
                        disabled={generationSettings.servings[mealType] >= 10}
                        className="bg-[#16a34a] w-7 h-7 rounded-full flex items-center justify-center text-white disabled:opacity-40"
                        style={{ background: '#16a34a' }}
                        data-testid={`button-servings-${mealType.toLowerCase()}-plus`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {previewWeek && (
              <div className="space-y-3 pt-1">
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const dayMeals = previewWeek.meals.filter(m => m.dayIndex === dayIdx);
                  if (dayMeals.length === 0) return null;

                  return (
                    <div key={dayIdx} className="overflow-visible" data-testid={`preview-day-${dayIdx}`}>
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
                          <>
                            {/* Orange gradient day header */}
                            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-t-[14px] text-white" style={{ background: 'linear-gradient(to right, #ff8533, #ff6300, #e85500)' }} data-testid={`preview-day-totals-${dayIdx}`}>
                              <span className="text-[13px] font-bold">
                                {format(addDays(weekStart, dayIdx), "EEEE, MMM d")}
                              </span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                            {/* Daily Total — solid-saturated track (matches the main planner tab) */}
                            <div className="px-2.5 py-2 bg-[#fafafa] dark:bg-muted border-x border-gray-200 dark:border-gray-700">
                              <DailyTotalTrack>
                                <span className="flex gap-1 flex-wrap">
                                  <MacroChip label={`P ${dayTotals.protein}g`} color="#ff6300" testId={`preview-day-protein-${dayIdx}`} />
                                  <MacroChip label={`C ${dayTotals.carbs}g`} color="#2ecc71" testId={`preview-day-carbs-${dayIdx}`} />
                                  <MacroChip label={`F ${dayTotals.fat}g`} color="#3498db" testId={`preview-day-fat-${dayIdx}`} />
                                  <MacroChip label={`${dayTotals.calories} cal`} color="#e67e22" testId={`preview-day-cal-${dayIdx}`} />
                                </span>
                              </DailyTotalTrack>
                            </div>
                          </>
                        );
                      })()}
                      <div className="border-x border-b border-gray-200 dark:border-gray-700 rounded-b-[14px] overflow-visible">
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
                              className={`px-3 py-2.5 relative overflow-visible border-t border-gray-100 dark:border-gray-700 ${isLocked ? 'bg-green-50 dark:bg-green-950/20 ring-1 ring-inset ring-green-300 dark:ring-green-700' : 'bg-white dark:bg-muted'}`}
                              data-testid={`preview-meal-${meal.id}`}
                            >
                              {/* Red X remove button */}
                              {!isLocked && (
                                <button
                                  onClick={() => {
                                    if (!previewWeek) return;
                                    const filteredMeals = previewWeek.meals.filter(m => m.id !== meal.id);
                                    const newTotals = calculateProjectedTotals(filteredMeals, generationSettings.servings, cachedRecipeLookupMap.current);
                                    setPreviewWeek({ meals: filteredMeals, projectedTotals: newTotals });
                                  }}
                                  className="absolute -top-2.5 -right-2.5 z-10 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                                  data-testid={`button-remove-meal-${meal.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              <div className="flex gap-2.5 min-w-0">
                                {/* Recipe image */}
                                <img
                                  src={recipe.image}
                                  alt={recipe.title}
                                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                                />
                                {/* Left-aligned meal info */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-left meal-slot-label">{mealType}</p>
                                  <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate text-left">{recipe.title}</p>
                                  <p className="text-[10px] text-gray-400 text-left">
                                    {meal.servings || 1} {(meal.servings || 1) === 1 ? 'serving' : 'servings'}
                                    {meal.isLeftover && <span className="ml-1 text-green-600 font-medium" data-testid={`leftover-badge-${meal.id}`}>· Leftovers</span>}
                                  </p>
                                </div>
                                {/* Swap / Lock buttons with 2.5px extra gap */}
                                <div className="flex flex-col flex-shrink-0 justify-center" style={{ gap: '7.5px' }}>
                                  {!isLocked && (
                                    <Button
                                      size="sm"
                                      className="border-0 bg-[#3b82f6] hover:opacity-90 text-white px-2 py-1 min-h-0 rounded-full font-bold"
                                      onClick={() => handleOpenSwapFork('preview', undefined, meal, dayIdx)}
                                      data-testid={`button-swap-meal-${meal.id}`}
                                    >
                                      <Repeat className="w-3 h-3 text-white" />
                                      <span className="text-[10px] font-medium text-white ml-1">Swap</span>
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    className="border-0 px-2 py-1 min-h-0 font-bold rounded-full bg-[#16a34a] hover:opacity-90 text-white"
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
                              {/* Per-meal nutrient boxes (planner-style with accent bars) */}
                              <div className="flex gap-1 mt-2 mr-[5px]" data-testid={`preview-meal-macros-${meal.id}`}>
                                <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[30px]">
                                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(to right, #ff6300, #ff8533)' }} />
                                  <p className="text-[10px] font-extrabold text-[#ff6300] leading-none mt-0.5" data-testid={`preview-meal-protein-${meal.id}`}>{Math.round((recipe.protein || 0) * meal.servings)}g</p>
                                  <p className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Protein</p>
                                </div>
                                <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[30px]">
                                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(to right, #2ecc71, #27ae60)' }} />
                                  <p className="text-[10px] font-extrabold text-[#2ecc71] leading-none mt-0.5" data-testid={`preview-meal-carbs-${meal.id}`}>{Math.round((recipe.carbs || 0) * meal.servings)}g</p>
                                  <p className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Carbs</p>
                                </div>
                                <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[30px]">
                                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(to right, #3498db, #2980b9)' }} />
                                  <p className="text-[10px] font-extrabold text-[#3498db] leading-none mt-0.5" data-testid={`preview-meal-fat-${meal.id}`}>{Math.round((recipe.fat || 0) * meal.servings)}g</p>
                                  <p className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Fat</p>
                                </div>
                                <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[30px]">
                                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(to right, #f1c40f, #e67e22)' }} />
                                  <p className="text-[10px] font-extrabold text-[#e67e22] leading-none mt-0.5" data-testid={`preview-meal-cal-${meal.id}`}>{Math.round((recipe.calories || 0) * meal.servings)}</p>
                                  <p className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Calories</p>
                                </div>
                              </div>

                              {/* Preview side meals attached to this parent */}
                              {(() => {
                                const sideMealsForParent = dayMeals.filter(m => m.mealType === 'Side' && m.parentMealId === meal.id);
                                if (sideMealsForParent.length === 0) return null;
                                return (
                                  <div className="mt-2 border border-[rgba(255,99,0,0.2)] rounded-lg overflow-hidden bg-[rgba(255,99,0,0.03)]">
                                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-[#ff6300] uppercase tracking-wide border-b border-[rgba(255,99,0,0.1)]">
                                      Side
                                    </div>
                                    {sideMealsForParent.map(side => {
                                      const sideRecipe = getRecipeById(side.recipeId);
                                      if (!sideRecipe) return null;
                                      return (
                                        <div key={side.id} className="flex items-center gap-2 px-2 py-1.5">
                                          <img src={sideRecipe.image} alt={sideRecipe.title} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium truncate">{sideRecipe.title}</p>
                                            <p className="text-[9px] text-muted-foreground">{Math.round((sideRecipe.calories || 0) * side.servings)} cal</p>
                                          </div>
                                          <button
                                            onClick={() => {
                                              if (!previewWeek) return;
                                              const filteredMeals = previewWeek.meals.filter(m => m.id !== side.id);
                                              const newTotals = calculateProjectedTotals(filteredMeals, generationSettings.servings, cachedRecipeLookupMap.current);
                                              setPreviewWeek({ meals: filteredMeals, projectedTotals: newTotals });
                                            }}
                                            className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
          {/* Sticky bottom action buttons — always visible */}
          <div className="flex-shrink-0 flex gap-2.5 px-5 py-4 border-t border-gray-100 bg-white" style={{ borderRadius: '0 0 28px 28px' }}>
            <Button
              className="flex-1 h-12 border-0 bg-[#16a34a] hover:opacity-90 text-white font-bold text-[13px] rounded-full"
              onClick={handleRegenerate}
              data-testid="button-regenerate"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetchingCandidates ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
            <Button
              className="flex-1 h-12 border-0 bg-[#ff6300] hover:opacity-90 text-white font-bold text-[13px] rounded-full"
              onClick={handleConfirmPlan}
              data-testid="button-confirm-plan"
            >
              Confirm Plan
            </Button>
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
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} data-testid="dialog-swap-meal">
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
                              className="h-6 px-2 py-1 gap-1 border-0 bg-[#3b82f6] hover:opacity-90 text-white text-[10px] font-medium rounded-full flex-shrink-0"
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
                      className="flex-1 border-0 bg-[#ef4444] hover:opacity-90 text-white py-1 min-h-0 rounded-full font-bold"
                      onClick={() => {
                        setSwapPreviewRecipeId(null);
                        setPreviewOverrides([]);
                      }}
                      data-testid="button-swap-preview-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 border-0 bg-[#16a34a] hover:opacity-90 text-white py-1 min-h-0 rounded-full font-bold"
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
        <DialogContent
          className="max-w-[280px] p-0"
          style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          data-testid="dialog-swap-fork"
        >
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <ArrowLeftRight className="w-5 h-5 text-gray-600" />
              <DialogTitle className="text-center text-base font-bold text-gray-800">What to swap?</DialogTitle>
            </div>
            <p className="text-center text-[11px] font-semibold text-gray-700">Choose how you'd like to change this meal</p>
          </div>
          <div className="flex flex-col gap-2.5 px-5 pb-6 pt-2">
            <button
              onClick={handleSwapForkIngredients}
              data-testid="button-swap-ingredients"
              className="w-full rounded-full py-3 px-5 bg-[#16a34a] text-white"
            >
              <div className="flex items-center justify-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-white/90" />
                <span className="text-[15px] font-bold text-white">Swap Ingredients</span>
              </div>
            </button>
            <button
              onClick={handleSwapForkRecipe}
              data-testid="button-swap-recipe"
              className="w-full rounded-full py-3 px-5 bg-[#3b82f6] text-white"
            >
              <div className="flex items-center justify-center gap-2">
                <Repeat className="w-4 h-4 text-white/90" />
                <span className="text-[15px] font-bold text-white">Swap Recipe</span>
              </div>
            </button>
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

      <SidesRadialPicker
        open={showSidesRadialPicker}
        onClose={() => setShowSidesRadialPicker(false)}
        initialSelection={generationSettings.sidesMealTypes}
        onConfirm={async (selected) => {
          setShowSidesRadialPicker(false);
          const anySelected = selected.Breakfast || selected.Lunch || selected.Dinner;
          const newSettings: GenerationSettings = {
            ...generationSettings,
            addSides: anySelected,
            sidesMealTypes: selected,
          };
          setGenerationSettings(newSettings);

          if (previewWeek) {
            // Remove existing sides first
            const mealsWithoutSides = previewWeek.meals.filter(m => m.mealType !== 'Side');
            const removedIds = previewWeek.meals.filter(m => m.mealType === 'Side').map(m => m.id);
            const newLocked = new Set(lockedMealIds);
            removedIds.forEach(id => newLocked.delete(id));
            setLockedMealIds(newLocked);

            if (anySelected) {
              // Fetch side recipes and regenerate sides for selected meal types
              const userPrefs = buildUserPrefs();
              seenRecipeIds.current['Side'] = new Set();
              batchOffsets.current['Side'] = 0;
              await fetchBatchForMealType('Side', userPrefs);
              const allExistingSlots = mealsWithoutSides.map(m => ({
                dayIndex: m.dayIndex, mealType: m.mealType, recipeId: m.recipeId, servings: m.servings
              }));
              // Build locked meal keys so generateWeekPlan skips them for sides
              const lockedKeys = new Set<string>();
              for (const m of mealsWithoutSides) {
                if (newLocked.has(m.id)) lockedKeys.add(`${m.dayIndex}-${m.mealType}`);
              }
              const generated = generateWeekPlan(newSettings, userPrefs, pantry || [], favorites || [], allExistingSlots, cachedCandidateRecipes.current, lockedKeys);
              // Remap side parentMealIds from "locked-X-MealType" to actual preview meal IDs
              const newSideMeals = generated.meals.filter(gm => gm.mealType === 'Side').map(side => {
                if (side.parentMealId?.startsWith('locked-')) {
                  const parent = mealsWithoutSides.find(m =>
                    side.parentMealId === `locked-${m.dayIndex}-${m.mealType}`
                  );
                  if (parent) return { ...side, parentMealId: parent.id };
                }
                return side;
              });
              const mergedMeals = [...mealsWithoutSides, ...newSideMeals];
              mergedMeals.sort((a, b) => a.dayIndex - b.dayIndex || a.mealType.localeCompare(b.mealType));
              const newTotals = calculateProjectedTotals(mergedMeals, newSettings.servings, cachedRecipeLookupMap.current);
              setPreviewWeek({ meals: mergedMeals, projectedTotals: newTotals });
            } else {
              // Just remove all sides
              const newTotals = calculateProjectedTotals(mealsWithoutSides, newSettings.servings, cachedRecipeLookupMap.current);
              setPreviewWeek({ meals: mealsWithoutSides, projectedTotals: newTotals });
            }
          }
        }}
      />

      {showSidePicker && sidePickerParentMeal && (() => {
        const parentRecipe = getRecipeById(sidePickerParentMeal.recipeId);
        if (!parentRecipe) return null;
        const allRecipesList = Object.values(storeRecipes);
        // Compute daily macro remaining for the parent meal's day
        const dayMeals = getMealsForDay(sidePickerParentMeal.date);
        const dayUsed = dayMeals.reduce((acc, m) => {
          const n = getMealNutrition(m);
          return { calories: acc.calories + n.calories, protein: acc.protein + n.protein, carbs: acc.carbs + n.carbs, fat: acc.fat + n.fat };
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
        const dailyMacroRemaining = {
          calories: Math.max(0, (profile?.calorieGoal || 2000) - dayUsed.calories),
          protein: Math.max(0, (profile?.targetProtein || 150) - dayUsed.protein),
          carbs: Math.max(0, (profile?.targetCarbs || 250) - dayUsed.carbs),
          fat: Math.max(0, (profile?.targetFat || 65) - dayUsed.fat),
        };
        return (
          <SidePickerModal
            open={showSidePicker}
            onOpenChange={(open) => {
              setShowSidePicker(open);
              if (!open) setSidePickerParentMeal(null);
            }}
            parentRecipe={parentRecipe}
            allRecipes={allRecipesList}
            dailyMacroRemaining={dailyMacroRemaining}
            onAddSide={(recipe, servings) => {
              addSideToMeal(sidePickerParentMeal.id, {
                recipeId: recipe.id,
                servings,
                date: sidePickerParentMeal.date,
                dayIndex: new Date(sidePickerParentMeal.date).getDay(),
              });
            }}
          />
        );
      })()}

    </div>
  );
}
