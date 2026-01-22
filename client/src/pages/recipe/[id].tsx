import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Heart, Share2, Clock, Users, Flame, Plus, Check, HelpCircle, ShoppingCart, ChefHat, Calendar, Minus, AlertTriangle, Repeat, Undo2 } from "lucide-react";
import { classifyIngredient, getCategoryColor, getIngredientNutritionEstimate } from "@/lib/ingredient-classifier";
import { mockRecipes, Recipe } from "@/lib/mock-data";
import { useDemoStore, MealType, IngredientOverride } from "@/lib/demo-store";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, isSameDay, isWithinInterval, eachDayOfInterval } from "date-fns";
import { SwapIngredientPopup } from "@/components/swap-ingredient-popup";
import type { SwapSuggestion } from "@/lib/swap-suggestions";

type DateSelectionMode = "single" | "range" | "select";
const SCHEDULE_MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Desserts", "Snackitizers"];

export default function RecipeDetailPage() {
  const [, params] = useRoute("/recipe/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [cartServings, setCartServings] = useState(1);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");
  const [dateMode, setDateMode] = useState<DateSelectionMode>("single");
  const [servings, setServings] = useState(1);
  const [swapPopupOpen, setSwapPopupOpen] = useState(false);
  const [swapIngredientName, setSwapIngredientName] = useState("");
  const [localSwaps, setLocalSwaps] = useState<IngredientOverride[]>([]);
  
  // Calendar state
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const [calendarWeekStart, setCalendarWeekStart] = useState(weekStart);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [pendingDaysWithConflicts, setPendingDaysWithConflicts] = useState<Date[]>([]);

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
    getMealAtSlot
  } = useDemoStore();

  const recipe = mockRecipes.find((r: Recipe) => r.id === params?.id);

  if (!recipe) {
    return (
      <div className="p-4 text-center">
        <p>Recipe not found</p>
        <Button onClick={() => setLocation("/recipes")} className="mt-4">Back to Recipes</Button>
      </div>
    );
  }

  const recipeSafe = recipe;
  const pantryStatus = getPantryOverlap(recipeSafe);
  const isFavorite = favorites.includes(recipeSafe.id);

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
      const dayIndex = ((date.getDay() + 6) % 7); // Convert to Monday=0
      const dateStr = format(date, "yyyy-MM-dd");
      const existingMeal = planner.find(m => 
        (m.date === dateStr && m.mealType === selectedMealType) ||
        (!m.date && m.dayIndex === dayIndex && m.mealType === selectedMealType)
      );
      if (existingMeal) {
        conflicts.push(date);
      }
    });
    
    return conflicts;
  };

  // Check if a specific date has a meal in the selected slot
  const isSlotFilled = (date: Date): boolean => {
    const dayIndex = ((date.getDay() + 6) % 7);
    const dateStr = format(date, "yyyy-MM-dd");
    return planner.some(m => 
      (m.date === dateStr && m.mealType === selectedMealType) ||
      (!m.date && m.dayIndex === dayIndex && m.mealType === selectedMealType)
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

  const adjustedNutrition = useMemo(() => {
    let baseCals = recipeSafe.calories || 0;
    let baseProtein = recipeSafe.protein || 0;
    let baseCarbs = recipeSafe.carbs || 0;
    let baseFat = recipeSafe.fat || 0;
    
    localSwaps.forEach(override => {
      const originalNutrition = getIngredientNutritionEstimate(override.originalIngredientName);
      baseCals += override.replacementNutrition.calories - originalNutrition.calories;
      baseProtein += override.replacementNutrition.protein - originalNutrition.protein;
      baseCarbs += override.replacementNutrition.carbs - originalNutrition.carbs;
      baseFat += override.replacementNutrition.fat - originalNutrition.fat;
    });
    
    return {
      calories: Math.max(0, baseCals),
      protein: Math.max(0, baseProtein),
      carbs: Math.max(0, baseCarbs),
      fat: Math.max(0, baseFat),
    };
  }, [recipeSafe.calories, recipeSafe.protein, recipeSafe.carbs, recipeSafe.fat, localSwaps]);

  const hasSwaps = localSwaps.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
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
            className="bg-white/20 backdrop-blur-sm text-white"
            onClick={() => setLocation("/recipes")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`bg-white/20 backdrop-blur-sm text-white ${isFavorite ? "text-red-400" : ""}`}
              onClick={() => toggleFavorite(recipe.id)}
              data-testid="button-favorite"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="bg-white/20 backdrop-blur-sm text-white"
              onClick={handleShare}
              data-testid="button-share"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h1 className="font-bold mb-2 text-[#ff6300] whitespace-nowrap overflow-hidden text-ellipsis" style={{ WebkitTextStroke: '4px white', paintOrder: 'stroke fill', fontSize: 'clamp(1rem, 7.5vw, 30px)' }}>{recipeSafe.title}</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {recipeSafe.cookTime}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {recipeSafe.servings} servings
            </span>
            <span className="flex items-center gap-1">
              <Flame className="w-4 h-4" /> {adjustedNutrition.calories} cal
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {hasSwaps && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              {localSwaps.length} ingredient{localSwaps.length > 1 ? 's' : ''} swapped in this recipe
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-recipal-orange/10 border-recipal-orange/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-recipal-orange">{adjustedNutrition.protein}g</p>
              <p className="text-[10px] text-muted-foreground">Protein</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-primary">{adjustedNutrition.carbs}g</p>
              <p className="text-[10px] text-muted-foreground">Carbs</p>
            </CardContent>
          </Card>
          <Card className="bg-recipal-deep-green/10 border-recipal-deep-green/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-recipal-deep-green">{adjustedNutrition.fat}g</p>
              <p className="text-[10px] text-muted-foreground">Fat</p>
            </CardContent>
          </Card>
        </div>

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

        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="ingredients" data-testid="tab-ingredients">Ingredients</TabsTrigger>
            <TabsTrigger value="steps" data-testid="tab-steps">Steps</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ingredients" className="mt-4">
            <div className="space-y-2">
              {recipeSafe.ingredients.map((ing, idx) => {
                const override = getOverrideForIngredient(ing.name);
                const displayName = getDisplayName(ing.name);
                const status = getIngredientStatus(ing.name);
                const category = classifyIngredient(displayName);
                const categoryColor = getCategoryColor(category);
                
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
                      <Badge variant="outline" className={`text-[9px] px-1.5 flex-shrink-0 ${categoryColor}`} data-testid={`badge-category-${idx}`}>
                        {category}
                      </Badge>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm truncate">{displayName}</span>
                        {override && (
                          <span className="text-[10px] text-muted-foreground line-through">
                            was: {ing.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{ing.amount} {ing.unit}</span>
                      {override ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-blue-600"
                          onClick={() => handleUndoSwap(ing.name)}
                          data-testid={`button-undo-swap-${idx}`}
                        >
                          <Undo2 className="h-3 w-3" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setSwapIngredientName(ing.name);
                          setSwapPopupOpen(true);
                        }}
                        data-testid={`button-swap-${idx}`}
                      >
                        <Repeat className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="steps" className="mt-4">
            <div className="space-y-4">
              {recipeSafe.steps.map((step, idx) => (
                <div key={idx} className="flex gap-3" data-testid={`step-${idx}`}>
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-sm">{step}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t space-y-2">
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
              className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90 font-bold h-12"
              onClick={() => setPlanDialogOpen(true)}
              data-testid="button-add-to-plan"
            >
              <Calendar className="w-5 h-5 mr-2" /> Add to Plan
            </Button>
            <Button 
              className="h-12 px-4 bg-green-600 hover:bg-green-600/90 text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={() => setCartDialogOpen(true)}
              data-testid="button-add-to-cart"
            >
              <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
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
                  
                  return (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCalendarDayClick(date)}
                      className={`h-10 p-0 relative ${
                        selected 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : isToday 
                            ? "border border-primary" 
                            : ""
                      }`}
                      data-testid={`calendar-day-${format(date, "yyyy-MM-dd")}`}
                    >
                      <span className="text-xs">{format(date, "d")}</span>
                      {filled && (
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

            {/* Serving Size */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Servings</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setServings(Math.max(1, servings - 1))}
                  disabled={servings <= 1}
                  data-testid="button-servings-minus"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-12 text-center font-medium" data-testid="text-servings">
                  {servings >= 10 ? "10+" : servings}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setServings(Math.min(10, servings + 1))}
                  disabled={servings >= 10}
                  data-testid="button-servings-plus"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
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
          
          <div className="py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Servings</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCartServings(s => Math.max(1, s - 1))}
                  disabled={cartServings <= 1}
                  data-testid="button-cart-servings-minus"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-xl font-bold min-w-[3rem] text-center" data-testid="text-cart-servings">
                  {cartServings >= 10 ? "10+" : cartServings}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCartServings(s => Math.min(10, s + 1))}
                  disabled={cartServings >= 10}
                  data-testid="button-cart-servings-plus"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-green-600 hover:bg-green-600/90 text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={() => {
                const result = addRecipeToCartWithDedupe(recipeSafe, cartServings);
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
