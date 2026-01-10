import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Utensils, ChefHat } from "lucide-react";

export default function ShareRecipePage() {
  const params = useParams<{ id: string }>();
  const recipeId = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/recipe", recipeId, "share"],
    queryFn: async () => {
      const res = await fetch(`/api/recipe/${recipeId}/share`);
      if (!res.ok) throw new Error("Recipe not found");
      return res.json();
    },
    enabled: !!recipeId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.recipe) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <ChefHat className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Recipe Not Found</h2>
            <p className="text-muted-foreground">This recipe may have been removed or the link is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recipe = data.recipe;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-bold">R</span>
            <span className="text-xl font-bold font-display text-primary">ReciPal</span>
          </div>
          <p className="text-sm text-muted-foreground">Shared Recipe</p>
        </div>

        <Card className="overflow-hidden border-none shadow-lg">
          {recipe.imageUrl && (
            <div className="aspect-video w-full overflow-hidden">
              <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
            </div>
          )}
          
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-recipal-orange border-recipal-orange">
                {recipe.mealType}
              </Badge>
              <div className="flex items-center text-muted-foreground text-sm gap-1">
                <Clock className="w-3 h-3" />
                {recipe.prepTimeMinutes} min
              </div>
            </div>
            <CardTitle className="text-2xl md:text-3xl font-display font-bold text-recipal-deep-green">
              {recipe.name}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-8">
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-xl">
              <div className="text-center">
                <div className="text-xl font-bold text-recipal-deep-green">{recipe.calories}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Calories</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-recipal-deep-green">{recipe.protein}g</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Protein</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-recipal-deep-green">{recipe.carbs}g</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Carbs</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-recipal-deep-green">{recipe.fat}g</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Fat</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold text-recipal-deep-green flex items-center gap-2">
                  <Utensils className="w-4 h-4" /> Ingredients
                </h3>
                <ul className="space-y-2">
                  {recipe.ingredients?.map((ing: any, idx: number) => (
                    <li key={idx} className="text-sm p-2 rounded-md bg-muted/30">
                      {ing.amount} {ing.unit} {ing.name}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-recipal-deep-green">Instructions</h3>
                <ol className="space-y-4">
                  {recipe.instructions?.map((step: string, idx: number) => (
                    <li key={idx} className="text-sm flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-recipal-orange/10 text-recipal-orange rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-muted-foreground leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="pt-6 border-t text-center">
              <p className="text-sm text-muted-foreground mb-2">Want to plan your meals and save on groceries?</p>
              <a 
                href="/register" 
                className="inline-flex items-center gap-2 bg-recipal-orange text-white px-6 py-3 rounded-lg font-medium hover:bg-recipal-orange/90 transition-colors"
              >
                Join ReciPal Free
              </a>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by ReciPal - Plan meals, order groceries, cook smarter
        </p>
      </div>
    </div>
  );
}
