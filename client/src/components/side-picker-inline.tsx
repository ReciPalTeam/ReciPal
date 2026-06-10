import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, X, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Recipe } from '@/lib/mock-data';
import { MacroRemaining } from '@/lib/side-recommendations';

interface SidePickerInlineProps {
  parentRecipe: Recipe;
  allRecipes: Recipe[];
  dailyMacroRemaining: MacroRemaining;
  selectedSides: { recipe: Recipe; servings: number }[];
  onAddSide: (recipe: Recipe) => void;
  onRemoveSide: (recipeId: string) => void;
  isPro?: boolean;
}

/* Compact macro pills — same vocabulary as the chef-recipe page's macro
   chips, sized down for the side-picker rows. Each pill: colored top
   stripe, bold value, uppercase label below. */
function MacroPills({ recipe, isPro }: { recipe: Recipe; isPro: boolean }) {
  const cell = "relative overflow-hidden rounded-md bg-white/70 dark:bg-white/[0.04] border border-gray-200/40 dark:border-white/[0.06] px-1.5 py-0.5 text-center min-w-[34px] flex flex-col items-center";
  const value = "text-[10px] font-extrabold leading-none mt-1";
  const label = "text-[7px] font-semibold leading-none text-gray-400 uppercase tracking-wider mt-0.5";
  return (
    <div className="flex items-center gap-1 mt-1">
      {isPro && (
        <>
          <div className={cell}>
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#ff6300] to-[#ff8533]" />
            <p className={value} style={{ color: '#ff6300' }}>{recipe.protein}g</p>
            <p className={label}>Protein</p>
          </div>
          <div className={cell}>
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#2ecc71] to-[#27ae60]" />
            <p className={value} style={{ color: '#2ecc71' }}>{recipe.carbs}g</p>
            <p className={label}>Carbs</p>
          </div>
          <div className={cell}>
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#3498db] to-[#2980b9]" />
            <p className={value} style={{ color: '#3498db' }}>{recipe.fat}g</p>
            <p className={label}>Fat</p>
          </div>
        </>
      )}
      <div className={cell}>
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#f1c40f] to-[#e67e22]" />
        <p className={value} style={{ color: '#e67e22' }}>{recipe.calories}</p>
        <p className={label}>Cal</p>
      </div>
    </div>
  );
}

export function SidePickerInline({
  parentRecipe,
  allRecipes,
  dailyMacroRemaining,
  selectedSides,
  onAddSide,
  onRemoveSide,
  isPro = false,
}: SidePickerInlineProps) {
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [recommended, setRecommended] = useState<Recipe[]>([]);
  const [searching, setSearching] = useState(false);

  // Fetch recommendations from Supabase when expanded
  useEffect(() => {
    if (!expanded) return;
    fetch('/api/recipes/sides/search?limit=4')
      .then(r => r.json())
      .then((data: Recipe[]) => {
        setRecommended(data.filter(s => !selectedSides.some(sel => sel.recipe.id === s.id)));
      })
      .catch(() => setRecommended([]));
  }, [expanded]);

  // Debounced search against Supabase
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/recipes/sides/search?q=${encodeURIComponent(searchQuery.trim())}&limit=6`)
        .then(r => r.json())
        .then((data: Recipe[]) => {
          setSearchResults(data.filter(r => !selectedSides.some(sel => sel.recipe.id === r.id)));
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSides]);

  // Calculate total nutrition including sides
  const mealTotal = {
    calories: parentRecipe.calories + selectedSides.reduce((a, s) => a + s.recipe.calories * s.servings, 0),
    protein: parentRecipe.protein + selectedSides.reduce((a, s) => a + s.recipe.protein * s.servings, 0),
    carbs: parentRecipe.carbs + selectedSides.reduce((a, s) => a + s.recipe.carbs * s.servings, 0),
    fat: parentRecipe.fat + selectedSides.reduce((a, s) => a + s.recipe.fat * s.servings, 0),
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm font-medium text-[#ff6300] hover:text-[#ff6300]/80"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Add a Side
        {selectedSides.length > 0 && (
          <span className="text-xs text-muted-foreground ml-1">({selectedSides.length} added)</span>
        )}
      </button>

      {/* Selected sides */}
      {selectedSides.length > 0 && (
        <div className="space-y-1">
          {selectedSides.map(({ recipe }) => (
            <div key={recipe.id} className="flex items-center gap-2 py-1 px-2 bg-orange-50 border border-orange-100 rounded-md">
              <div
                className="w-6 h-6 rounded bg-muted flex-shrink-0 bg-cover bg-center"
                style={recipe.image ? { backgroundImage: `url(${recipe.image})` } : undefined}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{recipe.title}</p>
                <MacroPills recipe={recipe} isPro={isPro} />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => onRemoveSide(recipe.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {/* Meal total */}
          <div className="flex items-center justify-between px-2 py-1 bg-[rgba(255,99,0,0.06)] rounded text-[10px] font-semibold">
            <span className="text-muted-foreground">Meal Total</span>
            <span>
              <span style={{ color: '#ff6300' }}>P: {Math.round(mealTotal.protein)}g</span>{' · '}
              <span style={{ color: '#15803d' }}>C: {Math.round(mealTotal.carbs)}g</span>{' · '}
              <span style={{ color: '#1e40af' }}>F: {Math.round(mealTotal.fat)}g</span>{' · '}
              <span style={{ color: '#ca8a04' }}>{Math.round(mealTotal.calories)} cal</span>
            </span>
          </div>
        </div>
      )}

      {/* Expanded picker */}
      {expanded && (
        <div className="border border-orange-200 rounded-lg p-2 bg-orange-50/30 space-y-2">
          {/* Recommended */}
          {recommended.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recommended</p>
              {recommended.map(recipe => (
                <div key={recipe.id} className="flex items-center gap-2 py-1">
                  <div
                    className="w-6 h-6 rounded bg-muted flex-shrink-0 bg-cover bg-center"
                    style={recipe.image ? { backgroundImage: `url(${recipe.image})` } : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{recipe.title}</p>
                    <MacroPills recipe={recipe} isPro={isPro} />
                  </div>
                  <Button
                    size="sm"
                    className="h-5 px-2 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white text-[9px] font-bold rounded-full"
                    onClick={() => onAddSide(recipe)}
                  >
                    <Plus className="w-2.5 h-2.5 mr-0.5" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search sides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-xs pl-7"
            />
          </div>
          {searching && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && searchResults.map(recipe => (
            <div key={recipe.id} className="flex items-center gap-2 py-1">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{recipe.title}</p>
                <MacroPills recipe={recipe} isPro={isPro} />
              </div>
              <Button
                size="sm"
                className="h-5 px-2 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white text-[9px] font-bold rounded-full"
                onClick={() => onAddSide(recipe)}
              >
                <Plus className="w-2.5 h-2.5 mr-0.5" />
                Add
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
