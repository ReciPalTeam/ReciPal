import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays, startOfWeek, isSameDay, isWithinInterval, eachDayOfInterval } from "date-fns";
import { Search, Plus, X, Loader2, Minus, ScanBarcode } from "lucide-react";
import type { MealType } from "@/lib/demo-store";
import { useDemoStore, getIngredientFoodGroup } from "@/lib/demo-store";
import { getDefaultPantryUnit, getAlternateUnits, getUnitDef } from "@/lib/pantry-units";
import { isNativeApp } from "@/lib/capacitor-utils";
import { useChefMe } from "@/hooks/use-chef";

type DateSelectionMode = "single" | "range" | "select";
const SCHEDULE_MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Desserts", "Snackitizers"];

// #3 "Brand Orange" section-label treatment — bold deep-orange text with a small orange accent bar.
const SECTION_LABEL =
  "text-xs font-bold text-[#d45400] mb-1.5 flex items-center gap-1.5 before:content-[''] before:inline-block before:w-[3px] before:h-3 before:rounded-full before:bg-[#ff6300]";

interface IngredientEntry {
  foodId: string;
  name: string;
  amount: number;
  unit: string;
  foodGroup: string;
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
  const { acceleratePantryDecay, planner, addToPlanner } = useDemoStore();
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  // Chef-creator awareness: gates the new "Creator / Personal" save-target dropdown.
  const { data: chefData } = useChefMe();
  const isChefApproved = chefData?.profile?.isApproved ?? false;
  const [saveTarget, setSaveTarget] = useState<"personal" | "creator">("personal");

  const [name, setName] = useState("");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");
  const [alreadyConsumed, setAlreadyConsumed] = useState(false);
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
  const barcodeFileRef = useRef<HTMLInputElement>(null);
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
      const [fatSecretResult, supabaseResult] = await Promise.allSettled([
        fetch(`/api/fatsecret/foods/search?query=${encodeURIComponent(query)}&max_results=8`, {
          credentials: 'include',
        }).then(r => { if (!r.ok) throw new Error("Search failed"); return r.json(); }),
        fetch(`/api/recipes/search?q=${encodeURIComponent(query)}&limit=5`, {
          credentials: 'include',
        }).then(r => { if (!r.ok) throw new Error("Recipe search failed"); return r.json(); }),
      ]);

