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
import { Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, LayoutGrid, List, Flame, Lock, Calendar, Wand2, Minus, X, Search, RefreshCw, Repeat } from "lucide-react";
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
    
    const mealsAsInput: PlannedMealInput[] = meals.map(m => ({
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

  const handleMarkCooked = (meal: typeof planner[0]) => {
    const recipe = getRecipeById(meal.recipeId);
    if (recipe) {
      if (markMealCooked) {
        markMealCooked(meal.id);
      }
      acceleratePantryDecay(recipe.ingredients.map(i => i.name));
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
                  className="bg-recipal-orange hover:bg-recipal-orange/90 shrink-0"
                  data-testid="button-finish-setup"
                >
                  Finish setting up macros
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50 ring-[3px] ring-green-500 border-t border-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.15)]" data-testid="summary-bar">
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Today Calories</p>
                  <p className="text-lg font-bold flex items-center justify-center gap-1" data-testid="text-today-calories">
                    <Flame className="w-4 h-4 text-orange-500" />
                    {todayMacros.calories}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">This Week Calories</p>
                  <p className="text-lg font-bold" data-testid="text-week-calories">{weekTotals.calories}</p>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t relative">
                {isPro ? (
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Today Macros</p>
                      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs" data-testid="text-today-macros">
                        <span className="text-recipal-orange">Protein: {todayMacros.protein}g</span>
                        <span className="text-primary">Carbs: {todayMacros.carbs}g</span>
                        <span className="text-blue-800 dark:text-blue-300">Fat: {todayMacros.fat}g</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Week Macros</p>
                      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs" data-testid="text-week-macros">
                        <span className="text-recipal-orange">Protein: {weekTotals.protein}g</span>
                        <span className="text-primary">Carbs: {weekTotals.carbs}g</span>
                        <span className="text-blue-800 dark:text-blue-300">Fat: {weekTotals.fat}g</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="grid grid-cols-2 gap-4 text-center blur-sm opacity-50">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Today Macros</p>
                        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs">
                          <span className="text-recipal-orange">Protein: --g</span>
                          <span className="text-primary">Carbs: --g</span>
                          <span className="text-blue-800 dark:text-blue-300">Fat: --g</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Week Macros</p>
                        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs">
                          <span className="text-recipal-orange">Protein: --g</span>
                          <span className="text-primary">Carbs: --g</span>
                          <span className="text-blue-800 dark:text-blue-300">Fat: --g</span>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button 
                        size="sm"
                        onClick={() => setLocation("/paywall")}
                        className="bg-recipal-orange hover:bg-recipal-orange/90 text-xs h-7"
                        data-testid="button-upgrade-macros"
                      >
                        <Lock className="w-3 h-3 mr-1" />
                        Upgrade to Pro
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

              <Button 
                onClick={handleOpenAutoPopulate}
                className="w-full mt-3 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
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
                    <span>Manual Entry (Pro)</span>
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
                      <CardTitle className="text-sm flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          {format(day, "EEEE, MMM d")}
                          {isToday && <Badge variant="secondary" className="text-[10px]">Today</Badge>}
                        </span>
                        {dayCalories > 0 && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3" /> {dayCalories} cal
                            </span>
                            {isPro && (
                              <span className="text-[10px]" data-testid={`macros-day-${dayIdx}`}>
                                P {dayMacrosDisplay.protein}g • C {dayMacrosDisplay.carbs}g • F {dayMacrosDisplay.fat}g
                              </span>
                            )}
                            {!isPro && dayMeals.length > 0 && (
                              <span className="text-[10px] text-muted-foreground/50 blur-[2px]" data-testid={`macros-day-${dayIdx}-blurred`}>
                                P 0g • C 0g • F 0g
                              </span>
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
                                  className={`flex items-center gap-2 p-2 rounded-lg ${isCooked ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted'}`}
                                  data-testid={`meal-${meal.id}`}
                                >
                                  <img 
                                    src={recipe.image} 
                                    alt={recipe.title}
                                    className="w-10 h-10 rounded object-cover cursor-pointer"
                                    onClick={() => setLocation(`/recipe/${recipe.id}`)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{recipe.title}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {mealNutrition.calories} cal
                                      {meal.servings > 1 && <span className="ml-1">({meal.servings} srv)</span>}
                                      {isCooked && <span className="ml-1 text-green-600">(counted)</span>}
                                    </p>
                                    {isPro && (
                                      <p className="text-[9px] text-muted-foreground" data-testid={`meal-macros-${meal.id}`}>
                                        P {mealNutrition.protein}g • C {mealNutrition.carbs}g • F {mealNutrition.fat}g
                                      </p>
                                    )}
                                    {!isPro && (
                                      <p className="text-[9px] text-muted-foreground/40 blur-[1px]" data-testid={`meal-macros-${meal.id}-blurred`}>
                                        P 0g • C 0g • F 0g
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setSelectedMealForDetail(meal);
                                        setShowMealDetail(true);
                                      }}
                                      data-testid={`button-detail-${meal.id}`}
                                    >
                                      <Repeat className="h-3.5 w-3.5 text-blue-500" />
                                    </Button>
                                    {!isCooked && (
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="h-7 text-[10px] px-2 text-green-600 border-green-200 hover:bg-green-50"
                                        onClick={() => handleMarkCooked(meal)}
                                        data-testid={`button-cooked-${meal.id}`}
                                      >
                                        Cooked
                                      </Button>
                                    )}
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-7 text-[10px] px-2 text-destructive border-destructive/20 hover:bg-destructive/10"
                                      onClick={() => handleRemoveMeal(meal.id)}
                                      data-testid={`button-remove-${meal.id}`}
                                    >
                                      Remove
                                    </Button>
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
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Projected Daily Avg</p>
                      <p className="text-lg font-bold">
                        {Math.round(previewWeek.projectedTotals.weeklyCalories / 7)} cal
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Projected Weekly</p>
                      <p className="text-lg font-bold">{previewWeek.projectedTotals.weeklyCalories} cal</p>
                    </div>
                  </div>
                  {isPro && (
                    <div className="mt-2 pt-2 border-t flex justify-center gap-4 text-xs">
                      <span className="text-recipal-orange">P: {previewWeek.projectedTotals.weeklyProtein}g</span>
                      <span className="text-primary">C: {previewWeek.projectedTotals.weeklyCarbs}g</span>
                      <span className="text-blue-800 dark:text-blue-300">F: {previewWeek.projectedTotals.weeklyFat}g</span>
                    </div>
                  )}
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
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold">
                              {format(addDays(weekStart, dayIdx), "EEEE, MMM d")}
                            </p>
                            <div className="flex items-center gap-2" data-testid={`preview-day-totals-${dayIdx}`}>
                              <span className="text-[11px] font-semibold text-black dark:text-white">Daily Total</span>
                              <div className="flex gap-2 text-[11px] font-medium">
                                <span className="text-recipal-orange" data-testid={`preview-day-protein-${dayIdx}`}>P:{dayTotals.protein}g</span>
                                <span className="text-primary" data-testid={`preview-day-carbs-${dayIdx}`}>C:{dayTotals.carbs}g</span>
                                <span className="text-blue-800 dark:text-blue-300" data-testid={`preview-day-fat-${dayIdx}`}>F:{dayTotals.fat}g</span>
                                <span className="text-yellow-600 dark:text-yellow-500" data-testid={`preview-day-cal-${dayIdx}`}>Cal:{dayTotals.calories}</span>
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
                          
                          const isSlotOccupied = planner.some(m => 
                            m.dayIndex === dayIdx && m.mealType === mealType
                          );
                          
                          return (
                            <div 
                              key={meal.id}
                              className={`p-1.5 rounded ${isSlotOccupied ? 'bg-muted/50 opacity-50' : 'bg-muted'}`}
                              data-testid={`preview-meal-${meal.id}`}
                            >
                              <div className="flex gap-2">
                                <img 
                                  src={recipe.image} 
                                  alt={recipe.title}
                                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[10px] text-muted-foreground">{mealType}</p>
                                      <p className="text-xs font-medium truncate">{recipe.title}</p>
                                    </div>
                                    {isSlotOccupied ? (
                                      <Badge variant="secondary" className="text-[8px] px-1 flex-shrink-0">Slot filled</Badge>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="bg-blue-100 dark:bg-blue-900/40 flex-shrink-0"
                                        onClick={() => handleSwapMeal(meal, dayIdx)}
                                        data-testid={`button-swap-meal-${meal.id}`}
                                      >
                                        <Repeat className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        <span className="text-[10px] font-medium text-blue-500 dark:text-blue-300 ml-1">Swap</span>
                                      </Button>
                                    )}
                                  </div>
                                  {!isSlotOccupied && (
                                    <div className="flex gap-1 mt-1.5" data-testid={`preview-meal-macros-${meal.id}`}>
                                      <div className="bg-recipal-orange/10 border border-recipal-orange/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                        <span className="text-[12px] font-bold text-recipal-orange leading-none" data-testid={`preview-meal-protein-${meal.id}`}>{Math.round((recipe.protein || 0) * meal.servings)}g</span>
                                        <span className="text-[9px] text-muted-foreground leading-none">Protein</span>
                                      </div>
                                      <div className="bg-primary/10 border border-primary/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                        <span className="text-[12px] font-bold text-primary leading-none" data-testid={`preview-meal-carbs-${meal.id}`}>{Math.round((recipe.carbs || 0) * meal.servings)}g</span>
                                        <span className="text-[9px] text-muted-foreground leading-none">Carbs</span>
                                      </div>
                                      <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                        <span className="text-[12px] font-bold text-blue-800 dark:text-blue-300 leading-none" data-testid={`preview-meal-fat-${meal.id}`}>{Math.round((recipe.fat || 0) * meal.servings)}g</span>
                                        <span className="text-[9px] text-muted-foreground leading-none">Fat</span>
                                      </div>
                                      <div className="bg-yellow-100/30 border border-yellow-500/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[36px]">
                                        <span className="text-[12px] font-bold text-yellow-600 dark:text-yellow-500 leading-none" data-testid={`preview-meal-cal-${meal.id}`}>{Math.round((recipe.calories || 0) * meal.servings)}</span>
                                        <span className="text-[9px] text-black dark:text-white leading-none">Calories</span>
                                      </div>
                                    </div>
                                  )}
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
                className="flex-1 h-10 bg-recipal-orange hover:bg-recipal-orange/90 text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
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
