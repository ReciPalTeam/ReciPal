import { useState, useCallback, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays, startOfWeek, isSameDay, isWithinInterval, eachDayOfInterval } from "date-fns";
import { Search, Plus, X, Loader2, Minus } from "lucide-react";
import type { MealType } from "@/lib/demo-store";
import { useDemoStore } from "@/lib/demo-store";

type DateSelectionMode = "single" | "range" | "select";
const SCHEDULE_MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Desserts", "Snackitizers"];

interface IngredientEntry {
  foodId: string;
  name: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodSearchResult {
  food_id: string;
  food_name: string;
  food_type: string;
  food_description: string;
  brand_name?: string;
}

function parseNutritionFromDescription(desc: string): { calories: number; fat: number; carbs: number; protein: number; servingDesc: string } {
  const calories = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] || "0");
  const fatMatch = desc.match(/(?:Total\s+)?Fat:\s*([\d.]+)/i);
  const fat = parseFloat(fatMatch?.[1] || "0");
  const carbsMatch = desc.match(/(?:Carbs|Carbohydrate|Carbohydrates|Total\s+Carb)(?:s)?:\s*([\d.]+)/i);
  const carbs = parseFloat(carbsMatch?.[1] || "0");
  const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] || "0");
  const servingMatch = desc.match(/^Per\s+(.+?)\s*-/i);
  const servingDesc = servingMatch?.[1] || "1 serving";
  return { calories, fat, carbs, protein, servingDesc };
}

interface ManualEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRecipe?: {
    id: number;
    name: string;
    ingredients: IngredientEntry[];
  } | null;
}

