import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Check, Leaf } from "lucide-react";
import { classifyIngredient, getCategoryColor, IngredientCategory } from "@/lib/ingredient-classifier";
import { generateSwapSuggestions, searchIngredients, SwapSuggestion, SwapFilters } from "@/lib/swap-suggestions";
import { useDemoStore, IngredientOverride } from "@/lib/demo-store";
import { useEntitlements } from "@/lib/entitlements";
import { useToast } from "@/hooks/use-toast";

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
  const { pantry, swapIngredient, favorites } = useDemoStore();
  const { preferences, entitlement } = useEntitlements();
  
  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SwapSuggestion[]>([]);
  const [selectedReplacement, setSelectedReplacement] = useState<SwapSuggestion | null>(null);
  
  const originalCategory = classifyIngredient(ingredientName);
  const displayName = currentOverride ? currentOverride.replacementName : ingredientName;
  
  const filters: SwapFilters = useMemo(() => ({
    allergies: preferences.allergies || [],
    dietaryRestrictions: preferences.dietaryPreferences || [],
    dislikedIngredients: [],
    pantryItems: pantry,
    favoriteRecipeIngredients: [],
    isPro: entitlement.isPro,
  }), [preferences.allergies, preferences.dietaryPreferences, pantry, entitlement.isPro]);
  
  useEffect(() => {
    if (open && displayName) {
      const newSuggestions = generateSwapSuggestions(displayName, filters, 4);
      setSuggestions(newSuggestions);
      setSelectedReplacement(null);
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, displayName, filters]);
  
  const handleRegenerate = () => {
    const newSuggestions = generateSwapSuggestions(displayName, filters, 4);
    setSuggestions(newSuggestions);
    setSelectedReplacement(null);
  };
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      const results = searchIngredients(query, filters, 6);
      setSearchResults(results);
    } else {
      setSearchResults([]);
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
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" data-testid="dialog-swap-ingredient">
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
          
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Search Results</h4>
              <div className="space-y-2">
                {searchResults.map(suggestion => 
                  renderSuggestion(suggestion, selectedReplacement?.name === suggestion.name)
                )}
              </div>
            </div>
          )}
          
          {searchResults.length === 0 && (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">Suggestions</h4>
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
              
              <div className="space-y-2">
                {suggestions.map(suggestion => 
                  renderSuggestion(suggestion, selectedReplacement?.name === suggestion.name)
                )}
              </div>
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
