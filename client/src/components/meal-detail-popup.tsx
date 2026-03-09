import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Flame, Repeat, Undo2, Minus, Plus, Loader2, Wrench } from "lucide-react";
import { getIngredientNutritionEstimate } from "@/lib/ingredient-classifier";
import { SwapIngredientPopup } from "./swap-ingredient-popup";
import { PlannedMeal, useDemoStore, IngredientOverride } from "@/lib/demo-store";
import { Recipe } from "@/lib/mock-data";
import { apiRequest } from "@/lib/queryClient";

interface ScaledData {
  steps: { step: number; time: string; equipment: string; instruction: string }[];
  ingredients?: { display_text: string; amount: number; unit: string }[];
  cook_time_minutes: number;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

interface MealDetailPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: PlannedMeal;
  recipe: Recipe;
}

export function MealDetailPopup({
  open,
  onOpenChange,
  meal,
  recipe,
}: MealDetailPopupProps) {
  const { getPantryOverlap, removeIngredientOverride, getPlannedMealById, updateMealServings } = useDemoStore();
  const currentMeal = getPlannedMealById(meal.id) || meal;
  const pantryStatus = getPantryOverlap(recipe);
  
  const [swapPopupOpen, setSwapPopupOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<string>("");
  const [servings, setServings] = useState(currentMeal.servings);
  const [scaledData, setScaledData] = useState<ScaledData | null>(null);
  const [scalingLoading, setScalingLoading] = useState(false);
  const scalingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setServings(currentMeal.servings);
  }, [currentMeal.servings]);

  const fetchScaledSteps = useCallback(async (desiredServings: number) => {
    if (scalingAbortRef.current) {
      scalingAbortRef.current.abort();
    }
    if (desiredServings === recipe.servings) {
      setScaledData(null);
      setScalingLoading(false);
      return;
    }
    const controller = new AbortController();
    scalingAbortRef.current = controller;
    setScalingLoading(true);
    try {
      const res = await apiRequest("POST", "/api/scaled-steps", {
        recipe_id: recipe.id,
        desired_servings: desiredServings,
      });
      if (controller.signal.aborted) return;
      const data: ScaledData = await res.json();
      setScaledData(data);
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("[MealDetailPopup] Scaling API error:", err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setScalingLoading(false);
      }
    }
  }, [recipe.id, recipe.servings]);

  useEffect(() => {
    if (open && servings !== recipe.servings) {
      fetchScaledSteps(servings);
    } else if (!open) {
      setScaledData(null);
      setScalingLoading(false);
    }
  }, [open, meal.id, recipe.id]);

  const baseStep = recipe.servings || 1;

  const handleServingsChange = (delta: number) => {
    const newServings = servings + delta * baseStep;
    if (newServings < baseStep || newServings > 48) return;
    setServings(newServings);
    updateMealServings(meal.id, newServings);
    fetchScaledSteps(newServings);
  };

  const getIngredientStatus = (ingredientName: string) => {
    if (pantryStatus.have.includes(ingredientName)) return "have";
    if (pantryStatus.might.includes(ingredientName)) return "might";
    return "need";
  };
  
  const getOverrideForIngredient = (ingredientName: string): IngredientOverride | undefined => {
    return currentMeal.ingredientOverrides?.find(
      o => o.originalIngredientName.toLowerCase() === ingredientName.toLowerCase()
    );
  };
  
  const getDisplayName = (ingredientName: string): string => {
    const override = getOverrideForIngredient(ingredientName);
    return override ? override.replacementName : ingredientName;
  };
  
  const handleSwapClick = (ingredientName: string) => {
    setSelectedIngredient(ingredientName);
    setSwapPopupOpen(true);
  };
  
  const handleUndoSwap = (originalIngredient: string) => {
    removeIngredientOverride(currentMeal.id, originalIngredient);
  };
  
  const adjustedNutrition = useMemo(() => {
    if (scaledData) {
      return {
        calories: Math.max(0, Math.round(scaledData.total_calories)),
        protein: Math.max(0, Math.round(scaledData.total_protein)),
        carbs: Math.max(0, Math.round(scaledData.total_carbs)),
        fat: Math.max(0, Math.round(scaledData.total_fat)),
      };
    }

    let perServingCals = recipe.calories || 0;
    let perServingProtein = recipe.protein || 0;
    let perServingCarbs = recipe.carbs || 0;
    let perServingFat = recipe.fat || 0;
    
    const overrides = currentMeal.ingredientOverrides || [];
    overrides.forEach(override => {
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
  }, [recipe, currentMeal.ingredientOverrides, scaledData, servings]);
  
  const hasSwaps = (currentMeal.ingredientOverrides?.length || 0) > 0;

  const displaySteps = scaledData ? scaledData.steps : recipe.steps;
  const displayCookTime = scaledData ? `${scaledData.cook_time_minutes} min` : recipe.cookTime;
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-meal-detail">
          <DialogHeader>
            <DialogTitle>{recipe.title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative h-40 rounded-lg overflow-hidden">
              <img 
                src={recipe.image} 
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <div className="flex items-center gap-4 text-white text-sm">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {displayCookTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" /> {servings} serving{servings > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="w-4 h-4" /> {adjustedNutrition.calories} cal total
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3" data-testid="serving-adjuster-meal">
              <Button
                variant="outline"
                size="icon"
                className={servings <= baseStep ? 'opacity-30 cursor-not-allowed' : ''}
                onClick={() => handleServingsChange(-1)}
                disabled={servings <= baseStep}
                data-testid="button-decrease-servings-meal"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[80px] text-center" data-testid="text-servings-meal">
                {servings} serving{servings > 1 ? 's' : ''}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleServingsChange(1)}
                disabled={servings >= 48}
                data-testid="button-increase-servings-meal"
              >
                <Plus className="w-4 h-4" />
              </Button>
              {scalingLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" data-testid="icon-scaling-loading" />}
            </div>
            
            {hasSwaps && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {currentMeal.ingredientOverrides!.length} ingredient{currentMeal.ingredientOverrides!.length > 1 ? 's' : ''} swapped in this meal
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-recipal-orange/10 border border-recipal-orange/20 rounded px-2 py-1 flex flex-col items-center min-w-[40px]">
                <span className="text-[13px] font-bold leading-none text-recipal-orange">{adjustedNutrition.protein}g</span>
                <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Protein</span>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded px-2 py-1 flex flex-col items-center min-w-[40px]">
                <span className="text-[13px] font-bold leading-none text-primary">{adjustedNutrition.carbs}g</span>
                <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Carbs</span>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 rounded px-2 py-1 flex flex-col items-center min-w-[40px]">
                <span className="text-[13px] font-bold leading-none text-blue-800 dark:text-blue-300">{adjustedNutrition.fat}g</span>
                <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Fat</span>
              </div>
              <div className="bg-yellow-100/30 border border-yellow-500/20 rounded px-2 py-1 flex flex-col items-center min-w-[40px]">
                <span className="text-[13px] font-bold leading-none text-yellow-600 dark:text-yellow-500">{adjustedNutrition.calories}</span>
                <span className="text-[9px] text-muted-foreground leading-none mt-[1px]">Calories</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center" data-testid="text-nutrition-label-meal">{adjustedNutrition.calories} cal for {servings} servings</p>
            
            <div>
              <h4 className="font-medium mb-2">Ingredients</h4>
              <div className="space-y-2">
                {scaledData?.ingredients && scaledData.ingredients.length > 0 ? (
                  scaledData.ingredients.map((sIng, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-2 rounded-lg border border-transparent"
                      data-testid={`meal-ingredient-${idx}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm truncate" data-testid={`meal-ingredient-text-${idx}`}>{sIng.display_text}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                [...recipe.ingredients]
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
                        override ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'border-transparent'
                      }`}
                      data-testid={`meal-ingredient-${idx}`}
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
                          onClick={() => handleSwapClick(ing.name)}
                          data-testid={`button-swap-ingredient-${idx}`}
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
                })
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Steps</h4>
              {scalingLoading ? (
                <div className="flex items-center justify-center py-6" data-testid="steps-loading">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Scaling steps...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {displaySteps.map((step, idx) => {
                    const isRich = typeof step === 'object';
                    const stepNum = isRich && step.step > 0 ? step.step : idx + 1;
                    const instruction = isRich ? step.instruction : step;
                    const time = isRich ? step.time : '';
                    const equipment = isRich ? step.equipment : '';

                    return (
                      <div key={idx} className="flex gap-3" data-testid={`meal-step-${idx}`}>
                        <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {stepNum}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{instruction}</p>
                          {(time || equipment) && (
                            <div className="flex gap-3 mt-1.5 flex-wrap">
                              {time && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full" data-testid={`meal-step-time-${idx}`}>
                                  <Clock className="w-3 h-3" />
                                  {time}
                                </span>
                              )}
                              {equipment && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full" data-testid={`meal-step-equipment-${idx}`}>
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
              )}
            </div>
            
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-[#ff6300] hover:bg-[#ff6300]/90 text-white font-semibold"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)',
                border: '1px solid rgba(0,0,0,0.1)',
              }}
              data-testid="button-done-meal-detail"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <SwapIngredientPopup
        open={swapPopupOpen}
        onOpenChange={setSwapPopupOpen}
        ingredientName={selectedIngredient}
        mealId={currentMeal.id}
        currentOverride={getOverrideForIngredient(selectedIngredient)}
        onSwapComplete={() => {}}
      />
    </>
  );
}