export function ManualEntrySheet({ open, onOpenChange, editingRecipe }: ManualEntrySheetProps) {
  const { toast } = useToast();
  const { acceleratePantryDecay, planner } = useDemoStore();
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const [name, setName] = useState("");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");
  const [dateMode, setDateMode] = useState<DateSelectionMode>("single");
  const [calendarWeekStart, setCalendarWeekStart] = useState(weekStart);
  const [selectedDates, setSelectedDates] = useState<Date[]>([today]);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  const [ingredients, setIngredients] = useState<IngredientEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCacheRef = useRef<Map<string, FoodSearchResult[]>>(new Map());

  const isEditing = !!editingRecipe;

  useEffect(() => {
    if (open && editingRecipe) {
      setName(editingRecipe.name);
      setIngredients(editingRecipe.ingredients);
    }
  }, [open, editingRecipe]);

  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const cached = searchCacheRef.current.get(query.toLowerCase());
    if (cached) {
      setSearchResults(cached);
      setShowResults(true);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/fatsecret/foods/search?query=${encodeURIComponent(query)}&max_results=8`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      let foods: FoodSearchResult[] = [];
      if (data?.foods?.food) {
        foods = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food];
      }
      searchCacheRef.current.set(query.toLowerCase(), foods);
      setSearchResults(foods);
      setShowResults(true);
    } catch {
      toast({ title: "Search error", description: "Could not search for foods", variant: "destructive" });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => handleSearch(value), 400);
  };

  const addIngredient = async (food: FoodSearchResult) => {
    const fallbackNutrition = parseNutritionFromDescription(food.food_description);
    const displayName = food.brand_name ? `${food.food_name} (${food.brand_name})` : food.food_name;

    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);

    let bestServing: { unit: string; calories: number; protein: number; carbs: number; fat: number } | null = null;

    try {
      const res = await fetch(`/api/fatsecret/foods/${food.food_id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const servingsRaw = data?.food?.servings?.serving;
        if (servingsRaw) {
          const servings = Array.isArray(servingsRaw) ? servingsRaw : [servingsRaw];
          const preferred = servings.find((s: any) => {
            const desc = (s.serving_description || "").toLowerCase();
            return desc !== "100 g" && desc !== "100g" && desc !== "1 g" && desc !== "1g";
          });
          const serving = preferred || servings[0];
          if (serving) {
            bestServing = {
              unit: serving.serving_description || fallbackNutrition.servingDesc,
              calories: Math.round(parseFloat(serving.calories) || 0),
              protein: Math.round(parseFloat(serving.protein) || 0),
              carbs: Math.round(parseFloat(serving.carbohydrate) || 0),
              fat: Math.round(parseFloat(serving.fat) || 0),
            };
          }
        }
      }
    } catch {
    }

    const nutrition = bestServing || {
      unit: fallbackNutrition.servingDesc,
      calories: Math.round(fallbackNutrition.calories),
      protein: Math.round(fallbackNutrition.protein),
      carbs: Math.round(fallbackNutrition.carbs),
      fat: Math.round(fallbackNutrition.fat),
    };

    const newIngredient: IngredientEntry = {
      foodId: food.food_id,
      name: displayName,
      amount: 1,
      unit: nutrition.unit,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
    };
    setIngredients(prev => [...prev, newIngredient]);
  };

  const updateIngredientAmount = (index: number, newAmount: number) => {
    if (newAmount < 0.25) return;
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing;
      const originalNutrition = parseNutritionFromDescription("");
      const ratio = newAmount / ing.amount;
      return {
        ...ing,
        amount: newAmount,
        calories: Math.round(ing.calories * ratio),
        protein: Math.round(ing.protein * ratio),
        carbs: Math.round(ing.carbs * ratio),
        fat: Math.round(ing.fat * ratio),
      };
    }));
  };

  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const getSelectedDatesToSchedule = (): Date[] => {
    if (dateMode === "single") return selectedDates.slice(0, 1);
    if (dateMode === "range" && rangeStart && rangeEnd) return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    if (dateMode === "select") return selectedDates;
    return [];
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

  const resetForm = () => {
    setName("");
    setIngredients([]);
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    setSelectedMealType("Lunch");
    setDateMode("single");
    setSelectedDates([today]);
    setRangeStart(null);
    setRangeEnd(null);
    setCalendarWeekStart(weekStart);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Please enter a meal name", variant: "destructive" });
      return;
    }
    if (ingredients.length === 0) {
      toast({ title: "Error", description: "Please add at least one ingredient", variant: "destructive" });
      return;
    }

    if (isEditing) {
      setIsSaving(true);
      try {
        await apiRequest('PUT', `/api/custom-recipes/${editingRecipe!.id}`, {
          name: name.trim(),
          ingredients,
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/custom-recipes'] });
        resetForm();
        toast({ title: "Updated", description: "Custom recipe updated" });
        onOpenChange(false);
      } catch {
        toast({ title: "Error", description: "Failed to update recipe", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const datesToLog = getSelectedDatesToSchedule();
    if (datesToLog.length === 0) {
      toast({ title: "Error", description: "Please select at least one date", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest('POST', '/api/custom-recipes', {
        name: name.trim(),
        ingredients,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
      });

      for (const date of datesToLog) {
        await apiRequest('POST', '/api/consumption-logs', {
          date: format(date, 'yyyy-MM-dd'),
          name: name.trim(),
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          mealSlot: selectedMealType,
          sourceType: 'manual_custom_entry',
        });
      }

      acceleratePantryDecay(ingredients.map(i => i.name));

      queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-recipes'] });
      resetForm();
      toast({
        title: "Meal saved",
        description: `"${name.trim()}" added to your log${datesToLog.length > 1 ? ` for ${datesToLog.length} days` : ""} and saved as a custom recipe`,
      });
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to save meal", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">{isEditing ? "Edit Recipe" : "Build a Meal"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Meal Name</Label>
            <Input
              placeholder="e.g., Morning Protein Bowl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              data-testid="input-manual-name"
            />
          </div>

          {!isEditing && (
            <div className="space-y-1">
              <Label className="text-xs">Meal Slot</Label>
              <Select value={selectedMealType} onValueChange={(v) => setSelectedMealType(v as MealType)}>
                <SelectTrigger data-testid="select-manual-meal-slot">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Ingredients</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search foods (e.g., chicken breast, rice)"
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                className="h-9 text-sm pl-8"
                data-testid="input-ingredient-search"
                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
              />
              {isSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto bg-background shadow-md" data-testid="food-search-results">
                {searchResults.map((food) => {
                  const nutrition = parseNutritionFromDescription(food.food_description);
                  return (
                    <button
                      key={food.food_id}
                      className="w-full text-left px-3 py-2 hover-elevate border-b last:border-0 transition-colors"
                      onClick={() => addIngredient(food)}
                      data-testid={`food-result-${food.food_id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{food.food_name}</p>
                          {food.brand_name && (
                            <p className="text-[10px] text-muted-foreground">{food.brand_name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant="outline" className="text-[9px] px-1">{Math.round(nutrition.calories)} cal</Badge>
                          <Plus className="w-4 h-4 text-green-600" />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {nutrition.servingDesc} &middot; P: {Math.round(nutrition.protein)}g &middot; C: {Math.round(nutrition.carbs)}g &middot; F: {Math.round(nutrition.fat)}g
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {showResults && searchResults.length === 0 && searchQuery && !isSearching && (
              <p className="text-xs text-muted-foreground text-center py-2">No foods found for "{searchQuery}"</p>
            )}
          </div>

          {ingredients.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Added Ingredients ({ingredients.length})</Label>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1.5 px-2 rounded-md border bg-muted/30" data-testid={`ingredient-entry-${idx}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{ing.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {ing.calories} cal &middot; P:{ing.protein}g C:{ing.carbs}g F:{ing.fat}g
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateIngredientAmount(idx, Math.max(0.25, ing.amount - 0.5))}
                        data-testid={`button-decrease-${idx}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs font-medium min-w-[24px] text-center">{ing.amount}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateIngredientAmount(idx, ing.amount + 0.5)}
                        data-testid={`button-increase-${idx}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{ing.unit}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeIngredient(idx)}
                        data-testid={`button-remove-ingredient-${idx}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Card className="bg-muted/50">
                <CardContent className="p-2">
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div>
                      <p className="text-xs font-bold text-recipal-orange">{totals.calories}</p>
                      <p className="text-[9px] text-muted-foreground">Calories</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-green-600">{totals.protein}g</p>
                      <p className="text-[9px] text-muted-foreground">Protein</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-600">{totals.carbs}g</p>
                      <p className="text-[9px] text-muted-foreground">Carbs</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-purple-600">{totals.fat}g</p>
                      <p className="text-[9px] text-muted-foreground">Fat</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!isEditing && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Date Selection</Label>
                <div className="flex gap-1">
                  <Button
                    variant={dateMode === "single" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDateMode("single"); setSelectedDates([today]); setRangeStart(null); setRangeEnd(null); }}
                    data-testid="button-manual-mode-single"
                    className="flex-1 text-xs"
                  >
                    Single Day
                  </Button>
                  <Button
                    variant={dateMode === "range" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDateMode("range"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                    data-testid="button-manual-mode-range"
                    className="flex-1 text-xs"
                  >
                    Date Range
                  </Button>
                  <Button
                    variant={dateMode === "select" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDateMode("select"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                    data-testid="button-manual-mode-select"
                    className="flex-1 text-xs"
                  >
                    Select Days
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, -7))}
                    data-testid="button-manual-calendar-prev"
                  >
                    &larr;
                  </Button>
                  <span className="text-sm font-medium" data-testid="text-manual-calendar-range">
                    {format(calendarWeekStart, "MMM d")} - {format(addDays(calendarWeekStart, 13), "MMM d, yyyy")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, 7))}
                    data-testid="button-manual-calendar-next"
                  >
                    &rarr;
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
                    const isToday = isSameDay(date, today);
                    const isPast = date < today && !isToday;
                    const dateStr = format(date, "yyyy-MM-dd");
                    const filled = planner.some(m => m.date === dateStr && m.mealType === selectedMealType);
                    
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
                              ? "bg-primary text-primary-foreground" 
                              : isToday 
                                ? "border border-primary" 
                                : ""
                        }`}
                        data-testid={`manual-calendar-day-${dateStr}`}
                      >
                        {isPast ? (
                          <span className="text-xs text-muted-foreground">&times;</span>
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
            </>
          )}

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-recipal-orange"
            data-testid="button-manual-save"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Save Meal"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
