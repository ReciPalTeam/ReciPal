import { useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Flame, ChefHat, Download, Info } from "lucide-react";
import { mockRecipes, Recipe } from "@/lib/mock-data";

export default function ShareRecipePage() {
  const [, params] = useRoute("/share/recipe/:id");

  const recipe = mockRecipes.find((r: Recipe) => r.id === params?.id);

  useEffect(() => {
    if (recipe) {
      document.title = `${recipe.title} | ReciPal Recipe`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', `${recipe.title} - ${recipe.calories} calories, ${recipe.protein}g protein. ${recipe.cookTime} cook time. Get this recipe on ReciPal.`);
      }
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:title');
        meta.setAttribute('content', recipe.title);
        document.head.appendChild(meta);
      }
    }
  }, [recipe]);

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-primary/5 to-background">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <ChefHat className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h2 className="text-lg font-bold mb-2">Recipe Not Found</h2>
            <p className="text-sm text-muted-foreground">
              This recipe might have been removed or the link is incorrect.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="max-w-2xl mx-auto">
        <div className="relative h-72 sm:h-80">
          <img 
            src={recipe.image} 
            alt={recipe.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          
          <div className="absolute top-4 left-4">
            <Badge className="bg-recipal-orange text-white border-0">
              ReciPal Recipe
            </Badge>
          </div>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h1 className="text-2xl font-bold mb-2 text-[#ff6300]" style={{ WebkitTextStroke: '1px white', paintOrder: 'stroke fill' }}>{recipe.title}</h1>
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

        <div className="p-4 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-recipal-orange/10 border-recipal-orange/20">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-recipal-orange">{recipe.protein}g</p>
                <p className="text-xs text-muted-foreground">Protein</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-primary">{recipe.carbs}g</p>
                <p className="text-xs text-muted-foreground">Carbs</p>
              </CardContent>
            </Card>
            <Card className="bg-recipal-deep-green/10 border-recipal-deep-green/20">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-recipal-deep-green">{recipe.fat}g</p>
                <p className="text-xs text-muted-foreground">Fat</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <ChefHat className="w-3 h-3 text-primary" />
                </span>
                Ingredients ({recipe.ingredients.length})
              </h3>
              <div className="space-y-2">
                {recipe.ingredients.map((ing, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-sm">{ing.name}</span>
                    <span className="text-sm text-muted-foreground">{ing.amount} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-4">Instructions</h3>
              <div className="space-y-4">
                {recipe.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-sm">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground">
              Nutrition information is estimated and for informational purposes only. Not medical advice. 
              Always consult with a healthcare professional before making dietary changes.
            </p>
          </div>

          <Card className="bg-gradient-to-r from-primary/10 to-recipal-orange/10 border-primary/20">
            <CardContent className="p-6 text-center">
              <ChefHat className="w-12 h-12 mx-auto mb-3 text-primary" />
              <h3 className="font-bold mb-2">Want more recipes like this?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Download ReciPal to plan meals, track your pantry, and discover recipes tailored to your preferences.
              </p>
              <Button className="bg-primary hover:bg-primary/90" data-testid="button-get-app">
                <Download className="w-4 h-4 mr-2" />
                Get ReciPal
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
