import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Check, Leaf, Loader2 } from "lucide-react";
import { classifyIngredient, getCategoryColor, IngredientCategory } from "@/lib/ingredient-classifier";
import type { SwapSuggestion } from "@/lib/swap-suggestions";
import { getAlternativeSearchQueries, stripBrandName } from "@/lib/swap-suggestions";
import { useDemoStore, IngredientOverride, PantryItem } from "@/lib/demo-store";
import { useEntitlements } from "@/lib/entitlements";
import { useToast } from "@/hooks/use-toast";

function parseNutritionFromDescription(desc: string): { calories: number; fat: number; carbs: number; protein: number } {
  const calories = parseFloat(desc.match(/Calories:\s*([\d.]+)/i)?.[1] || "0");
  const fat = parseFloat(desc.match(/(?:Total\s+)?Fat:\s*([\d.]+)/i)?.[1] || "0");
  const carbs = parseFloat(desc.match(/(?:Carbs|Carbohydrate|Carbohydrates|Total\s+Carb)(?:s)?:\s*([\d.]+)/i)?.[1] || "0");
  const protein = parseFloat(desc.match(/Protein:\s*([\d.]+)/i)?.[1] || "0");
  return { calories: Math.round(calories), fat: Math.round(fat), carbs: Math.round(carbs), protein: Math.round(protein) };
}

interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_description: string;
  brand_name?: string;
}

function checkInPantry(name: string, pantryItems: PantryItem[]): boolean {
  const normalized = name.toLowerCase().trim();
  return pantryItems.some(item =>
    item.state === 'have' &&
    item.normalizedName.toLowerCase().trim() === normalized
  );
}

async function fetchFatSecretSuggestions(
  query: string,
  options: {
    maxResults?: number;
    signal?: AbortSignal;
    pantryItems: PantryItem[];
    sourceCategory: IngredientCategory;
    sourceIngredient: string;
  }
): Promise<SwapSuggestion[]> {
  const { maxResults = 12, signal, pantryItems, sourceCategory, sourceIngredient } = options;
  const sourceNormalized = sourceIngredient.toLowerCase().trim();

  const res = await fetch(`/api/fatsecret/foods/search?query=${encodeURIComponent(query)}&max_results=${maxResults}`, {
    credentials: 'include',
    signal,
  });
  if (!res.ok) return [];
  const data = await res.json();
  let foods: FatSecretFood[] = [];
  if (data?.foods?.food) {
    foods = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food];
  }

  const results: SwapSuggestion[] = [];
  const seenBaseNames = new Set<string>();

  for (const food of foods) {
    const strippedName = stripBrandName(food.food_name);
    const baseNameNormalized = strippedName.toLowerCase().trim();

    if (baseNameNormalized === sourceNormalized) continue;

    if (seenBaseNames.has(baseNameNormalized)) continue;
    seenBaseNames.add(baseNameNormalized);

    const category = classifyIngredient(strippedName);
    if (category !== sourceCategory) continue;

    results.push({
      name: strippedName,
      category,
      inPantry: checkInPantry(strippedName, pantryItems),
      nutrition: parseNutritionFromDescription(food.food_description),
    });
  }

  return results;
}

interface SwapIngredientPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientName: string;
  mealId?: string;
  onSwapComplete?: (replacement: SwapSuggestion) => void;
  currentOverride?: IngredientOverride;
}

