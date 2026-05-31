import { useFavorites, useToggleFavorite } from "@/hooks/use-plans";
import { useUserFavorites, useToggleUserFavorite } from "@/hooks/use-favorites";
import { extractChefRecipeId } from "@/lib/chef-recipe-adapter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Heart, ChefHat, Clock, UtensilsCrossed } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function FavoritesPage() {
  const { data: favorites, isLoading } = useFavorites();
  const { mutate: toggleFavorite } = useToggleFavorite();
  // Chef recipes are persisted in the text-id userFavoriteRecipes table (Phase H.20).
  const { data: userFavs, isLoading: userFavsLoading } = useUserFavorites();
  const toggleUserFav = useToggleUserFavorite();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const chefFavs = (userFavs?.favorites ?? []).filter(
    (r: any) => typeof r?.id === "string" && r.id.startsWith("chef:"),
  );

  if (isLoading || userFavsLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin w-10 h-10 text-primary" />
      </div>
    );
  }

  const hasLegacy = !!favorites && favorites.length > 0;
  const hasChef = chefFavs.length > 0;

  if (!hasLegacy && !hasChef) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 sm:space-y-6 px-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold">No favorites yet</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md">
          Tap the heart on a recipe to save it here for easy access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in px-1 sm:px-0">
      {hasChef && (
        <section className="space-y-3 sm:space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Saved chef recipes</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {chefFavs.length} saved {chefFavs.length === 1 ? "recipe" : "recipes"}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {chefFavs.map((r: any) => (
              <Card
                key={r.id}
                className="group hover:border-primary/50 transition-all duration-300 overflow-hidden cursor-pointer"
                data-testid={`chef-favorite-${r.id}`}
                onClick={() => setLocation(`/chef-recipe/${extractChefRecipeId(r.id)}`)}
              >
                <div className="aspect-video w-full bg-muted relative overflow-hidden">
                  {r.image ? (
                    <img src={r.image} alt={r.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><ChefHat className="w-12 h-12 text-muted-foreground/30" /></div>
                  )}
                </div>
                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg leading-tight">{r.title}</CardTitle>
                  <CardDescription className="flex gap-2 text-xs">
                    <span>{r.calories} kcal</span>
                    {r.cookTime && <><span>-</span><span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{r.cookTime}</span></>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{r.protein}g</strong> protein</span>
                    <span><strong className="text-foreground">{r.carbs}g</strong> carbs</span>
                    <span><strong className="text-foreground">{r.fat}g</strong> fat</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    data-testid={`button-remove-chef-favorite-${r.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUserFav.mutate(
                        { recipe: r, favorite: false },
                        { onSuccess: () => toast({ title: "Removed from favorites", description: `${r.title} removed.` }) },
                      );
                    }}
                  >
                    <Heart className="w-3 h-3 mr-2 fill-red-500 text-red-500" />
                    Remove from Favorites
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {hasLegacy && (
        <section className="space-y-3 sm:space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Favorite Meals</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {favorites!.length} saved {favorites!.length === 1 ? "recipe" : "recipes"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {favorites!.map((fav: any) => (
              <Card key={fav.id} className="group hover:border-primary/50 transition-all duration-300 relative overflow-hidden">
                <div className="aspect-video w-full bg-secondary relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    {fav.recipe.imageUrl ? (
                      <img src={fav.recipe.imageUrl} alt={fav.recipe.name} className="w-full h-full object-cover" />
                    ) : (
                      <ChefHat className="w-12 h-12 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
                    <span className="text-white text-xs font-bold uppercase tracking-wider bg-black/30 backdrop-blur-md px-2 py-1 rounded-md">
                      {fav.recipe.mealType}
                    </span>
                  </div>
                </div>

                <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg leading-tight">{fav.recipe.name}</CardTitle>
                  <CardDescription className="flex gap-2 text-xs">
                    <span>{fav.recipe.calories} kcal</span>
                    <span>-</span>
                    <span>{fav.recipe.prepTimeMinutes} min prep</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{fav.recipe.prepTimeMinutes} min prep time</span>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{fav.recipe.protein}g</strong> protein</span>
                    <span><strong className="text-foreground">{fav.recipe.carbs}g</strong> carbs</span>
                    <span><strong className="text-foreground">{fav.recipe.fat}g</strong> fat</span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2">
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      <span>Ingredients</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1 max-h-28 overflow-y-auto">
                      {fav.recipe.ingredients?.slice(0, 5).map((ing: { name: string; amount: number; unit: string }, i: number) => (
                        <li key={i} className="flex gap-1">
                          <span className="text-foreground font-medium whitespace-nowrap">{ing.amount} {ing.unit}</span>
                          <span>{ing.name}</span>
                        </li>
                      ))}
                      {fav.recipe.ingredients?.length > 5 && (
                        <li className="text-muted-foreground/70 italic">+{fav.recipe.ingredients.length - 5} more</li>
                      )}
                    </ul>
                  </div>

                  <div className="flex gap-1.5 sm:gap-2 flex-wrap mb-3 sm:mb-4">
                    {fav.recipe.tags.slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0.5">{tag}</Badge>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    data-testid={`button-remove-favorite-${fav.recipe.id}`}
                    onClick={() => {
                      toggleFavorite({ recipeId: fav.recipe.id, isFavorite: true }, {
                        onSuccess: () => {
                          toast({ title: "Removed from favorites", description: `${fav.recipe.name} removed from your favorites.` });
                        },
                      });
                    }}
                  >
                    <Heart className="w-3 h-3 mr-2 fill-red-500 text-red-500" />
                    Remove from Favorites
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
