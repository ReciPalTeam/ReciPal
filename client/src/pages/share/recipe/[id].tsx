import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Flame, ChefHat, Download, Info, Loader2, MapPin } from "lucide-react";
import type { Recipe } from "@/lib/mock-data";

export default function ShareRecipePage() {
  const [, params] = useRoute("/share/recipe/:id");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadRecipe = async () => {
      if (!params?.id) {
        setLoading(false);
        setError(true);
        return;
      }
      try {
        const response = await fetch(`/api/recipes/shared/${params.id}`);
        if (!response.ok) throw new Error('Not found');
        const data = await response.json();
        setRecipe(data.recipe);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadRecipe();
  }, [params?.id]);

  useEffect(() => {
    if (recipe) {
      document.title = `${recipe.title} | ReciPal Recipe`;
    }
  }, [recipe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Loader2 className="w-8 h-8 animate-spin text-recipal-orange" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Recipe Not Found</h2>
            <p className="text-muted-foreground mb-6">This recipe link might be expired or incorrect.</p>
            <Button className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white rounded-full" asChild>
              <a href="/">Go to ReciPal</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <img 
          src={recipe.image} 
          alt={recipe.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-recipal-orange flex items-center justify-center text-white font-bold text-lg">
              R
            </div>
            <Badge variant="outline" className="bg-white/20 backdrop-blur-md text-white border-white/30">
              ReciPal Recipe
            </Badge>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h1 className="font-bold mb-2 text-[#ff6300] whitespace-nowrap overflow-hidden text-ellipsis" style={{ WebkitTextStroke: '4px white', paintOrder: 'stroke fill', fontSize: 'clamp(1rem, 7.5vw, 30px)' }}>{recipe.title}</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {recipe.cookTime}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {recipe.servings} servings
            </span>
            <span className="flex items-center gap-1">
              <Flame className="w-4 h-4" /> {recipe.calories} cal
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-recipal-orange/10 border-recipal-orange/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-recipal-orange">{recipe.protein}g</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Protein</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-primary">{recipe.carbs}g</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Carbs</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/40">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-blue-800 dark:text-blue-300">{recipe.fat}g</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fat</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1 bg-recipal-deep-green hover:bg-recipal-deep-green/90 h-12 text-recipal-light-green font-bold text-lg" asChild>
            {/* /register, not /auth — no /auth route exists (App.tsx routes only
                /login and /register to the auth page) */}
            <a href="/register">
              <ChefHat className="w-5 h-5 mr-2" /> Try on ReciPal
            </a>
          </Button>
          <Button variant="outline" className="h-12 border-recipal-deep-green text-recipal-deep-green" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-2" /> Print Recipe
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-recipal-orange rounded-full" />
              Ingredients
            </h2>
            <Card>
              <CardContent className="p-4 divide-y divide-border">
                {recipe.ingredients.map((ing, idx) => (
                  <div key={idx} className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0">
                    <span className="text-sm font-medium">{ing.name}</span>
                    <span className="text-sm text-muted-foreground">{ing.amount} {ing.unit}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-recipal-deep-green rounded-full" />
              Cooking Steps
            </h2>
            <div className="space-y-4">
              {recipe.steps.map((step, idx) => {
                const isRich = typeof step === 'object';
                const stepNum = isRich && step.step > 0 ? step.step : idx + 1;
                const instruction = isRich ? step.instruction : step;
                const time = isRich ? step.time : '';
                const location = isRich ? (step as any).location ?? step.equipment : '';

                return (
                  <div key={idx} className="flex gap-4">
                    <div className="w-7 h-7 rounded-full bg-recipal-deep-green text-recipal-light-green flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                      {stepNum}
                    </div>
                    <div className="pt-0.5 flex-1">
                      <p className="text-sm leading-relaxed">{instruction}</p>
                      {(time || location) && (
                        <div className="flex gap-3 mt-1.5">
                          {time && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" />
                              {time}
                            </span>
                          )}
                          {location && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <MapPin className="w-3 h-3" />
                              {location}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-8 mt-8 border-t text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-recipal-orange flex items-center justify-center text-white font-bold text-xs">
              R
            </div>
            <span className="font-bold text-recipal-deep-green">ReciPal</span>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Cook smarter, eat better, save more.
          </p>
        </div>
      </div>
    </div>
  );
}
