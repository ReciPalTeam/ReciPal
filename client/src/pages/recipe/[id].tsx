import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Heart, Share2, Clock, Users, Flame, Plus, Check, HelpCircle, ShoppingCart, ChefHat, Calendar } from "lucide-react";
import { mockRecipes, Recipe } from "@/lib/mock-data";
import { useDemoStore, MealType } from "@/lib/demo-store";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function RecipeDetailPage() {
  const [, params] = useRoute("/recipe/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState("0");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");

  const { 
    favorites, 
    toggleFavorite, 
    getPantryOverlap, 
    addToPlanner, 
    addRecipeIngredientsToCart,
    acceleratePantryDecay 
  } = useDemoStore();

  const recipe = mockRecipes.find((r: Recipe) => r.id === params?.id);

  if (!recipe) {
    return (
      <div className="p-4 text-center">
        <p>Recipe not found</p>
        <Button onClick={() => setLocation("/recipes")} className="mt-4">Back to Recipes</Button>
      </div>
    );
  }

  const pantryStatus = getPantryOverlap(recipe);
  const isFavorite = favorites.includes(recipe.id);

  const handleShare = () => {
    const url = `${window.location.origin}/share/recipe/${recipe.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Share this recipe with friends and family",
    });
  };

  const handleAddToPlan = () => {
    addToPlanner({
      recipeId: recipe.id,
      dayIndex: parseInt(selectedDay),
      mealType: selectedMealType,
    });
    setPlanDialogOpen(false);
    toast({
      title: "Added to meal plan!",
      description: `${recipe.title} added to ${WEEKDAYS[parseInt(selectedDay)]} ${selectedMealType}`,
    });
  };

  const handleGetMissing = () => {
    addRecipeIngredientsToCart(recipe);
    toast({
      title: "Added to cart!",
      description: `${pantryStatus.missing.length} ingredients added`,
    });
    setLocation("/cart");
  };

  const handleCookNow = () => {
    acceleratePantryDecay(recipe.ingredients.map(i => i.name));
    toast({
      title: "Enjoy your meal!",
      description: "Pantry updated based on ingredients used",
    });
  };

  const getIngredientStatus = (ingredientName: string) => {
    if (pantryStatus.have.includes(ingredientName)) return "have";
    if (pantryStatus.might.includes(ingredientName)) return "might";
    return "need";
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
              className={`bg-white/20 backdrop-blur-sm text-white ${isFavorite ? "text-red-400" : ""}`}
              onClick={() => toggleFavorite(recipe.id)}
              data-testid="button-favorite"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="bg-white/20 backdrop-blur-sm text-white"
              onClick={handleShare}
              data-testid="button-share"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white overflow-hidden">
          <h1 className="text-[30px] font-bold mb-2 text-[#ff6300] whitespace-nowrap" style={{ WebkitTextStroke: '4px white', paintOrder: 'stroke fill', fontSize: 'clamp(1rem, 7.5vw, 30px)' }}>{recipe.title}</h1>
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
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Have ({pantryStatus.have.length})</span>
                  {pantryStatus.have.length > 0 && (
                    <p className="text-xs text-muted-foreground">{pantryStatus.have.join(", ")}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Might Have ({pantryStatus.might.length})</span>
                  {pantryStatus.might.length > 0 && (
                    <p className="text-xs text-muted-foreground">{pantryStatus.might.join(", ")}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-3 h-3 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">Need ({pantryStatus.missing.length})</span>
                  {pantryStatus.missing.length > 0 && (
                    <p className="text-xs text-muted-foreground">{pantryStatus.missing.join(", ")}</p>
                  )}
                </div>
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
              {recipe.ingredients.map((ing, idx) => {
                const status = getIngredientStatus(ing.name);
                return (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between py-2 border-b last:border-0"
                    data-testid={`ingredient-${idx}`}
                  >
                    <div className="flex items-center gap-2">
                      {status === "have" && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-[9px] px-1.5">Have</Badge>
                      )}
                      {status === "might" && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800 text-[9px] px-1.5">Maybe</Badge>
                      )}
                      {status === "need" && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-[9px] px-1.5">Need</Badge>
                      )}
                      <span className="text-sm">{ing.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{ing.amount} {ing.unit}</span>
                  </div>
                );
              })}
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

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t space-y-2">
        {pantryStatus.missing.length === 0 ? (
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 font-bold h-12"
            onClick={handleCookNow}
            data-testid="button-cook-now"
          >
            <ChefHat className="w-5 h-5 mr-2" /> Cook Now
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button 
              className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90 font-bold h-12"
              onClick={() => setPlanDialogOpen(true)}
              data-testid="button-add-to-plan"
            >
              <Calendar className="w-5 h-5 mr-2" /> Add to Plan
            </Button>
            <Button 
              variant="outline" 
              className="h-12 px-4"
              onClick={handleGetMissing}
              data-testid="button-get-missing"
            >
              <ShoppingCart className="w-4 h-4 mr-2" /> Get {pantryStatus.missing.length}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Meal Plan</DialogTitle>
            <DialogDescription>
              Choose when you'd like to have {recipe.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Day</label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger data-testid="select-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Meal</label>
              <Select value={selectedMealType} onValueChange={(v) => setSelectedMealType(v as MealType)}>
                <SelectTrigger data-testid="select-meal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddToPlan} data-testid="button-confirm-plan">
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
