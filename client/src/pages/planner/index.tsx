import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, LayoutGrid, List, Flame, Lock, Calendar, Wand2, Minus, X, Search, RefreshCw, Repeat, UtensilsCrossed, ArrowLeftRight } from "lucide-react";
import { MealDetailPopup } from "@/components/meal-detail-popup";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { useDemoStore, MealType, PlannedMeal } from "@/lib/demo-store";
import { mockRecipes, Recipe } from "@/lib/mock-data";
import { useRecipeStore } from "@/lib/recipe-store";
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
  getSwapSuggestions,
  searchRecipesForMealType,
  calculateProjectedTotals
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

function CalorieRing({ remaining, total, size = 140, strokeWidth = 10 }: { remaining: number; total: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const eaten = total - remaining;
  const progress = total > 0 ? Math.min(eaten / total, 1) : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#calorieGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(245, 158, 11)" />
            <stop offset="100%" stopColor="rgb(217, 119, 6)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-display leading-none" data-testid="text-remaining-cal">{Math.max(remaining, 0).toLocaleString()}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Remaining</span>
      </div>
    </div>
  );
}

function MacroBar({ label, consumed, target, color, trackColor }: { label: string; consumed: number; target: number; color: string; trackColor: string }) {
  const left = Math.max(target - consumed, 0);
  const progress = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const testId = label.toLowerCase();
  return (
    <div className="flex-1 min-w-0" data-testid={`macro-bar-${testId}`}>
      <div className="flex items-baseline justify-between gap-1 mb-1">
        <span className="text-xs font-medium" data-testid={`text-macro-label-${testId}`}>{label}</span>
        <span className="text-xs text-muted-foreground" data-testid={`text-macro-left-${testId}`}>{left}g left</span>
      </div>
      <div className={`h-2 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
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
  
  const { planner, removeFromPlanner, acceleratePantryDecay, markMealCooked, getMealState, addToPlanner, pantry, favorites } = useDemoStore();

  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
  const [previewWeek, setPreviewWeek] = useState<GeneratedWeek | null>(null);
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
  const [selectedMealForDetail, setSelectedMealForDetail] = useState<PlannedMeal | null>(null);
  const [showMealDetail, setShowMealDetail] = useState(false);
  const [manualEntryExpanded, setManualEntryExpanded] = useState(false);
  const [showSwapFork, setShowSwapFork] = useState(false);
  const [swapForkTarget, setSwapForkTarget] = useState<{ 
    type: 'planner' | 'preview';
    plannerMeal?: PlannedMeal;
    previewMeal?: PreviewMeal;
    dayIndex?: number;
  } | null>(null);

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
    return storeRecipes[recipeId] || mockRecipes.find(r => r.id === recipeId);
  };

  const recipeLookup = useMemo((): RecipeLookup => {
    const lookup: RecipeLookup = {};
    mockRecipes.forEach(r => {
      lookup[r.id] = r;
    });
    Object.entries(storeRecipes).forEach(([id, recipe]) => {
      lookup[id] = recipe;
    });
    return lookup;
  }, [storeRecipes]);

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
    
    const mealsAsInput: PlannedMealInput[] = meals
      .filter(m => {
        const state = getMealState ? getMealState(m.id) : 'scheduled';
        if ((state === 'cooked' || state === 'autoCounted') && cookedLogRecipeIds.has(m.recipeId)) {
          return false;
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

  const [manualEntry, setManualEntry] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    date: today
  });

  const handleManualAdd = async () => {
    if (!manualEntry.name || !manualEntry.calories) {
      toast({ title: "Error", description: "Name and calories are required", variant: "destructive" });
      return;
    }
    
    try {
      await apiRequest('POST', '/api/consumption-logs', {
        date: manualEntry.date,
        name: manualEntry.name,
        calories: parseInt(manualEntry.calories),
        protein: parseInt(manualEntry.protein) || 0,
        carbs: parseInt(manualEntry.carbs) || 0,
        fat: parseInt(manualEntry.fat) || 0,
        sourceType: 'manual_custom_entry'
      });
      
      setManualEntry({ name: '', calories: '', protein: '', carbs: '', fat: '', date: today });
      toast({ title: "Added", description: "Manual entry added to your log" });
      queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add entry", variant: "destructive" });
    }
  };

  const handleOpenAutoPopulate = () => {
    const existingMeals = planner.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType }));
    const userPrefs = {
      allergies: [],
      dietaryRestrictions: [],
      cookingComfort: 'comfortable',
      costPreference: 'balanced',
      tools: []
    };
    const favoriteIds = favorites || [];
    
    const generated = generateWeekPlan(
      generationSettings,
      userPrefs,
      pantry || [],
      favoriteIds,
      existingMeals
    );
    
    setPreviewWeek(generated);
    setShowPreviewOverlay(true);
  };

  const handleRegenerate = () => {
    const existingMeals = planner.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType }));
    const userPrefs = {
      allergies: [],
      dietaryRestrictions: [],
      cookingComfort: 'comfortable',
      costPreference: 'balanced',
      tools: []
    };
    const favoriteIds = favorites || [];
    
    const generated = generateWeekPlan(
      generationSettings,
      userPrefs,
      pantry || [],
      favoriteIds,
      existingMeals
    );
    
    setPreviewWeek(generated);
    toast({ title: "Regenerated", description: "New meal suggestions created" });
  };

  const handleConfirmPlan = () => {
    if (!previewWeek) return;
    
    let addedCount = 0;
    for (const meal of previewWeek.meals) {
      const mealDate = format(addDays(weekStart, meal.dayIndex), 'yyyy-MM-dd');
      const slotOccupied = planner.some(m => 
        m.date === mealDate && m.mealType === meal.mealType
      );
      
      if (!slotOccupied) {
        addToPlanner({
          recipeId: meal.recipeId,
          dayIndex: meal.dayIndex,
          mealType: meal.mealType as MealType,
          servings: meal.servings || 1,
          date: mealDate
        });
        addedCount++;
      }
    }
    
    setShowPreviewOverlay(false);
    setPreviewWeek(null);
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
      const recipeId = swapForkTarget.plannerMeal.recipeId;
      const meal = swapForkTarget.plannerMeal;
      const dayIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === meal.date);
      const previewMeal: PreviewMeal = {
        id: meal.id.toString(),
        recipeId: meal.recipeId,
        dayIndex: dayIdx >= 0 ? dayIdx : 0,
        mealType: meal.mealType as AutoPopulateMealType,
        servings: meal.servings
      };
      setSwapTarget({ meal: previewMeal, dayIndex: dayIdx >= 0 ? dayIdx : 0 });
      setSwapSearchQuery("");
      setShowSwapModal(true);
    } else if (swapForkTarget?.type === 'preview' && swapForkTarget.previewMeal && swapForkTarget.dayIndex !== undefined) {
      handleSwapMeal(swapForkTarget.previewMeal, swapForkTarget.dayIndex);
    }
    setSwapForkTarget(null);
  };

  const handleSelectSwapRecipe = (recipeId: string) => {
    if (!previewWeek || !swapTarget) return;
    
    const updatedMeals = previewWeek.meals.map(m => 
      m.id === swapTarget.meal.id 
        ? { ...m, recipeId } 
        : m
    );
    
    const newTotals = calculateProjectedTotals(updatedMeals, generationSettings.servings);
    setPreviewWeek({ meals: updatedMeals, projectedTotals: newTotals });
    setShowSwapModal(false);
    setSwapTarget(null);
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
      const newTotals = calculateProjectedTotals(updatedMeals, { ...generationSettings.servings, [mealType]: newValue });
      setPreviewWeek({ meals: updatedMeals, projectedTotals: newTotals });
    }
  };

  const getSwapSuggestionsForMeal = (meal: PreviewMeal) => {
    if (!meal) return [];
    const usedIds = new Set(previewWeek?.meals.map(m => m.recipeId) || []);
    return getSwapSuggestions(
      meal.recipeId,
      meal.mealType,
      { allergies: [], dietaryRestrictions: [], cookingComfort: 'comfortable', costPreference: 'balanced', tools: [] },
      pantry || [],
      favorites || [],
      usedIds,
      6
    );
  };

  const searchSwapRecipes = (query: string, mealType: AutoPopulateMealType) => {
    if (!query.trim()) return [];
    return searchRecipesForMealType(
      query,
      mealType,
      { allergies: [], dietaryRestrictions: [], cookingComfort: 'comfortable', costPreference: 'balanced', tools: [] },
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
            
            const goalCalories = isPro && profile?.targetCalories ? profile.targetCalories : totalPlanned;
            const goalProtein = isPro && profile?.targetProtein ? profile.targetProtein : 0;
            const goalCarbs = isPro && profile?.targetCarbs ? profile.targetCarbs : 0;
            const goalFat = isPro && profile?.targetFat ? profile.targetFat : 0;
            const remaining = goalCalories - todayMacros.calories;

            return (
              <Card 
                className="border-0 overflow-visible" 
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)' }}
                data-testid="card-calorie-counter"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <CalorieRing remaining={remaining} total={goalCalories} />
                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium" data-testid="text-daily-goal-label">
                          {isPro ? 'Daily Goal' : "Today's Plan"}
                        </p>
                        <p className="text-lg font-bold font-display" data-testid="text-daily-goal-value">
                          {goalCalories.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">cal</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2 text-center">
                          <p className="text-base sm:text-lg font-bold font-display text-green-700 dark:text-green-400" data-testid="text-eaten-cal">{todayMacros.calories.toLocaleString()}</p>
                          <p className="text-[10px] uppercase tracking-wider text-green-600/70 dark:text-green-400/70 font-medium">Eaten</p>
                        </div>
                        <div className="flex-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 text-center">
                          <p className="text-base sm:text-lg font-bold font-display text-amber-700 dark:text-amber-400" data-testid="text-left-cal">{Math.max(remaining, 0).toLocaleString()}</p>
                          <p className="text-[10px] uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 font-medium">Left</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t mt-4 pt-3 relative">
                    {isPro && macrosSet ? (
                      <div className="flex gap-4">
                        <MacroBar label="Protein" consumed={todayMacros.protein} target={goalProtein} color="bg-orange-500" trackColor="bg-orange-100 dark:bg-orange-950/30" />
                        <MacroBar label="Carbs" consumed={todayMacros.carbs} target={goalCarbs} color="bg-green-400" trackColor="bg-green-100 dark:bg-green-950/30" />
                        <MacroBar label="Fat" consumed={todayMacros.fat} target={goalFat} color="bg-[#1e3a5f]" trackColor="bg-slate-200 dark:bg-slate-800" />
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="flex gap-4 blur-[3px] opacity-50 pointer-events-none select-none">
                          <MacroBar label="Protein" consumed={30} target={100} color="bg-orange-500" trackColor="bg-orange-100 dark:bg-orange-950/30" />
                          <MacroBar label="Carbs" consumed={45} target={150} color="bg-green-400" trackColor="bg-green-100 dark:bg-green-950/30" />
                          <MacroBar label="Fat" consumed={20} target={60} color="bg-[#1e3a5f]" trackColor="bg-slate-200 dark:bg-slate-800" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            size="sm"
                            onClick={() => setLocation("/paywall")}
                            className="bg-recipal-orange text-xs"
                            data-testid="button-upgrade-macros"
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            Join Pro
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

              <Button 
                onClick={handleOpenAutoPopulate}
                className="w-full mt-3 bg-[#ff6300] text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                data-testid="button-auto-populate"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {isPro && macrosSet ? "Auto-populate Week (Optimized for Macros)" : "Auto-populate Week"}
              </Button>
              
              {isPro && (
                <div className="mt-2">
                  <button
                    onClick={() => setManualEntryExpanded(!manualEntryExpanded)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                    data-testid="button-manual-entry-toggle"
                  >
                    <span>Manual Entry</span>
                    {manualEntryExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  
                  {manualEntryExpanded && (
                    <div className="mt-2 p-3 bg-card border rounded-md space-y-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          placeholder="e.g., Protein shake"
                          value={manualEntry.name}
                          onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                          className="h-8 text-sm"
                          data-testid="input-manual-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Calories</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={manualEntry.calories}
                            onChange={(e) => setManualEntry({ ...manualEntry, calories: e.target.value })}
                            className="h-8 text-sm"
                            data-testid="input-manual-calories"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Protein (g)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={manualEntry.protein}
                            onChange={(e) => setManualEntry({ ...manualEntry, protein: e.target.value })}
                            className="h-8 text-sm"
                            data-testid="input-manual-protein"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Carbs (g)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={manualEntry.carbs}
                            onChange={(e) => setManualEntry({ ...manualEntry, carbs: e.target.value })}
                            className="h-8 text-sm"
                            data-testid="input-manual-carbs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fat (g)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={manualEntry.fat}
                            onChange={(e) => setManualEntry({ ...manualEntry, fat: e.target.value })}
                            className="h-8 text-sm"
                            data-testid="input-manual-fat"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={manualEntry.date}
                            onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
                            className="h-8 text-sm"
                            data-testid="input-manual-date"
                          />
                        </div>
                        <Button 
                          onClick={handleManualAdd}
                          className="h-8 text-sm"
                          data-testid="button-manual-save"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                            <div className="flex items-center gap-2 text-[11px] font-normal">
                              <span className="font-semibold text-black dark:text-white">Daily Total</span>
                              <span className="text-yellow-600 dark:text-yellow-500 font-medium">{dayCalories} kcal</span>
                            </div>
                          )}
                        </div>
                        {dayCalories > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-white/60 dark:border-white/10">
                            {isPro && (
                              <div className="flex gap-3 text-[11px] font-medium" data-testid={`macros-day-${dayIdx}`}>
                                <span className="text-recipal-orange">P:{dayMacrosDisplay.protein}g</span>
                                <span className="text-primary">C:{dayMacrosDisplay.carbs}g</span>
                                <span className="text-blue-800 dark:text-blue-300">F:{dayMacrosDisplay.fat}g</span>
                              </div>
                            )}
                            {!isPro && dayMeals.length > 0 && (
                              <div className="flex gap-3 text-[11px] font-medium blur-[2px] text-muted-foreground/50" data-testid={`macros-day-${dayIdx}-blurred`}>
                                <span>P:--g</span>
                                <span>C:--g</span>
                                <span>F:--g</span>
                              </div>
                            )}
                          </div>
                        )}
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
                                  className={`p-2 rounded-lg relative ${isCooked ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted'}`}
                                  data-testid={`meal-${meal.id}`}
                                >
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="absolute top-1 right-1 h-5 w-5 text-destructive"
                                    onClick={() => handleRemoveMeal(meal.id)}
                                    data-testid={`button-remove-${meal.id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                  <div className="flex gap-2 pr-5">
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
                                      <Button
                                        size="sm"
                                        className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white px-2 w-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                                        onClick={() => handleOpenSwapFork('planner', meal)}
                                        data-testid={`button-detail-${meal.id}`}
                                      >
                                        <Repeat className="w-3 h-3 text-white" />
                                        <span className="text-[10px] font-medium text-white ml-1">Swap</span>
                                      </Button>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-preview-overlay">
          <DialogHeader>
            <DialogTitle>Preview Your Week</DialogTitle>
            <p className="text-sm text-muted-foreground">Confirm or regenerate before saving</p>
          </DialogHeader>

          <div className="space-y-4">
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
                  onCheckedChange={(checked) => {
                    const newSettings = { 
                      ...generationSettings, 
                      addDesserts: !!checked,
                      servings: { ...generationSettings.servings, Desserts: 1 }
                    };
                    setGenerationSettings(newSettings);
                    if (previewWeek && checked) {
                      const existingMeals = planner.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType }));
                      const userPrefs = { allergies: [], dietaryRestrictions: [], cookingComfort: 'comfortable' as const, costPreference: 'balanced' as const, tools: [] };
                      const generated = generateWeekPlan(newSettings, userPrefs, pantry || [], favorites || [], existingMeals);
                      setPreviewWeek(generated);
                    } else if (previewWeek && !checked) {
                      const filteredMeals = previewWeek.meals.filter(m => m.mealType !== 'Desserts');
                      const newTotals = calculateProjectedTotals(filteredMeals, newSettings.servings);
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
                  onCheckedChange={(checked) => {
                    const newSettings = { 
                      ...generationSettings, 
                      addSnackitizers: !!checked,
                      servings: { ...generationSettings.servings, Snackitizers: 1 }
                    };
                    setGenerationSettings(newSettings);
                    if (previewWeek && checked) {
                      const existingMeals = planner.map(m => ({ dayIndex: m.dayIndex, mealType: m.mealType }));
                      const userPrefs = { allergies: [], dietaryRestrictions: [], cookingComfort: 'comfortable' as const, costPreference: 'balanced' as const, tools: [] };
                      const generated = generateWeekPlan(newSettings, userPrefs, pantry || [], favorites || [], existingMeals);
                      setPreviewWeek(generated);
                    } else if (previewWeek && !checked) {
                      const filteredMeals = previewWeek.meals.filter(m => m.mealType !== 'Snackitizers');
                      const newTotals = calculateProjectedTotals(filteredMeals, newSettings.servings);
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
              <Card className="bg-muted/50 border-0 shadow-[0_0_8px_2px_rgba(0,0,0,0.15)] my-4">
                <CardContent className="px-4 !pt-2 !pb-2 flex flex-col items-center justify-center">
                  <p className="text-[24px] font-display font-bold text-recipal-deep-green text-center !mt-0 mb-2" style={{ textShadow: '1px 2px 3px rgba(0,0,0,0.15)' }}>Projected Daily Average</p>
                  <div className="flex gap-3 justify-center pb-2">
                    <div className="bg-recipal-orange/10 border border-recipal-orange/20 rounded px-3 py-2 flex flex-col items-center min-w-[70px]">
                      <span className="text-[24px] font-bold text-recipal-orange leading-none">{Math.round(previewWeek.projectedTotals.weeklyProtein / 7)}g</span>
                      <span className="text-[12px] text-muted-foreground leading-none mt-[1px]">Protein</span>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded px-3 py-2 flex flex-col items-center min-w-[70px]">
                      <span className="text-[24px] font-bold text-primary leading-none">{Math.round(previewWeek.projectedTotals.weeklyCarbs / 7)}g</span>
                      <span className="text-[12px] text-muted-foreground leading-none mt-[1px]">Carbs</span>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 rounded px-3 py-2 flex flex-col items-center min-w-[70px]">
                      <span className="text-[24px] font-bold text-blue-800 dark:text-blue-300 leading-none">{Math.round(previewWeek.projectedTotals.weeklyFat / 7)}g</span>
                      <span className="text-[12px] text-muted-foreground leading-none mt-[1px]">Fat</span>
                    </div>
                    <div className="bg-yellow-100/30 border border-yellow-500/20 rounded px-3 py-2 flex flex-col items-center min-w-[70px]">
                      <span className="text-[24px] font-bold text-yellow-600 dark:text-yellow-500 leading-none">{Math.round(previewWeek.projectedTotals.weeklyCalories / 7)}</span>
                      <span className="text-[12px] text-black dark:text-white leading-none mt-[1px]">Calories</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {previewWeek && (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const dayMeals = previewWeek.meals.filter(m => m.dayIndex === dayIdx);
                  if (dayMeals.length === 0) return null;
                  
                  return (
                    <div key={dayIdx} className="border rounded p-2" data-testid={`preview-day-${dayIdx}`}>
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
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold">
                                {format(addDays(weekStart, dayIdx), "EEEE, MMM d")}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-black dark:text-white">Daily Total</span>
                                <span className="text-[11px] text-yellow-600 dark:text-yellow-500 font-medium" data-testid={`preview-day-cal-${dayIdx}`}>{dayTotals.calories} kcal</span>
                              </div>
                            </div>
                            <div className="flex gap-3 text-[11px] font-medium mt-1 pt-1 border-t border-white/60 dark:border-white/10">
                              <span className="text-recipal-orange" data-testid={`preview-day-protein-${dayIdx}`}>P:{dayTotals.protein}g</span>
                              <span className="text-primary" data-testid={`preview-day-carbs-${dayIdx}`}>C:{dayTotals.carbs}g</span>
                              <span className="text-blue-800 dark:text-blue-300" data-testid={`preview-day-fat-${dayIdx}`}>F:{dayTotals.fat}g</span>
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
                          
                          const isSlotOccupied = planner.some(m => 
                            m.dayIndex === dayIdx && m.mealType === mealType
                          );
                          
                          return (
                            <div 
                              key={meal.id}
                              className={`p-1.5 rounded ${isSlotOccupied ? 'bg-muted/50 opacity-50' : 'bg-muted'}`}
                              data-testid={`preview-meal-${meal.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex-1 flex flex-col min-w-0">
                                  <div className="flex gap-2 items-start">
                                    <img 
                                      src={recipe.image} 
                                      alt={recipe.title}
                                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-[10px] text-muted-foreground">{mealType}</p>
                                      <p className="text-xs font-medium truncate">{recipe.title}</p>
                                    </div>
                                  </div>
                                  {!isSlotOccupied && (
                                    <div className="flex gap-1 mt-1.5" data-testid={`preview-meal-macros-${meal.id}`}>
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
                                  )}
                                </div>
                                {isSlotOccupied ? (
                                  <Badge variant="secondary" className="text-[8px] px-1 flex-shrink-0">Slot filled</Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white px-2 flex-shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
                                    onClick={() => handleOpenSwapFork('preview', undefined, meal, dayIdx)}
                                    data-testid={`button-swap-meal-${meal.id}`}
                                  >
                                    <Repeat className="w-3 h-3 text-white" />
                                    <span className="text-[10px] font-medium text-white ml-1">Swap</span>
                                  </Button>
                                )}
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

      <Dialog open={showSwapModal} onOpenChange={setShowSwapModal}>
        <DialogContent className="max-w-sm" data-testid="dialog-swap-meal">
          <DialogHeader>
            <DialogTitle>Swap Recipe</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose a replacement for "{swapTarget?.meal.recipeId ? getRecipeById(swapTarget.meal.recipeId)?.title || swapTarget.meal.mealType : swapTarget?.meal.mealType}"
            </p>
          </DialogHeader>

          <div className="space-y-3">
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

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {swapTarget && (
                swapSearchQuery.trim() 
                  ? searchSwapRecipes(swapSearchQuery, swapTarget.meal.mealType)
                  : getSwapSuggestionsForMeal(swapTarget.meal)
              ).map(recipe => (
                <div 
                  key={recipe.id}
                  className="flex items-center gap-2 p-2 border rounded cursor-pointer hover-elevate"
                  onClick={() => handleSelectSwapRecipe(recipe.id)}
                  data-testid={`swap-option-${recipe.id}`}
                >
                  <img 
                    src={recipe.image} 
                    alt={recipe.title}
                    className="w-10 h-10 rounded object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{recipe.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {recipe.calories} cal | {recipe.cookTime}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
