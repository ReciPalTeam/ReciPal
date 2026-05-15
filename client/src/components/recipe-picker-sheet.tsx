import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Utensils, BookOpen, ChefHat, Check } from "lucide-react";
import { useMyChefRecipes, type ChefRecipe } from "@/hooks/use-chef-recipes";

export type SelectedRecipe =
  | { kind: "chef"; chefRecipeId: number; title: string; photoUrl: string | null }
  | { kind: "public"; recipeId: string; title: string; image: string | null };

interface RecipePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (r: SelectedRecipe) => void;
}

interface PublicRecipeSearchResult {
  id: string;
  title: string;
  image?: string | null;
}

export function RecipePickerSheet({ open, onOpenChange, onSelect }: RecipePickerSheetProps) {
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Reset query on close.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  const myQuery = useMyChefRecipes();
  const filteredMine = (myQuery.data?.recipes ?? []).filter((r) =>
    debounced ? r.title.toLowerCase().includes(debounced.toLowerCase()) : true,
  );

  // "All recipes" tab uses the existing /api/recipes/search endpoint.
  const [allLoading, setAllLoading] = useState(false);
  const [allResults, setAllResults] = useState<PublicRecipeSearchResult[]>([]);
  useEffect(() => {
    if (tab !== "all") return;
    if (!debounced.trim()) {
      setAllResults([]);
      return;
    }
    let cancelled = false;
    setAllLoading(true);
    fetch(`/api/recipes/search?q=${encodeURIComponent(debounced)}&limit=20`, { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const items: PublicRecipeSearchResult[] = (body.recipes ?? body ?? []).map((rec: any) => ({
          id: rec.id ?? rec.recipe_id,
          title: rec.title ?? "Untitled",
          image: rec.image ?? rec.imageUrl ?? rec.image_url ?? null,
        }));
        setAllResults(items);
      })
      .catch(() => !cancelled && setAllResults([]))
      .finally(() => !cancelled && setAllLoading(false));
    return () => { cancelled = true; };
  }, [tab, debounced]);

  const pickMine = (r: ChefRecipe) => {
    onSelect({ kind: "chef", chefRecipeId: r.id, title: r.title, photoUrl: r.photoUrl });
    onOpenChange(false);
  };
  const pickPublic = (r: PublicRecipeSearchResult) => {
    onSelect({ kind: "public", recipeId: r.id, title: r.title, image: r.image ?? null });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0 max-h-[85vh] flex flex-col">
        <div className="bg-gradient-to-br from-recipal-orange/10 to-recipal-orange/5 px-5 py-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-recipal-orange flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <DialogTitle className="text-lg font-bold text-recipal-deep-green dark:text-foreground">
              Attach a recipe
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground ml-11">
            Pick one of your published recipes or any recipe in ReciPal.
          </DialogDescription>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 pb-2 border-b">
          <div className="bg-muted/50 dark:bg-card rounded-full p-1 flex items-center">
            <button
              onClick={() => setTab("mine")}
              className={`flex-1 rounded-full py-1.5 text-sm font-semibold flex items-center justify-center gap-1.5 ${
                tab === "mine"
                  ? "bg-white dark:bg-background shadow-[0_2px_6px_rgba(0,0,0,0.08)] text-recipal-deep-green dark:text-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="picker-tab-mine"
            >
              <ChefHat className="w-3.5 h-3.5" /> My recipes
            </button>
            <button
              onClick={() => setTab("all")}
              className={`flex-1 rounded-full py-1.5 text-sm font-semibold flex items-center justify-center gap-1.5 ${
                tab === "all"
                  ? "bg-white dark:bg-background shadow-[0_2px_6px_rgba(0,0,0,0.08)] text-recipal-deep-green dark:text-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="picker-tab-all"
            >
              <Utensils className="w-3.5 h-3.5" /> All recipes
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "mine" ? "Search your recipes" : "Search all recipes"}
              className="pl-9"
              data-testid="input-recipe-search"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {tab === "mine" ? (
            myQuery.isLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : filteredMine.length === 0 ? (
              <div className="text-center py-10 px-4">
                <ChefHat className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">No recipes yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {debounced ? `No matches for "${debounced}".` : "Generate one from your next video, or switch to All recipes to attach an existing one."}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredMine.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => pickMine(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    data-testid={`picker-mine-${r.id}`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-recipal-orange/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <Utensils className="w-5 h-5 text-recipal-orange" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.totalTimeMinutes ? `${r.totalTimeMinutes} min · ` : ""}{r.ingredients.length} ingredients · {r.steps.length} steps
                      </p>
                    </div>
                    <Check className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )
          ) : (
            // All recipes (public.recipes via /api/recipes/search)
            !debounced ? (
              <div className="text-center py-10 px-4 text-xs text-muted-foreground">
                Type to search ReciPal's recipe library.
              </div>
            ) : allLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : allResults.length === 0 ? (
              <div className="text-center py-10 px-4 text-sm text-muted-foreground">
                No matches for "{debounced}".
              </div>
            ) : (
              <div className="space-y-1">
                {allResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => pickPublic(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    data-testid={`picker-all-${r.id}`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-recipal-deep-green/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {r.image ? (
                        <img src={r.image} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <Utensils className="w-5 h-5 text-recipal-deep-green dark:text-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground">From ReciPal library</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
