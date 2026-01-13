import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, LayoutGrid, List, X, ChefHat, Flame } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { useDemoStore, MealType } from "@/lib/demo-store";
import { mockRecipes } from "@/lib/mock-data";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const mealTypes: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function PlannerPage() {
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { planner, removeFromPlanner, acceleratePantryDecay } = useDemoStore();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getMealsForDay = (day: Date) => {
    return planner.filter(m => {
      const mealDate = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), m.dayIndex);
      return format(mealDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
    });
  };

  const getRecipeById = (recipeId: string) => {
    return mockRecipes.find(r => r.id === recipeId);
  };

  const getDayCalories = (day: Date) => {
    const meals = getMealsForDay(day);
    return meals.reduce((sum, meal) => {
      const recipe = getRecipeById(meal.recipeId);
      return sum + (recipe?.calories || 0);
    }, 0);
  };

  const handleRemoveMeal = (mealId: string) => {
    removeFromPlanner(mealId);
    toast({
      title: "Removed from plan",
      description: "Recipe removed and cart updated",
    });
  };

  const handleCookNow = (meal: typeof planner[0]) => {
    const recipe = getRecipeById(meal.recipeId);
    if (recipe) {
      acceleratePantryDecay(recipe.ingredients.map(i => i.name));
      removeFromPlanner(meal.id);
      toast({
        title: "Enjoy your meal!",
        description: "Pantry updated based on ingredients used",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background p-4 space-y-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} data-testid="button-prev-week">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-sm">
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} data-testid="button-next-week">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "card" | "list")}>
            <TabsList className="h-8">
              <TabsTrigger value="card" className="h-6 px-2" data-testid="button-card-view">
                <LayoutGrid className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="list" className="h-6 px-2" data-testid="button-list-view">
                <List className="w-3 h-3" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === "card" ? (
          <div className="space-y-4">
            {days.map((day) => {
              const dayMeals = getMealsForDay(day);
              const dayCalories = dayMeals.reduce((sum, meal) => {
                const recipe = getRecipeById(meal.recipeId);
                return sum + (recipe?.calories || 0);
              }, 0);
              
              return (
                <Card key={day.toISOString()} data-testid={`card-day-${format(day, 'yyyy-MM-dd')}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{format(day, "EEEE, MMM d")}</span>
                      {dayCalories > 0 && (
                        <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                          <Flame className="w-3 h-3" /> {dayCalories} cal
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {mealTypes.map((mealType) => {
                      const mealsOfType = dayMeals.filter(m => m.mealType === mealType);
                      
                      return (
                        <div key={mealType} className="space-y-1">
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs text-muted-foreground font-medium">{mealType}</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs gap-1"
                              onClick={() => setLocation("/recipes")}
                              data-testid={`button-add-${mealType.toLowerCase()}-${format(day, 'yyyy-MM-dd')}`}
                            >
                              <Plus className="w-3 h-3" /> Add
                            </Button>
                          </div>
                          
                          {mealsOfType.map((meal) => {
                            const recipe = getRecipeById(meal.recipeId);
                            if (!recipe) return null;
                            
                            return (
                              <div 
                                key={meal.id} 
                                className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                                data-testid={`meal-${meal.id}`}
                              >
                                <img 
                                  src={recipe.image} 
                                  alt={recipe.title}
                                  className="w-10 h-10 rounded object-cover cursor-pointer"
                                  onClick={() => setLocation(`/recipe/${recipe.id}`)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{recipe.title}</p>
                                  <p className="text-[10px] text-muted-foreground">{recipe.calories} cal</p>
                                </div>
                                <div className="flex gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-green-600"
                                    onClick={() => handleCookNow(meal)}
                                    data-testid={`button-cook-${meal.id}`}
                                  >
                                    <ChefHat className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => handleRemoveMeal(meal.id)}
                                    data-testid={`button-remove-${meal.id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {days.map((day) => {
              const dayMeals = getMealsForDay(day);
              const dayCalories = dayMeals.reduce((sum, meal) => {
                const recipe = getRecipeById(meal.recipeId);
                return sum + (recipe?.calories || 0);
              }, 0);
              
              return (
                <div key={day.toISOString()} className="p-3 border rounded-lg" data-testid={`row-day-${format(day, 'yyyy-MM-dd')}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{format(day, "EEE, MMM d")}</span>
                    {dayMeals.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {dayMeals.length} meals
                        </Badge>
                        <span className="text-xs text-muted-foreground">{dayCalories} cal</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No meals planned</span>
                    )}
                  </div>
                  
                  {dayMeals.length > 0 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                      {dayMeals.map((meal) => {
                        const recipe = getRecipeById(meal.recipeId);
                        if (!recipe) return null;
                        return (
                          <div 
                            key={meal.id} 
                            className="flex-shrink-0 text-center cursor-pointer"
                            onClick={() => setLocation(`/recipe/${recipe.id}`)}
                          >
                            <img 
                              src={recipe.image} 
                              alt={recipe.title}
                              className="w-12 h-12 rounded object-cover"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">{meal.mealType}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {planner.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ChefHat className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm">No meals planned yet</p>
            <p className="text-xs mt-1">Browse recipes and add them to your plan</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setLocation("/recipes")}
              data-testid="button-browse-recipes"
            >
              Browse Recipes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
