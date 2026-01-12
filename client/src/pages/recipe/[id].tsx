import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Heart, Share2, Clock, Users, Flame, Plus, Check, HelpCircle } from "lucide-react";
import { mockRecipes, Recipe } from "@/lib/mock-data";

export default function RecipeDetailPage() {
  const [, params] = useRoute("/recipe/:id");
  const [, setLocation] = useLocation();

  const recipe = mockRecipes.find((r: Recipe) => r.id === params?.id);

  if (!recipe) {
    return (
      <div className="p-4 text-center">
        <p>Recipe not found</p>
        <Button onClick={() => setLocation("/recipes")} className="mt-4">Back to Recipes</Button>
      </div>
    );
  }

  const pantryStatus = {
    have: ["Chicken Breast", "Olive Oil"],
    might: ["Avocado"],
    need: ["Cherry Tomatoes", "Mixed Greens"],
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="relative h-64">
        <img 
          src={recipe.image} 
          alt={recipe.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            className="bg-white/20 backdrop-blur-sm text-white"
            onClick={() => setLocation("/recipes")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="bg-white/20 backdrop-blur-sm text-white"
              data-testid="button-favorite"
            >
              <Heart className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="bg-white/20 backdrop-blur-sm text-white"
              data-testid="button-share"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h1 className="text-xl font-bold mb-2">{recipe.title}</h1>
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

      <div className="flex-1 p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-recipal-orange/10 border-recipal-orange/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-recipal-orange">{recipe.protein}g</p>
              <p className="text-[10px] text-muted-foreground">Protein</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-primary">{recipe.carbs}g</p>
              <p className="text-[10px] text-muted-foreground">Carbs</p>
            </CardContent>
          </Card>
          <Card className="bg-recipal-deep-green/10 border-recipal-deep-green/20">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-recipal-deep-green">{recipe.fat}g</p>
              <p className="text-[10px] text-muted-foreground">Fat</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Pantry Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-sm">Have: {pantryStatus.have.join(", ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
                  <HelpCircle className="w-3 h-3 text-yellow-600" />
                </div>
                <span className="text-sm">Might Have: {pantryStatus.might.join(", ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <Plus className="w-3 h-3 text-red-600" />
                </div>
                <span className="text-sm">Need: {pantryStatus.need.join(", ")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="ingredients" data-testid="tab-ingredients">Ingredients</TabsTrigger>
            <TabsTrigger value="steps" data-testid="tab-steps">Steps</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ingredients" className="mt-4">
            <div className="space-y-2">
              {recipe.ingredients.map((ing, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between py-2 border-b last:border-0"
                  data-testid={`ingredient-${idx}`}
                >
                  <span className="text-sm">{ing.name}</span>
                  <span className="text-sm text-muted-foreground">{ing.amount} {ing.unit}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="steps" className="mt-4">
            <div className="space-y-4">
              {recipe.steps.map((step, idx) => (
                <div key={idx} className="flex gap-3" data-testid={`step-${idx}`}>
                  <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-sm">{step}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t flex gap-3">
        <Button 
          className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90 font-bold h-12"
          data-testid="button-add-to-plan"
        >
          <Plus className="w-5 h-5 mr-2" /> Add to Plan
        </Button>
        <Button 
          variant="outline" 
          className="h-12"
          data-testid="button-get-missing"
        >
          Get Missing
        </Button>
      </div>
    </div>
  );
}
