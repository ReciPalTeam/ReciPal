import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Heart, Share2, Clock, Users, Plus, Check, HelpCircle, ShoppingCart, ChefHat, Calendar, Minus, AlertTriangle, Repeat, Undo2, Loader2, Wrench } from "lucide-react";
import { formatMinutesHumanReadable, parseTimeStringToMinutes } from "@/lib/time-format";
import { getIngredientNutritionEstimate } from "@/lib/ingredient-classifier";
import type { Recipe } from "@/lib/mock-data";
import { useDemoStore, MealType, IngredientOverride, normalizeIngredientName } from "@/lib/demo-store";
import { useRecipeStore, fetchRecipeById } from "@/lib/recipe-store";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, isSameDay, isWithinInterval, eachDayOfInterval } from "date-fns";
import { SwapIngredientPopup } from "@/components/swap-ingredient-popup";
import type { SwapSuggestion } from "@/lib/swap-suggestions";
import { unitTrace, getOrCreateCorrelationId } from "@/utils/unitTrace";
import { apiRequest } from "@/lib/queryClient";

type DateSelectionMode = "single" | "range" | "select";
const SCHEDULE_MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Desserts", "Snackitizers", "Side"];

export default function RecipeDetailPage() {
  const [, params] = useRoute("/recipe/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { 
    favorites, 
    toggleFavorite, 
    getPantryOverlap, 
    addToPlanner, 
    addToPlannerWithReplace,
    addRecipeIngredientsToCart,
    addRecipeToCartWithDedupe,
    acceleratePantryDecay,
    planner,
    getMealAtSlot,
    pantry,
    updatePantryState
  } = useDemoStore();
  
  const { getRecipeById, setRecipe } = useRecipeStore();
  const cachedInitRecipe = params?.id ? getRecipeById(params.id) : null;
  
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");
  const [dateMode, setDateMode] = useState<DateSelectionMode>("single");
  const [servings, setServings] = useState(cachedInitRecipe?.min_servings || cachedInitRecipe?.servings || 1);
  const [scaledSteps, setScaledSteps] = useState<any[] | null>(null);
  const [scaledIngredients, setScaledIngredients] = useState<{ sort_order: number; display_text: string; amount: number; unit: string }[] | null>(null);
  const [scaledCookTime, setScaledCookTime] = useState<string | null>(null);
  const [scaledNutrition, setScaledNutrition] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [isScaling, setIsScaling] = useState(false);
  const scalingAbortRef = useRef<AbortController | null>(null);
  const [swapPopupOpen, setSwapPopupOpen] = useState(false);
  const [swapIngredientName, setSwapIngredientName] = useState("");
  const [localSwaps, setLocalSwaps] = useState<IngredientOverride[]>([]);
  const [maybeResolutions, setMaybeResolutions] = useState<Record<string, "have" | "need">>({});
  
  const [recipe, setLocalRecipe] = useState<Recipe | null>(cachedInitRecipe);
  const [loading, setLoading] = useState(!cachedInitRecipe);
  const [error, setError] = useState<string | null>(null);

  // Calendar state
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const [calendarWeekStart, setCalendarWeekStart] = useState(weekStart);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [pendingDaysWithConflicts, setPendingDaysWithConflicts] = useState<Date[]>([]);

  useEffect(() => {
    const loadRecipe = async () => {
      if (!params?.id) {
        setLoading(false);
        return;
      }

      const cachedRecipe = getRecipeById(params.id);
      if (cachedRecipe) {
        setLocalRecipe(cachedRecipe);
        setServings(cachedRecipe.min_servings || cachedRecipe.servings || 1);
        setLoading(false);
        return;
      }

      try {
        const fetchedRecipe = await fetchRecipeById(params.id);
        setRecipe(fetchedRecipe);
        setLocalRecipe(fetchedRecipe);
        setServings(fetchedRecipe.min_servings || fetchedRecipe.servings || 1);
        setLoading(false);
        return;
      } catch (err) {
        console.error('[RecipeDetail] API fetch failed:', err);
        setError('Recipe not found');
        setLoading(false);
      }
    };

    loadRecipe();
  }, [params?.id, getRecipeById, setRecipe]);


  const fetchScaledData = useCallback(async (recipeId: string, desired: number) => {
    if (scalingAbortRef.current) {
      scalingAbortRef.current.abort();
    }
    const controller = new AbortController();
    scalingAbortRef.current = controller;

    setIsScaling(true);
    try {
      const res = await apiRequest("POST", "/api/scaled-steps", {
        recipe_id: recipeId,
        desired_servings: desired,
      });
      if (controller.signal.aborted) return;
      const data = await res.json();
      setScaledSteps(data.steps);
      setScaledIngredients(data.ingredients && data.ingredients.length > 0 ? data.ingredients : null);
      setScaledCookTime(data.cook_time_minutes ? `${data.cook_time_minutes} min` : null);
      setScaledNutrition({
        calories: Math.round(data.total_calories),
        protein: Math.round(data.total_protein),
        carbs: Math.round(data.total_carbs),
        fat: Math.round(data.total_fat),
      });
    } catch (err: any) {
      if (!controller.signal.aborted) {
        console.error("[RecipeDetail] Scaling error:", err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsScaling(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!recipe) return;
    const baseServings = recipe.servings || 1;
    const minServings = recipe.min_servings || baseServings;
    if (servings === baseServings && minServings === baseServings) {
      setScaledSteps(null);
      setScaledIngredients(null);
      setScaledCookTime(null);
      setScaledNutrition(null);
      setIsScaling(false);
    } else {
      fetchScaledData(recipe.id, servings);
    }
  }, [servings, recipe?.id, recipe?.servings, recipe?.min_servings, fetchScaledData]);

  // Must call useMemo BEFORE any early returns to follow React hooks rules
  const adjustedNutrition = useMemo(() => {
    let perServingCals = recipe?.calories || 0;
    let perServingProtein = recipe?.protein || 0;
    let perServingCarbs = recipe?.carbs || 0;
    let perServingFat = recipe?.fat || 0;
    
    localSwaps.forEach(override => {
      const originalNutrition = getIngredientNutritionEstimate(override.originalIngredientName);
      perServingCals += override.replacementNutrition.calories - originalNutrition.calories;
      perServingProtein += override.replacementNutrition.protein - originalNutrition.protein;
      perServingCarbs += override.replacementNutrition.carbs - originalNutrition.carbs;
      perServingFat += override.replacementNutrition.fat - originalNutrition.fat;
    });
    
    return {
      calories: Math.max(0, Math.round(perServingCals * servings)),
      protein: Math.max(0, Math.round(perServingProtein * servings)),
      carbs: Math.max(0, Math.round(perServingCarbs * servings)),
      fat: Math.max(0, Math.round(perServingFat * servings)),
    };
  }, [recipe?.calories, recipe?.protein, recipe?.carbs, recipe?.fat, servings, localSwaps]);

  const displayIngredients = useMemo(() => {
    const base = recipe?.ingredients || [];
    if (!scaledIngredients || scaledIngredients.length === 0) return base;
    return base.map((ing, idx) => {
      const scaled = scaledIngredients[idx];
      if (scaled) {
        return { ...ing, amount: String(scaled.amount), unit: scaled.unit };
      }
      return ing;
    });
  }, [recipe?.ingredients, scaledIngredients]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="p-4 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-4" />
        <p>{error || 'Recipe not found'}</p>
        <Button onClick={() => setLocation("/recipes")} className="mt-4">Back to Recipes</Button>
      </div>
    );
  }

  const recipeSafe = recipe;
  const pantryStatus = getPantryOverlap(recipeSafe);
  const isFavorite = favorites.includes(recipeSafe.id);

  if (pantryStatus.missing.length > 0) {
    unitTrace("pantry_gap_detected", {
      correlationId: "aggregate",
      recipeId: recipeSafe.id,
      recipeName: recipeSafe.title,
      missingCount: pantryStatus.missing.length,
      missingIngredientsPreview: pantryStatus.missing.slice(0, 10).map(name => {
        const ing = recipeSafe.ingredients.find(i => i.name === name);
        return {
          name,
          originalServingText: ing ? `${ing.amount} ${ing.unit}` : "",
          originalQty: ing ? ing.amount : "",
          originalUnitDisplay: ing ? ing.unit : "",
        };
      }),
      sourceType: "recipe_detail",
    });
  }

  // Get all dates to schedule based on current selection mode
  const getSelectedDatesToSchedule = (): Date[] => {
    if (dateMode === "single") {
      return selectedDates.slice(0, 1);
    } else if (dateMode === "range" && rangeStart && rangeEnd) {
      return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    } else if (dateMode === "select") {
      return selectedDates;
    }
    return [];
  };

  // Check which selected dates have conflicts
  const getConflictingDates = (): Date[] => {
    const datesToSchedule = getSelectedDatesToSchedule();
    const conflicts: Date[] = [];
    
    datesToSchedule.forEach(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const existingMeal = planner.find(m => 
        m.date === dateStr && m.mealType === selectedMealType
      );
      if (existingMeal) {
        conflicts.push(date);
      }
    });
    
    return conflicts;
  };

  // Check if a specific date has a meal in the selected slot
  const isSlotFilled = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return planner.some(m => m.date === dateStr && m.mealType === selectedMealType
    );
  };

  const handleShare = () => {
    const url = `${window.location.origin}/share/recipe/${recipeSafe.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Share this recipe with friends and family",
    });
  };

  const handleCalendarDayClick = (date: Date) => {
    if (dateMode === "single") {
      setSelectedDates([date]);
      setRangeStart(null);
      setRangeEnd(null);
    } else if (dateMode === "range") {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(date);
        setRangeEnd(null);
        setSelectedDates([]);
      } else {
        if (date < rangeStart) {
          setRangeEnd(rangeStart);
          setRangeStart(date);
        } else {
          setRangeEnd(date);
        }
      }
    } else if (dateMode === "select") {
      const exists = selectedDates.some(d => isSameDay(d, date));
      if (exists) {
        setSelectedDates(selectedDates.filter(d => !isSameDay(d, date)));
      } else {
        setSelectedDates([...selectedDates, date]);
      }
    }
  };

  const isDateSelected = (date: Date): boolean => {
    if (dateMode === "range" && rangeStart && rangeEnd) {
      return isWithinInterval(date, { start: rangeStart, end: rangeEnd });
    }
    if (dateMode === "range" && rangeStart && !rangeEnd) {
      return isSameDay(date, rangeStart);
    }
    return selectedDates.some(d => isSameDay(d, date));
  };

  const canAddToPlan = (): boolean => {
    const dates = getSelectedDatesToSchedule();
    return dates.length > 0 && selectedMealType !== undefined;
  };

  const handleAddToPlanClick = () => {
    const conflicts = getConflictingDates();
    if (conflicts.length > 0) {
      setPendingDaysWithConflicts(conflicts);
      setReplaceDialogOpen(true);
    } else {
      executeAddToPlan(false);
    }
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

  const executeAddToPlan = (replace: boolean) => {
    const datesToSchedule = getSelectedDatesToSchedule();
    
    datesToSchedule.forEach(date => {
      const dayIndex = ((date.getDay() + 6) % 7);
      const dateStr = format(date, "yyyy-MM-dd");
      const isConflict = pendingDaysWithConflicts.some(d => isSameDay(d, date));
      
      if (isConflict && replace) {
        addToPlannerWithReplace({
          recipeId: recipeSafe.id,
          dayIndex,
          mealType: selectedMealType,
          servings,
          date: dateStr,
        });
      } else if (!isConflict) {
        addToPlanner({
          recipeId: recipeSafe.id,
          dayIndex,
          mealType: selectedMealType,
          servings,
          date: dateStr,
        });
      }
    });
    
    syncMaybeResolutionsToPantry();
    
    setPlanDialogOpen(false);
    setReplaceDialogOpen(false);
    setPendingDaysWithConflicts([]);
    setSelectedDates([]);
    setRangeStart(null);
    setRangeEnd(null);
    
    toast({
      title: "Added to your plan",
      description: `${recipeSafe.title} scheduled for ${datesToSchedule.length} day${datesToSchedule.length > 1 ? 's' : ''}`,
    });
  };

  const handleGetMissing = () => {
    const missingCorrelationIds = pantryStatus.missing.map(name => {
      const normalized = normalizeIngredientName(name);
      return getOrCreateCorrelationId(normalized);
    });
    unitTrace("add_missing_to_cart_clicked", {
      correlationId: "aggregate",
      recipeId: recipeSafe.id,
      recipeName: recipeSafe.title,
      itemsCount: pantryStatus.missing.length,
      correlationIds: missingCorrelationIds,
      sourceType: "recipe_feed",
    });
    addRecipeIngredientsToCart(recipeSafe);
    toast({
      title: "Added to cart!",
      description: `${pantryStatus.missing.length} ingredients added`,
    });
    setLocation("/cart");
  };

  const handleCookNow = () => {
    acceleratePantryDecay(recipeSafe.ingredients.map(i => i.name));
    toast({
      title: "Enjoy your meal!",
      description: "Pantry updated based on ingredients used",
    });
  };

  const getIngredientStatus = (ingredientName: string) => {
    if (pantryStatus.have.includes(ingredientName)) return "have";
    if (pantryStatus.might.includes(ingredientName)) return "might";
    return "need";
  };

  const getOverrideForIngredient = (ingredientName: string): IngredientOverride | undefined => {
    return localSwaps.find(
      o => o.originalIngredientName.toLowerCase() === ingredientName.toLowerCase()
    );
  };

  const getDisplayName = (ingredientName: string): string => {
    const override = getOverrideForIngredient(ingredientName);
    return override ? override.replacementName : ingredientName;
  };

  const handleSwapComplete = (replacement: SwapSuggestion) => {
    const newOverride: IngredientOverride = {
      originalIngredientName: swapIngredientName,
      replacementName: replacement.name,
      replacementNutrition: replacement.nutrition,
    };
    
    setLocalSwaps(prev => {
      const filtered = prev.filter(
        o => o.originalIngredientName.toLowerCase() !== swapIngredientName.toLowerCase()
      );
      return [...filtered, newOverride];
    });
    
    toast({
      title: "Ingredient swapped",
      description: `${swapIngredientName} replaced with ${replacement.name}`,
    });
  };

  const handleUndoSwap = (originalIngredient: string) => {
    setLocalSwaps(prev => 
      prev.filter(o => o.originalIngredientName.toLowerCase() !== originalIngredient.toLowerCase())
    );
    toast({
      title: "Swap undone",
      description: `Restored original ingredient`,
    });
  };

  const hasSwaps = localSwaps.length > 0;

  return (
    <div className="flex flex-col bg-background fixed inset-0 top-14 bottom-16 z-30 overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">
      <div className="relative h-64">
        <img 
          src={recipe.image} 
          alt={recipe.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
            onClick={() => setLocation("/recipes")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-green-600" />
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
              onClick={() => toggleFavorite(recipe.id)}
              data-testid="button-favorite"
            >
              <Heart className={`w-5 h-5 text-pink-500 ${isFavorite ? "fill-current" : ""}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
              onClick={handleShare}
              data-testid="button-share"
            >
              <Share2 className="w-5 h-5 text-orange-500" />
            </Button>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h1 className="font-bold mb-1 text-[#ff6300]" style={{ WebkitTextStroke: '4px white', paintOrder: 'stroke fill', fontSize: 'clamp(0.6rem, 4.5vw, 18px)' }}>{recipeSafe.title}</h1>
          <div className="flex items-center gap-1.5 text-xs mb-1.5 text-white/90" data-testid="text-recipe-category">
            {recipeSafe.sub_category && (
              <>
                <span>{recipeSafe.sub_category}</span>
                <span>·</span>
              </>
            )}
            <span>{recipeSafe.dish_type}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {servings} servings
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {hasSwaps && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              {localSwaps.length} ingredient{localSwaps.length > 1 ? 's' : ''} swapped in this recipe
            </p>
          </div>
        )}
        
        {(() => {
          const prep = recipeSafe.prep_time_minutes || parseTimeStringToMinutes(recipeSafe.prepTime);
          const cook = scaledCookTime
            ? parseTimeStringToMinutes(scaledCookTime)
            : (recipeSafe.cook_time_minutes || parseTimeStringToMinutes(recipeSafe.cookTime));
          const total = recipeSafe.total_time_minutes || parseTimeStringToMinutes(recipeSafe.totalTime);
          const passive = Math.max(0, total - prep - cook);
          const parts: { label: string; value: number }[] = [];
          if (prep > 0) parts.push({ label: "Prep", value: prep });
          if (cook > 0) parts.push({ label: "Cook", value: cook });
          if (passive > 0) parts.push({ label: "Passive", value: passive });
          if (total > 0) parts.push({ label: "Total", value: total });
          return parts.length > 0 ? (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground" data-testid="text-time-row">
              <Clock className="w-4 h-4" />
              {parts.map((p, i) => (
                <span key={p.label} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground/50">·</span>}
                  {p.label} {formatMinutesHumanReadable(p.value)}
                </span>
              ))}
            </div>
          ) : null;
        })()}
        <div className="grid grid-cols-4 gap-3">
          <Card className="bg-recipal-orange/10 border-recipal-orange/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-recipal-orange">{(scaledNutrition || adjustedNutrition).protein}g</p>
              <p className="text-[10px] text-muted-foreground">Protein</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-primary">{(scaledNutrition || adjustedNutrition).carbs}g</p>
              <p className="text-[10px] text-muted-foreground">Carbs</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/40">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-blue-800 dark:text-blue-300">{(scaledNutrition || adjustedNutrition).fat}g</p>
              <p className="text-[10px] text-muted-foreground">Fat</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-100/30 dark:bg-yellow-900/20 border-yellow-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-500" data-testid="text-calories-value">{(scaledNutrition || adjustedNutrition).calories}</p>
              <p className="text-[10px] text-muted-foreground">Calories</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-[10px] text-muted-foreground text-center" data-testid="text-nutrition-label">{(scaledNutrition || adjustedNutrition).calories} cal for {servings} servings</p>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Pantry Status</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Have ({pantryStatus.have.length})</span>
                  {pantryStatus.have.length > 0 && (
                    <p className="text-xs text-muted-foreground">{pantryStatus.have.join(", ")}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Might Have ({pantryStatus.might.length})</span>
                  {pantryStatus.might.length > 0 && (
                    <p className="text-xs text-muted-foreground">{pantryStatus.might.join(", ")}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-3 h-3 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">Need ({pantryStatus.missing.length})</span>
                  {pantryStatus.missing.length > 0 && (
                    <p className="text-xs text-muted-foreground">{pantryStatus.missing.join(", ")}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5" data-testid="serving-adjuster">
          <span className="text-sm font-medium">Servings</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 ${servings <= (recipeSafe.min_servings || recipeSafe.servings || 1) || isScaling ? 'opacity-30 cursor-not-allowed' : ''}`}
              onClick={() => { const step = recipeSafe.min_servings || recipeSafe.servings || 1; setServings(prev => Math.max(step, prev - step)); }}
              disabled={servings <= (recipeSafe.min_servings || recipeSafe.servings || 1) || isScaling}
              data-testid="button-servings-minus"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-8 text-center font-bold text-base" data-testid="text-servings">
              {servings}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => { const step = recipeSafe.min_servings || recipeSafe.servings || 1; setServings(prev => Math.min(48, prev + step)); }}
              disabled={servings >= 48 || isScaling}
              data-testid="button-servings-plus"
            >
              <Plus className="w-4 h-4" />
            </Button>
            {isScaling && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="ingredients" data-testid="tab-ingredients">Ingredients</TabsTrigger>
            <TabsTrigger value="steps" data-testid="tab-steps">Steps</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ingredients" className="mt-4">
            {isScaling && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="space-y-2" style={{ opacity: isScaling ? 0.4 : 1, transition: 'opacity 0.2s' }}>
              {[...displayIngredients]
                .map((ing, idx) => ({ ing, idx, status: getIngredientStatus(ing.name) }))
                .sort((a, b) => {
                  const order: Record<string, number> = { have: 0, might: 1, need: 2 };
                  return (order[a.status] ?? 2) - (order[b.status] ?? 2);
                })
                .map(({ ing, idx, status }) => {
                const override = getOverrideForIngredient(ing.name);
                const displayName = getDisplayName(ing.name);
                
                return (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between py-2 px-2 rounded-lg border ${
                      override ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'border-transparent border-b last:border-0'
                    }`}
                    data-testid={`ingredient-${idx}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                      {status === "have" && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-[9px] px-1.5 flex-shrink-0">Have</Badge>
                      )}
                      {status === "might" && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800 text-[9px] px-1.5 flex-shrink-0">Maybe</Badge>
                      )}
                      {status === "need" && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-[9px] px-1.5 flex-shrink-0">Need</Badge>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm truncate">{displayName}</span>
                        <span className="text-xs text-muted-foreground">{ing.amount} {ing.unit}</span>
                        {override && (
                          <span className="text-[10px] text-muted-foreground line-through">
                            was: {ing.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        className="h-6 px-2 gap-1 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white text-[10px] font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
                        onClick={() => {
                          setSwapIngredientName(ing.name);
                          setSwapPopupOpen(true);
                        }}
                        data-testid={`button-swap-${idx}`}
                      >
                        <Repeat className="h-3 w-3" /> Swap
                      </Button>
                      {override && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-blue-600"
                          onClick={() => handleUndoSwap(ing.name)}
                          data-testid={`button-undo-swap-${idx}`}
                        >
                          <Undo2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="steps" className="mt-4">
            {isScaling && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="space-y-4" style={{ opacity: isScaling ? 0.4 : 1, transition: 'opacity 0.2s' }}>
              {(scaledSteps || recipeSafe.steps).map((step, idx) => {
                const isRich = typeof step === 'object';
                const stepNum = isRich && step.step > 0 ? step.step : idx + 1;
                const instruction = isRich ? step.instruction : step;
                const time = isRich ? step.time : '';
                const equipment = isRich ? step.equipment : '';

                return (
                  <div key={idx} className="flex gap-3" data-testid={`step-${idx}`}>
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {stepNum}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{instruction}</p>
                      {(time || equipment) && (
                        <div className="flex gap-3 mt-1.5">
                          {time && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full" data-testid={`step-time-${idx}`}>
                              <Clock className="w-3 h-3" />
                              {time}
                            </span>
                          )}
                          {equipment && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full" data-testid={`step-equipment-${idx}`}>
                              <Wrench className="w-3 h-3" />
                              {equipment}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      </div>

      <div className="flex-shrink-0 p-4 bg-background border-t space-y-2">
        {pantryStatus.missing.length === 0 ? (
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 font-bold h-12"
            onClick={handleCookNow}
            data-testid="button-cook-now"
          >
            <ChefHat className="w-5 h-5 mr-2" /> Cook Now
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button 
              className="flex-1 h-12 bg-recipal-orange hover:bg-recipal-orange/90 text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={() => { setMaybeResolutions({}); setPlanDialogOpen(true); }}
              data-testid="button-add-to-plan"
            >
              <Plus className="w-5 h-5 mr-2" /> Add to Plan
            </Button>
            <Button 
              className="flex-1 h-12 bg-green-600 hover:bg-green-600/90 text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={() => { setMaybeResolutions({}); setCartDialogOpen(true); }}
              data-testid="button-add-to-cart"
            >
              <ShoppingCart className="w-5 h-5 mr-2" /> Add to Cart
            </Button>
          </div>
        )}
      </div>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-scheduling-popup">
          <DialogHeader>
            <DialogTitle>Add to Plan</DialogTitle>
            <DialogDescription>
              Choose when you want to make this.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Maybe Items Resolution */}
            {pantryStatus.might.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Uncertain Items</label>
                <div className="space-y-1.5">
                  {pantryStatus.might.map((item) => (
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
            )}

            {/* Meal Slot Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Meal Slot</label>
              <Select value={selectedMealType} onValueChange={(v) => setSelectedMealType(v as MealType)}>
                <SelectTrigger data-testid="select-meal-slot">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Selection Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Selection</label>
              <div className="flex gap-1">
                <Button
                  variant={dateMode === "single" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateMode("single"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                  data-testid="button-mode-single"
                  className="flex-1 text-xs"
                >
                  Single Day
                </Button>
                <Button
                  variant={dateMode === "range" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateMode("range"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                  data-testid="button-mode-range"
                  className="flex-1 text-xs"
                >
                  Date Range
                </Button>
                <Button
                  variant={dateMode === "select" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateMode("select"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                  data-testid="button-mode-select"
                  className="flex-1 text-xs"
                >
                  Select Days
                </Button>
              </div>
            </div>

            {/* Calendar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, -7))}
                  data-testid="button-calendar-prev"
                >
                  ←
                </Button>
                <span className="text-sm font-medium">
                  {format(calendarWeekStart, "MMM d")} - {format(addDays(calendarWeekStart, 13), "MMM d, yyyy")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, 7))}
                  data-testid="button-calendar-next"
                >
                  →
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                  <div key={day} className="text-xs text-muted-foreground font-medium py-1">
                    {day}
                  </div>
                ))}
                
                {Array.from({ length: 14 }, (_, i) => {
                  const date = addDays(calendarWeekStart, i);
                  const selected = isDateSelected(date);
                  const filled = isSlotFilled(date);
                  const isToday = isSameDay(date, today);
                  const isPast = date < today && !isToday;
                  
                  return (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      onClick={() => !isPast && handleCalendarDayClick(date)}
                      disabled={isPast}
                      className={`h-10 p-0 relative ${
                        isPast
                          ? "opacity-50 cursor-not-allowed text-muted-foreground"
                          : selected 
                            ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                            : isToday 
                              ? "border border-primary" 
                              : ""
                      }`}
                      data-testid={`calendar-day-${format(date, "yyyy-MM-dd")}`}
                    >
                      {isPast ? (
                        <span className="text-xs text-muted-foreground">✕</span>
                      ) : (
                        <span className="text-xs">{format(date, "d")}</span>
                      )}
                      {filled && !isPast && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500" title="Slot filled" />
                      )}
                    </Button>
                  );
                })}
              </div>

              {dateMode === "range" && rangeStart && !rangeEnd && (
                <p className="text-xs text-muted-foreground text-center">Click another day to complete the range</p>
              )}
              {dateMode === "select" && (
                <p className="text-xs text-muted-foreground text-center">Click to select/deselect days</p>
              )}
            </div>

            {/* Validation hint */}
            {!canAddToPlan() && (
              <p className="text-xs text-amber-600 text-center" data-testid="text-validation-hint">
                Select at least one day to add this recipe to your plan.
              </p>
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleAddToPlanClick} 
              disabled={!canAddToPlan()}
              className="bg-[#ff6300] hover:bg-[#ff6300]/90 text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold"
              data-testid="button-confirm-add"
            >
              <Plus className="w-4 h-4 mr-2" /> Add to Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replacement Warning Dialog */}
      <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-replace-warning">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Replace existing meal?
            </DialogTitle>
            <DialogDescription>
              {pendingDaysWithConflicts.length === 1 
                ? `${format(pendingDaysWithConflicts[0], "EEEE, MMM d")} already has a meal in ${selectedMealType}. Replacing will remove the existing meal from the plan.`
                : `${pendingDaysWithConflicts.length} selected days already have meals in ${selectedMealType}. Replacing will remove those existing meals from the plan.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReplaceDialogOpen(false)} data-testid="button-go-back">
              Go Back
            </Button>
            <Button 
              onClick={() => executeAddToPlan(true)} 
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-replace"
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Cart Modal */}
      <Dialog open={cartDialogOpen} onOpenChange={setCartDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-add-to-cart">
          <DialogHeader>
            <DialogTitle>Add to Cart</DialogTitle>
            <DialogDescription>
              Choose servings to scale ingredients.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Maybe Items Resolution */}
            {pantryStatus.might.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Uncertain Items</label>
                <div className="space-y-1.5">
                  {pantryStatus.might.map((item) => (
                    <div key={item} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-800/30" data-testid={`maybe-item-cart-${item}`}>
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
                          data-testid={`button-have-it-cart-${item}`}
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
                          data-testid={`button-need-it-cart-${item}`}
                        >
                          Need It
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-green-600 hover:bg-green-600/90 text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={() => {
                const missingCorrelationIds = pantryStatus.missing.map(name => {
                  const normalized = normalizeIngredientName(name);
                  return getOrCreateCorrelationId(normalized);
                });
                unitTrace("add_missing_to_cart_clicked", {
                  correlationId: "aggregate",
                  recipeId: recipeSafe.id,
                  recipeName: recipeSafe.title,
                  itemsCount: pantryStatus.missing.length,
                  correlationIds: missingCorrelationIds,
                  sourceType: "recipe_feed",
                });
                const result = addRecipeToCartWithDedupe(recipeSafe, servings, maybeResolutions);
                syncMaybeResolutionsToPantry();
                toast({
                  title: result.added ? "Added to cart" : result.message,
                  description: result.added ? result.message : undefined,
                });
              }}
              data-testid="button-confirm-add-to-cart"
            >
              <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCartDialogOpen(false)}
              data-testid="button-cart-done"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Ingredient Popup - works for recipe cards with local swap tracking */}
      <SwapIngredientPopup
        open={swapPopupOpen}
        onOpenChange={setSwapPopupOpen}
        ingredientName={swapIngredientName}
        onSwapComplete={handleSwapComplete}
        currentOverride={getOverrideForIngredient(swapIngredientName)}
      />
    </div>
  );
}
