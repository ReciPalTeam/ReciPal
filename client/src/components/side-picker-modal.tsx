import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Star, Loader2 } from 'lucide-react';
import { Recipe } from '@/lib/mock-data';
import { MacroRemaining } from '@/lib/side-recommendations';

interface SidePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentRecipe: Recipe;
  allRecipes: Recipe[];
  dailyMacroRemaining: MacroRemaining;
  onAddSide: (recipe: Recipe, servings: number) => void;
}

export function SidePickerModal({
  open,
  onOpenChange,
  parentRecipe,
  allRecipes,
  dailyMacroRemaining,
  onAddSide,
}: SidePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [recommended, setRecommended] = useState<Recipe[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Fetch recommended sides from Supabase when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingRecs(true);
    fetch('/api/recipes/sides/search?limit=6')
      .then(r => r.json())
      .then((data: Recipe[]) => setRecommended(data))
      .catch(() => setRecommended([]))
      .finally(() => setLoadingRecs(false));
  }, [open]);

  // Debounced search against Supabase
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/recipes/sides/search?q=${encodeURIComponent(searchQuery.trim())}&limit=10`)
        .then(r => r.json())
        .then((data: Recipe[]) => setSearchResults(data))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const renderRecipeRow = (recipe: Recipe) => (
    <div
      key={recipe.id}
      className="flex items-center gap-2.5 p-2 rounded-lg bg-muted mb-1"
    >
      <div
        className="w-9 h-9 rounded-md bg-muted flex-shrink-0 bg-cover bg-center"
        style={recipe.image ? { backgroundImage: `url(${recipe.image})` } : undefined}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{recipe.title}</p>
        <p className="text-[10px] text-muted-foreground">
          <span style={{ color: '#ca8a04' }}>{recipe.calories} cal</span>{' · '}<span style={{ color: '#ff6300' }}>P: {recipe.protein}g</span>{' · '}<span style={{ color: '#15803d' }}>C: {recipe.carbs}g</span>{' · '}<span style={{ color: '#1e40af' }}>F: {recipe.fat}g</span>
        </p>
      </div>
      <Button
        size="sm"
        className="h-7 px-3 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white text-[11px] font-bold rounded-full flex-shrink-0"
        onClick={() => {
          onAddSide(recipe, 1);
          onOpenChange(false);
        }}
      >
        Add
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        <DialogHeader>
          <DialogTitle>Add a Side</DialogTitle>
          <DialogDescription>Pairing with: {parentRecipe.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recommended */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <Star className="w-3 h-3" />
              Recommended for this meal
            </div>
            {loadingRecs ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : recommended.length > 0 ? (
              <>
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px] text-blue-800 mb-3 leading-relaxed">
                  These sides best complement your {parentRecipe.title.toLowerCase()}'s macros and match its cuisine profile.
                </div>
                {recommended.map(renderRecipeRow)}
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No side recipes found</p>
            )}
          </div>

          {/* Search */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <Search className="w-3 h-3" />
              Search all sides
            </div>
            <Input
              type="text"
              placeholder="Search sides..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />
            {searching && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!searching && searchResults.map(renderRecipeRow)}
            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No sides found matching "{searchQuery}"
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
