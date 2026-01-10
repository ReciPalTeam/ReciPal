
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Utensils, Search, Filter, Sparkles, Clock, ChevronRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function RecipesPage() {
  const { data: recipes, isLoading } = useQuery<any[]>({ queryKey: ["/api/recipes"] });
  const { data: pantryItems } = useQuery<any[]>({ queryKey: ["/api/pantry"] });
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);

  const getPantryOverlap = (recipeIngredients: any[]) => {
    if (!pantryItems) return 0;
    const pantryNames = pantryItems.map(i => i.name.toLowerCase());
    const matches = recipeIngredients.filter(ri => 
      pantryNames.some(pi => pi.includes(ri.name.toLowerCase()))
    );
    return Math.round((matches.length / recipeIngredients.length) * 100);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-recipal-deep-green">Recipe Discovery</h1>
          <p className="text-muted-foreground">Personalized matches based on your pantry and preferences</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search recipes..." className="pl-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-recipal-orange" />
              For You
            </h2>
            <Badge variant="outline" className="gap-1 cursor-pointer">
              <Filter className="w-3 h-3" /> Filters
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isLoading ? (
              [1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />)
            ) : (
              recipes?.map(recipe => {
                const overlap = getPantryOverlap(recipe.ingredients);
                return (
                  <Card 
                    key={recipe.id} 
                    className="group cursor-pointer hover-elevate overflow-hidden border-none shadow-sm bg-card"
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      {recipe.imageUrl && <img src={recipe.imageUrl} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />}
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-white/90 text-recipal-deep-green border-none">
                          {overlap}% Pantry Match
                        </Badge>
                      </div>
                    </div>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-base leading-tight">{recipe.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">{recipe.calories} kcal</Badge>
                        <Badge variant="secondary" className="text-[10px]">{recipe.prepTimeMinutes} min</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="bg-recipal-deep-green text-white border-none">
            <CardHeader>
              <CardTitle className="text-lg">Weekly Goal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="opacity-80">Saved this week</span>
                  <span className="font-bold text-recipal-orange">$12.40</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-recipal-orange w-[65%]" />
                </div>
                <p className="text-xs opacity-70 italic">You're 65% towards your weekly savings goal!</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedRecipe} onOpenChange={(open) => !open && setSelectedRecipe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRecipe && (
            <div className="space-y-6">
              <div className="aspect-video relative rounded-lg overflow-hidden bg-muted">
                {selectedRecipe.imageUrl && (
                  <img src={selectedRecipe.imageUrl} className="object-cover w-full h-full" alt={selectedRecipe.name} />
                )}
              </div>
              
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-recipal-orange border-recipal-orange">
                    {selectedRecipe.mealType}
                  </Badge>
                  <div className="flex items-center text-muted-foreground text-sm gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedRecipe.prepTimeMinutes} min
                  </div>
                </div>
                <DialogTitle className="text-2xl font-display font-bold text-recipal-deep-green">
                  {selectedRecipe.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedRecipe.calories} calories &bull; {selectedRecipe.protein}g protein &bull; {selectedRecipe.carbs}g carbs &bull; {selectedRecipe.fat}g fat
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-recipal-deep-green flex items-center gap-2">
                    <Utensils className="w-4 h-4" /> Ingredients
                  </h3>
                  <ul className="space-y-2">
                    {selectedRecipe.ingredients.map((ing: any, idx: number) => {
                      const hasInPantry = pantryItems?.some(p => p.name.toLowerCase().includes(ing.name.toLowerCase()));
                      return (
                        <li key={idx} className="text-sm flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <span>{ing.amount} {ing.unit} {ing.name}</span>
                          {hasInPantry ? (
                            <Badge variant="secondary" className="bg-recipal-deep-green/10 text-recipal-deep-green border-none text-[10px]">
                              In Pantry
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Missing</Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-recipal-deep-green">Instructions</h3>
                  <ol className="space-y-4">
                    {selectedRecipe.instructions.map((step: string, idx: number) => (
                      <li key={idx} className="text-sm flex gap-3">
                        <span className="flex-shrink-0 w-5 h-5 bg-recipal-orange/10 text-recipal-orange rounded-full flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-muted-foreground leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="pt-6 border-t flex gap-4">
                <Button className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90">
                  Add to Weekly Plan
                </Button>
                <Button variant="outline" className="flex-1">
                  Save to Favorites
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