export function SwapIngredientPopup({
  open,
  onOpenChange,
  ingredientName,
  mealId,
  onSwapComplete,
  currentOverride,
}: SwapIngredientPopupProps) {
  const { toast } = useToast();
  const { pantry, swapIngredient } = useDemoStore();

  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SwapSuggestion[]>([]);
  const [selectedReplacement, setSelectedReplacement] = useState<SwapSuggestion | null>(null);
  const [isFetchingFatSecret, setIsFetchingFatSecret] = useState(false);
  const [isSearchingFatSecret, setIsSearchingFatSecret] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const originalCategory = classifyIngredient(ingredientName);
  const displayName = currentOverride ? currentOverride.replacementName : ingredientName;

  const fetchOptions = useCallback(() => ({
    pantryItems: pantry,
    sourceCategory: originalCategory,
    sourceIngredient: displayName,
  }), [pantry, originalCategory, displayName]);

  const fetchSmartSuggestions = useCallback(async (signal: AbortSignal) => {
    const queries = getAlternativeSearchQueries(displayName, originalCategory);
    const opts = fetchOptions();

    const allResults = await Promise.all(
      queries.map(q => fetchFatSecretSuggestions(q, { ...opts, signal }).catch(() => [] as SwapSuggestion[]))
    );

    const combined: SwapSuggestion[] = [];
    const seenNames = new Set<string>();

    for (const batch of allResults) {
      for (const item of batch) {
        const key = item.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          combined.push(item);
        }
      }
    }

    return combined;
  }, [displayName, originalCategory, fetchOptions]);

  useEffect(() => {
    if (open && displayName) {
      suggestionsAbortRef.current?.abort();
      const controller = new AbortController();
      suggestionsAbortRef.current = controller;

      setSuggestions([]);
      setSelectedReplacement(null);
      setSearchQuery("");
      setSearchResults([]);

      setIsFetchingFatSecret(true);
      fetchSmartSuggestions(controller.signal)
        .then(results => {
          if (!controller.signal.aborted) {
            setSuggestions(results);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setIsFetchingFatSecret(false);
        });
    }

    return () => {
      suggestionsAbortRef.current?.abort();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchAbortRef.current?.abort();
    };
  }, [open, displayName, fetchSmartSuggestions]);

  const handleRegenerate = () => {
    suggestionsAbortRef.current?.abort();
    const controller = new AbortController();
    suggestionsAbortRef.current = controller;

    setSuggestions([]);
    setSelectedReplacement(null);

    setIsFetchingFatSecret(true);
    fetchSmartSuggestions(controller.signal)
      .then(results => {
        if (!controller.signal.aborted) {
          setSuggestions(results);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setIsFetchingFatSecret(false);
      });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchAbortRef.current?.abort();

    if (query.trim().length >= 2) {
      setSearchResults([]);

      const controller = new AbortController();
      searchAbortRef.current = controller;

      searchTimeoutRef.current = setTimeout(() => {
        setIsSearchingFatSecret(true);
        fetchFatSecretSuggestions(query, {
          ...fetchOptions(),
          signal: controller.signal,
        })
          .then(results => {
            if (!controller.signal.aborted) {
              setSearchResults(results);
            }
          })
          .catch(() => {})
          .finally(() => {
            if (!controller.signal.aborted) setIsSearchingFatSecret(false);
          });
      }, 400);
    } else {
      setSearchResults([]);
      setIsSearchingFatSecret(false);
    }
  };

  const handleSelectSuggestion = (suggestion: SwapSuggestion) => {
    setSelectedReplacement(suggestion);
  };

  const handleConfirmSwap = () => {
    if (!selectedReplacement) return;

    if (mealId) {
      swapIngredient(mealId, ingredientName, {
        name: selectedReplacement.name,
        nutrition: selectedReplacement.nutrition,
      });

      toast({
        title: "Ingredient swapped",
        description: `${ingredientName} replaced with ${selectedReplacement.name}`,
      });
    }

    onSwapComplete?.(selectedReplacement);
    onOpenChange(false);
  };

  const renderSuggestion = (suggestion: SwapSuggestion, isSelected: boolean) => {
    const categoryColor = getCategoryColor(suggestion.category);
    return (
      <button
        key={suggestion.name}
        onClick={() => handleSelectSuggestion(suggestion)}
        className={`w-full text-left p-3 rounded-md border transition-all ${
          isSelected
            ? "border-primary bg-primary/10"
            : "border-border hover-elevate"
        }`}
        data-testid={`swap-suggestion-${suggestion.name.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{suggestion.name}</span>
            <Badge variant="outline" className={`text-[9px] px-1.5 ${categoryColor}`}>
              {suggestion.category}
            </Badge>
            {suggestion.inPantry && (
              <Badge variant="outline" className="text-[9px] px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                <Leaf className="w-2 h-2 mr-0.5" /> In Pantry
              </Badge>
            )}
          </div>
          {isSelected && (
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {suggestion.nutrition.calories} cal | {suggestion.nutrition.protein}g P | {suggestion.nutrition.carbs}g C | {suggestion.nutrition.fat}g F
        </div>
      </button>
    );
  };

  const showSearchEmptyState = searchQuery.trim().length >= 2 && searchResults.length === 0 && !isSearchingFatSecret;
  const showSuggestionsEmptyState = suggestions.length === 0 && !isFetchingFatSecret;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} data-testid="dialog-swap-ingredient">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Swap: {displayName}
            <Badge variant="outline" className={`text-[9px] px-1.5 ${getCategoryColor(originalCategory)}`}>
              {originalCategory}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for alternatives..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              data-testid="input-swap-search"
            />
          </div>

          {searchQuery.trim().length >= 2 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">Search Results</h4>
                {isSearchingFatSecret && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map(suggestion =>
                    renderSuggestion(suggestion, selectedReplacement?.name === suggestion.name)
                  )}
                </div>
              ) : showSearchEmptyState ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-search-results">
                  No alternatives found in this category
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Suggestions</h4>
                  {isFetchingFatSecret && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  className="h-7 text-xs gap-1"
                  data-testid="button-regenerate-suggestions"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </Button>
              </div>

              {suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map(suggestion =>
                    renderSuggestion(suggestion, selectedReplacement?.name === suggestion.name)
                  )}
                </div>
              ) : showSuggestionsEmptyState ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-suggestions">
                  No alternatives found in this category
                </p>
              ) : null}
            </>
          )}

          {currentOverride && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Originally: <span className="font-medium">{ingredientName}</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              data-testid="button-cancel-swap"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSwap}
              disabled={!selectedReplacement}
              className="flex-1"
              data-testid="button-confirm-swap"
            >
              Confirm Swap
            </Button>
          </div>
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full bg-[#ff6300] hover:bg-[#ff6300]/90 text-white font-semibold"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2)',
              border: '1px solid rgba(0,0,0,0.1)',
            }}
            data-testid="button-done-swap"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