      let fatSecretFoods: FoodSearchResult[] = [];
      if (fatSecretResult.status === 'fulfilled') {
        const data = fatSecretResult.value;
        if (data?.foods?.food) {
          fatSecretFoods = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food];
        }
      }

      let supabaseFoods: FoodSearchResult[] = [];
      if (supabaseResult.status === 'fulfilled') {
        const recipes = supabaseResult.value?.recipes || supabaseResult.value || [];
        if (Array.isArray(recipes)) {
          supabaseFoods = recipes.map((r: any) => ({
            food_id: `supabase-${r.id}`,
            food_name: r.title || r.name || '',
            food_type: 'Recipe',
            food_description: `Per serving - Calories: ${Math.round(r.calories || 0)}kcal | Fat: ${Number(r.fat || 0).toFixed(2)}g | Carbs: ${Number(r.carbs || 0).toFixed(2)}g | Protein: ${Number(r.protein || 0).toFixed(2)}g`,
            brand_name: '',
          }));
        }
      }

      const supabaseNames = new Set(supabaseFoods.map(f => f.food_name.toLowerCase()));
      const dedupedFatSecret = fatSecretFoods.filter(f => !supabaseNames.has(f.food_name.toLowerCase()));

      const combined = [...supabaseFoods, ...dedupedFatSecret].slice(0, 12);
      searchCacheRef.current.set(query.toLowerCase(), combined);
      setSearchResults(combined);
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
            let unitDesc = serving.serving_description || fallbackNutrition.servingDesc;
            unitDesc = unitDesc.replace(/\s*\([^)]*\)\s*$/, '').trim();
            bestServing = {
              unit: unitDesc,
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
      unit: fallbackNutrition.servingDesc.replace(/\s*\([^)]*\)\s*$/, '').trim(),
      calories: Math.round(fallbackNutrition.calories),
      protein: Math.round(fallbackNutrition.protein),
      carbs: Math.round(fallbackNutrition.carbs),
      fat: Math.round(fallbackNutrition.fat),
    };

    const foodGroup = getIngredientFoodGroup(displayName);
    const detected = getDefaultPantryUnit(displayName, foodGroup);

    const newIngredient: IngredientEntry = {
      foodId: food.food_id,
      name: displayName,
      amount: detected.min,
      unit: detected.unit,
      foodGroup,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
    };
    setIngredients(prev => [...prev, newIngredient]);
  };

  const lookupBarcodeAndAddIngredient = async (digits: string) => {
    try {
      const resp = await fetch(`/api/fatsecret/barcode?barcode=${encodeURIComponent(digits)}`, { credentials: 'include' });
      if (!resp.ok) throw new Error('Barcode lookup failed');
      const data = await resp.json();
      const food = data?.food;
      if (!food) {
        toast({ title: "Not found", description: "Couldn't identify this product", variant: "destructive" });
        return;
      }
      const displayName = food.brand_name ? `${food.food_name} (${food.brand_name})` : food.food_name;
      const servingsRaw = food?.servings?.serving;
      let bestServing: { unit: string; calories: number; protein: number; carbs: number; fat: number } | null = null;
      if (servingsRaw) {
        const servings = Array.isArray(servingsRaw) ? servingsRaw : [servingsRaw];
        const preferred = servings.find((s: any) => {
          const desc = (s.serving_description || "").toLowerCase();
          return desc !== "100 g" && desc !== "100g" && desc !== "1 g" && desc !== "1g";
        });
        const serving = preferred || servings[0];
        if (serving) {
          const rawUnit = serving.serving_description || "1 serving";
          const unit = rawUnit.replace(/\s*\(.*?\)\s*/g, '').trim() || rawUnit;
          bestServing = {
            unit,
            calories: Math.round(parseFloat(serving.calories) || 0),
            protein: Math.round(parseFloat(serving.protein) || 0),
            carbs: Math.round(parseFloat(serving.carbohydrate) || 0),
            fat: Math.round(parseFloat(serving.fat) || 0),
          };
        }
      }
      const nutrition = bestServing || { unit: "1 serving", calories: 0, protein: 0, carbs: 0, fat: 0 };
      const barcodeGroup = getIngredientFoodGroup(displayName);
      const barcodeDetected = getDefaultPantryUnit(displayName, barcodeGroup);
      const newIngredient: IngredientEntry = {
        foodId: food.food_id ? String(food.food_id) : `barcode-${digits}`,
        name: displayName,
        amount: barcodeDetected.min,
        unit: barcodeDetected.unit,
        foodGroup: barcodeGroup,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
      };
      setIngredients(prev => [...prev, newIngredient]);
      toast({ title: "Item scanned", description: `${food.food_name} added to ingredients` });
    } catch {
      toast({ title: "Scan failed", description: "Could not look up barcode", variant: "destructive" });
    }
  };

  const handleBarcodeScan = async () => {
    if (isNativeApp()) {
      try {
        const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
        const { barcodes } = await BarcodeScanner.scan();
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          await lookupBarcodeAndAddIngredient(barcodes[0].rawValue);
        } else {
          toast({ title: "No barcode", description: "No barcode detected. Try again?", variant: "destructive" });
        }
      } catch {
        toast({ title: "Scanner error", description: "Scanner failed. Try uploading an image instead.", variant: "destructive" });
      }
    } else {
      barcodeFileRef.current?.click();
    }
  };

  const handleBarcodeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const imgEl = document.createElement('img');
      const url = URL.createObjectURL(file);
      imgEl.src = url;
      await new Promise<void>((res, rej) => { imgEl.onload = () => res(); imgEl.onerror = () => rej(); });
      const result = await reader.decodeFromImageElement(imgEl);
      URL.revokeObjectURL(url);
      const digits = result.getText();
      if (digits) {
        await lookupBarcodeAndAddIngredient(digits);
      } else {
        toast({ title: "No barcode", description: "Could not read barcode from image", variant: "destructive" });
      }
    } catch {
      toast({ title: "Scan failed", description: "Could not read barcode from image", variant: "destructive" });
    }
    if (barcodeFileRef.current) barcodeFileRef.current.value = '';
  };

  const updateIngredientAmount = (index: number, newAmount: number) => {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing;
      const unitDef = getUnitDef(ing.unit);
      const clamped = Math.max(unitDef.min, newAmount);
      const ratio = clamped / ing.amount;
      return {
        ...ing,
        amount: clamped,
        calories: Math.round(ing.calories * ratio),
        protein: Math.round(ing.protein * ratio),
        carbs: Math.round(ing.carbs * ratio),
        fat: Math.round(ing.fat * ratio),
      };
    }));
  };

  const updateIngredientUnit = (index: number, newUnit: string) => {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing;
      const def = getUnitDef(newUnit);
      return { ...ing, unit: newUnit, amount: Math.max(def.min, ing.amount) };
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
    setAlreadyConsumed(false);
    setDateMode("single");
    setSelectedDates([today]);
    setRangeStart(null);
    setRangeEnd(null);
    setSaveTarget("personal");
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

    // Chef saving to their public library — different endpoint, no calendar scheduling.
    if (isChefApproved && saveTarget === "creator") {
      setIsSaving(true);
      try {
        await apiRequest("POST", "/api/chef-recipes", {
          title: name.trim(),
          ingredients: ingredients.map((i) => ({
            name: i.name,
            amount: String(i.amount),
            unit: i.unit,
          })),
          steps: [],
          source: "manual",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/chef-recipes/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/chef"] });
        resetForm();
        toast({ title: "Published", description: "Recipe is now on your Creator Page" });
        onOpenChange(false);
      } catch (err: any) {
        toast({ title: "Couldn't publish", description: err?.message ?? "Try again", variant: "destructive" });
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
      const savedRecipe = await apiRequest('POST', '/api/custom-recipes', {
        name: name.trim(),
        ingredients,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
      });
      const recipeData = await savedRecipe.json();
      const recipeId = recipeData?.id ? String(recipeData.id) : `custom-${Date.now()}`;

      for (const date of datesToLog) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const day = date;
        const dayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1;
        addToPlanner({
          recipeId,
          date: dateStr,
          dayIndex,
          mealType: selectedMealType,
          servings: 1,
        });
      }

      let logsRecorded = true;
      const sourceType = alreadyConsumed ? 'cooknow_logged_recipe' : 'manual_custom_entry';
      try {
        for (const date of datesToLog) {
          await apiRequest('POST', '/api/consumption-logs', {
            date: format(date, 'yyyy-MM-dd'),
            name: name.trim(),
            calories: totals.calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            mealSlot: selectedMealType,
            sourceType,
          });
        }
      } catch {
        logsRecorded = false;
      }

      if (alreadyConsumed) {
        acceleratePantryDecay(ingredients.map(i => i.name));
      }

      queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/custom-recipes'] });
      const mealName = name.trim();
      const dayCount = datesToLog.length > 1 ? ` for ${datesToLog.length} days` : "";
      const wasConsumed = alreadyConsumed;
      resetForm();
      toast({
        title: "Meal saved",
        description: logsRecorded
          ? `"${mealName}" ${wasConsumed ? "logged as eaten" : "added to plan"}${dayCount} and saved as a custom recipe`
          : `"${mealName}" saved as a custom recipe`,
      });
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to save meal", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetForm(); onOpenChange(val); }}>
      <DialogContent
        className="max-w-md p-0 gap-0 max-h-[85vh] flex flex-col"
        overlayClassName="bg-black/35 backdrop-blur-md"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.5)',
        }}
        data-testid="dialog-build-a-meal"
      >
        {/* #3 Brand Orange — gradient header band */}
        <div className="shrink-0 bg-gradient-to-br from-[#ff8533] to-[#ff6300] px-6 py-4 text-center">
          <DialogTitle className="text-white text-lg font-bold tracking-tight">
            {isEditing ? "Edit Recipe" : "Build a Meal"}
          </DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div>
            <Label className={SECTION_LABEL}>Meal Name</Label>
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
              <Label className={SECTION_LABEL}>Meal Slot</Label>
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
              <div className="flex items-center gap-2">
                <Checkbox id="already-consumed" checked={alreadyConsumed} onCheckedChange={(checked) => setAlreadyConsumed(!!checked)} data-testid="checkbox-already-consumed" />
                <label htmlFor="already-consumed" className="text-xs font-medium cursor-pointer select-none">Already Consumed</label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className={SECTION_LABEL}>Ingredients</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search foods (e.g., chicken breast, rice)"
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                className="h-9 text-sm pl-8 pr-10"
                data-testid="input-ingredient-search"
                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
              />
              <button onClick={handleBarcodeScan} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition-opacity" data-testid="button-ingredient-barcode">
                <ScanBarcode className="w-4 h-4 text-green-800" />
              </button>
              <input ref={barcodeFileRef} type="file" accept="image/*" className="hidden" onChange={handleBarcodeFileUpload} />
              {isSearching && <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto bg-background shadow-md" style={{ contain: 'layout' }} data-testid="food-search-results">
                {searchResults.map((food) => {
                  const nutrition = parseNutritionFromDescription(food.food_description);
                  return (
                    <button
                      key={food.food_id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0 transition-colors"
                      style={{ minHeight: '48px' }}
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
                        <Plus className="w-4 h-4 text-green-600 flex-shrink-0" />
                      </div>
                      <p className="text-[10px] mt-0.5">
                        {!/^100\s*g$/i.test(nutrition.servingDesc) && <><span className="text-muted-foreground">{nutrition.servingDesc}</span> <span className="text-muted-foreground">&middot;</span> </>}
                        <span className="text-recipal-orange font-medium">P: {Math.round(nutrition.protein)}g</span>
                        <span className="text-muted-foreground"> &middot; </span>
                        <span className="text-green-600 font-medium">C: {Math.round(nutrition.carbs)}g</span>
                        <span className="text-muted-foreground"> &middot; </span>
                        <span className="text-blue-600 font-medium">F: {Math.round(nutrition.fat)}g</span>
                        <span className="text-muted-foreground"> &middot; </span>
                        <span className="text-yellow-600 font-medium">Cal: {Math.round(nutrition.calories)}</span>
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
                <Label className={SECTION_LABEL}>Added Ingredients ({ingredients.length})</Label>
              </div>
              <div className="space-y-2">
                {ingredients.map((ing, idx) => {
                  const unitDef = getUnitDef(ing.unit);
                  const fmtQty = ing.amount % 1 === 0 ? ing.amount : ing.amount.toFixed(ing.amount >= 1 ? 1 : 2);
                  return (
                    <div key={idx} className="relative px-3 py-2.5 rounded-lg border bg-muted/30" data-testid={`ingredient-entry-${idx}`}>
                      <button
                        onClick={() => removeIngredient(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        data-testid={`button-remove-ingredient-${idx}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ing.name}</p>
                        <p className="text-[10px]">
                          <span className="text-recipal-orange font-medium">P: {ing.protein}g</span>
                          <span className="text-muted-foreground"> &middot; </span>
                          <span className="text-green-600 font-medium">C: {ing.carbs}g</span>
                          <span className="text-muted-foreground"> &middot; </span>
                          <span className="text-blue-600 font-medium">F: {ing.fat}g</span>
                          <span className="text-muted-foreground"> &middot; </span>
                          <span className="text-yellow-600 font-medium">Cal: {ing.calories}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() => {
                            const newAmt = Math.max(unitDef.min, +(ing.amount - unitDef.step).toFixed(2));
                            updateIngredientAmount(idx, newAmt);
                          }}
                          disabled={ing.amount <= unitDef.min}
                          data-testid={`button-decrease-${idx}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-semibold w-10 text-center tabular-nums" data-testid={`text-qty-${idx}`}>
                          {fmtQty}
                        </span>
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted/80 transition-colors"
                          onClick={() => {
                            const newAmt = +(ing.amount + unitDef.step).toFixed(2);
                            updateIngredientAmount(idx, newAmt);
                          }}
                          data-testid={`button-increase-${idx}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <Select value={ing.unit} onValueChange={(v) => updateIngredientUnit(idx, v)}>
                          <SelectTrigger className="h-7 w-[95px] text-xs" data-testid={`select-unit-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getAlternateUnits(ing.foodGroup).map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Macro totals — app's MacroPills vocabulary (colored top stripe + bold value + uppercase label) */}
              <div className="flex items-stretch gap-1.5">
                <div className="relative overflow-hidden rounded-md bg-white/70 dark:bg-white/[0.04] border border-gray-200/40 dark:border-white/[0.06] px-2 py-1.5 text-center flex-1 flex flex-col items-center">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#ff6300] to-[#ff8533]" />
                  <span className="text-[13px] font-extrabold leading-none mt-1" style={{ color: '#ff6300' }}>{totals.protein}g</span>
                  <span className="text-[7px] font-semibold leading-none text-gray-400 uppercase tracking-wider mt-1">Protein</span>
                </div>
                <div className="relative overflow-hidden rounded-md bg-white/70 dark:bg-white/[0.04] border border-gray-200/40 dark:border-white/[0.06] px-2 py-1.5 text-center flex-1 flex flex-col items-center">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#2ecc71] to-[#27ae60]" />
                  <span className="text-[13px] font-extrabold leading-none mt-1" style={{ color: '#2ecc71' }}>{totals.carbs}g</span>
                  <span className="text-[7px] font-semibold leading-none text-gray-400 uppercase tracking-wider mt-1">Carbs</span>
                </div>
                <div className="relative overflow-hidden rounded-md bg-white/70 dark:bg-white/[0.04] border border-gray-200/40 dark:border-white/[0.06] px-2 py-1.5 text-center flex-1 flex flex-col items-center">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#3498db] to-[#2980b9]" />
                  <span className="text-[13px] font-extrabold leading-none mt-1" style={{ color: '#3498db' }}>{totals.fat}g</span>
                  <span className="text-[7px] font-semibold leading-none text-gray-400 uppercase tracking-wider mt-1">Fat</span>
                </div>
                <div className="relative overflow-hidden rounded-md bg-white/70 dark:bg-white/[0.04] border border-gray-200/40 dark:border-white/[0.06] px-2 py-1.5 text-center flex-1 flex flex-col items-center">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#f1c40f] to-[#e67e22]" />
                  <span className="text-[13px] font-extrabold leading-none mt-1" style={{ color: '#e67e22' }}>{totals.calories}</span>
                  <span className="text-[7px] font-semibold leading-none text-gray-400 uppercase tracking-wider mt-1">Calories</span>
                </div>
              </div>
            </div>
          )}

          {!isEditing && (
            <>
              <div className="space-y-1">
                <Label className={SECTION_LABEL}>Date Selection</Label>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setDateMode("single"); setSelectedDates([today]); setRangeStart(null); setRangeEnd(null); }}
                    data-testid="button-manual-mode-single"
                    className={`flex-1 text-xs ${dateMode === "single" ? "bg-[#ff6300] hover:bg-[#ff6300]/90 text-white border-[#ff6300]" : ""}`}
                  >
                    Single Day
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setDateMode("range"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                    data-testid="button-manual-mode-range"
                    className={`flex-1 text-xs ${dateMode === "range" ? "bg-[#ff6300] hover:bg-[#ff6300]/90 text-white border-[#ff6300]" : ""}`}
                  >
                    Date Range
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setDateMode("select"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                    data-testid="button-manual-mode-select"
                    className={`flex-1 text-xs ${dateMode === "select" ? "bg-[#ff6300] hover:bg-[#ff6300]/90 text-white border-[#ff6300]" : ""}`}
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
                              ? "bg-[#ff6300] text-white font-semibold"
                              : isToday
                                ? "border border-[#ff6300] text-[#ff6300] font-semibold"
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

          {/* Chef-only: choose where this recipe lives. Personal = My Meals / My Recipes.
              Creator = public chef library (chef_recipes), no calendar scheduling. */}
          {!isEditing && isChefApproved && (
            <div className="space-y-1.5" data-testid="creator-personal-selector">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Save to
              </Label>
              <Select value={saveTarget} onValueChange={(v) => setSaveTarget(v as "personal" | "creator")}>
                <SelectTrigger className="h-10" data-testid="select-save-target">
                  <SelectValue placeholder="Add to Creator Recipes or Personal Recipes?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal Recipes (My Meals)</SelectItem>
                  <SelectItem value="creator">Creator Recipes (public chef library)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {saveTarget === "creator"
                  ? "Recipe will appear on your public Creator Page. Calendar scheduling is skipped."
                  : "Recipe is added to My Meals and scheduled to the selected days."}
              </p>
            </div>
          )}

        </div>

        {/* Sticky footer CTA — brand-orange gradient */}
        <div className="shrink-0 px-6 py-3 border-t border-[#f0f0f0]">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-11 text-white font-semibold bg-gradient-to-br from-[#ff8533] to-[#ff6300] hover:from-[#ff7b1a] hover:to-[#e85500] shadow-md shadow-orange-500/30"
            data-testid="button-manual-save"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : (saveTarget === "creator" ? "Publish to Creator Page" : "Save Meal")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
