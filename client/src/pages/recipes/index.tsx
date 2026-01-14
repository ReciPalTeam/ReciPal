import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, Heart, Clock, Users, Plus, Share2, ChefHat, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { mockRecipes, Recipe } from "@/lib/mock-data";
import { useDemoStore, FoodGroup, MealType } from "@/lib/demo-store";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const COOKING_STYLES = ["Quick & Easy", "Meal Prep", "Healthy Gourmet", "Balanced", "Comfort Food"];
const DIETARY_FILTERS = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Low-Carb", "High-Protein"];
const FOOD_GROUPS: FoodGroup[] = ["Produce", "Meat & Seafood", "Dairy & Eggs", "Pantry Staples", "Frozen", "Snacks", "Beverages", "Condiments & Sauces", "Baking", "Spices"];

interface RecipeWithOverlap extends Recipe {
  overlap: { have: string[]; might: string[]; missing: string[] };
  overlapScore: number;
}

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("for-you");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [selectedCookingStyles, setSelectedCookingStyles] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedDay, setSelectedDay] = useState("0");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");

  const { favorites, toggleFavorite, getPantryOverlap, addToPlanner } = useDemoStore();

  const recipesWithOverlap: RecipeWithOverlap[] = useMemo(() => {
    return mockRecipes.map(recipe => {
      const overlap = getPantryOverlap(recipe);
      const total = recipe.ingredients.length;
      const overlapRatio = total > 0 ? ((overlap.have.length * 2) + overlap.might.length) / (total * 2) : 0;
      return { ...recipe, overlap, overlapScore: overlapRatio };
    });
  }, [getPantryOverlap]);

  const forYouRecipes = useMemo(() => {
    const mainRecipes = [...recipesWithOverlap]
      .filter(r => r.overlap.have.length > 0)
      .sort((a, b) => b.overlapScore - a.overlapScore);

    const missingFewRecipes = recipesWithOverlap
      .filter(r => r.overlap.missing.length >= 2 && r.overlap.missing.length <= 3)
      .filter(r => !mainRecipes.find(m => m.id === r.id))
      .sort((a, b) => a.overlap.missing.length - b.overlap.missing.length);

    const result: (RecipeWithOverlap & { isInjected?: boolean })[] = [];
    let injectedIndex = 0;
    const usedIds = new Set<string>();
    
    for (let i = 0; i < mainRecipes.length; i++) {
      if (!usedIds.has(mainRecipes[i].id)) {
        result.push(mainRecipes[i]);
        usedIds.add(mainRecipes[i].id);
      }
      
      if ((result.length) % 5 === 0 && injectedIndex < missingFewRecipes.length) {
        const injectedRecipe = missingFewRecipes[injectedIndex];
        if (!usedIds.has(injectedRecipe.id)) {
          result.push({ ...injectedRecipe, isInjected: true });
          usedIds.add(injectedRecipe.id);
          injectedIndex++;
        }
      }
    }

    return result;
  }, [recipesWithOverlap]);

  const somethingNewRecipes = useMemo(() => {
    const preferredStyles = ["Quick & Easy", "Balanced"];
    return recipesWithOverlap
      .filter(r => !preferredStyles.includes(r.cookingStyle))
      .sort(() => Math.random() - 0.5);
  }, [recipesWithOverlap]);

  const favoriteRecipes = useMemo(() => {
    return recipesWithOverlap.filter(r => favorites.includes(r.id));
  }, [recipesWithOverlap, favorites]);

  const getFilteredRecipes = () => {
    let recipes: RecipeWithOverlap[];
    
    switch (activeTab) {
      case "new":
        recipes = somethingNewRecipes;
        break;
      case "favorites":
        recipes = favoriteRecipes;
        break;
      default:
        recipes = forYouRecipes;
    }

    if (searchQuery) {
      recipes = recipes.filter(r => 
        r.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCookingStyles.length > 0) {
      recipes = recipes.filter(r => selectedCookingStyles.includes(r.cookingStyle));
    }

    return recipes;
  };

  const filteredRecipes = getFilteredRecipes();

  const handleOpenPlanDialog = (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    setSelectedRecipe(recipe);
    setSelectedDay("0");
    setSelectedMealType(recipe.mealTypes[0] as MealType || "Lunch");
    setPlanDialogOpen(true);
  };

  const handleConfirmAddToPlan = () => {
    if (!selectedRecipe) return;
    addToPlanner({
      recipeId: selectedRecipe.id,
      dayIndex: parseInt(selectedDay),
      mealType: selectedMealType,
    });
    setPlanDialogOpen(false);
    toast({
      title: "Added to meal plan!",
      description: `${selectedRecipe.title} added to ${WEEKDAYS[parseInt(selectedDay)]} ${selectedMealType}`,
    });
    setSelectedRecipe(null);
  };

  const handleShare = (e: React.MouseEvent, recipeId: string, recipeTitle: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/share/recipe/${recipeId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Share this recipe with friends and family",
    });
  };

  const toggleCookingStyle = (style: string) => {
    setSelectedCookingStyles(prev => 
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const clearFilters = () => {
    setSelectedCookingStyles([]);
    setSelectedDietary([]);
  };

  const getOverlapBadge = (recipe: RecipeWithOverlap) => {
    const total = recipe.ingredients.length;
    const have = recipe.overlap.have.length;
    const might = recipe.overlap.might.length;
    
    if (have === total) {
      return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[9px]">Ready</Badge>;
    }
    if (have + might >= total * 0.7) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[9px]">{have}/{total}</Badge>;
    }
    if (recipe.overlap.missing.length <= 3) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[9px]">Need {recipe.overlap.missing.length}</Badge>;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background p-4 space-y-4 border-b">
        <div className="flex items-center gap-2">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                data-testid="button-filter"
                className={selectedCookingStyles.length > 0 || selectedDietary.length > 0 ? "border-primary" : ""}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  Filter Recipes
                  {(selectedCookingStyles.length > 0 || selectedDietary.length > 0) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                      Clear
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>
              
              <div className="py-6 space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <ChefHat className="w-4 h-4" /> Cooking Style
                  </h4>
                  <div className="space-y-2">
                    {COOKING_STYLES.map(style => (
                      <div key={style} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`style-${style}`}
                          checked={selectedCookingStyles.includes(style)}
                          onCheckedChange={() => toggleCookingStyle(style)}
                          data-testid={`checkbox-style-${style.toLowerCase().replace(/\s+/g, '-')}`}
                        />
                        <Label htmlFor={`style-${style}`} className="text-sm cursor-pointer">
                          {style}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Dietary Preferences</h4>
                  <div className="space-y-2">
                    {DIETARY_FILTERS.map(filter => (
                      <div key={filter} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`diet-${filter}`}
                          checked={selectedDietary.includes(filter)}
                          onCheckedChange={() => {
                            setSelectedDietary(prev => 
                              prev.includes(filter) ? prev.filter(d => d !== filter) : [...prev, filter]
                            );
                          }}
                          data-testid={`checkbox-diet-${filter.toLowerCase()}`}
                        />
                        <Label htmlFor={`diet-${filter}`} className="text-sm cursor-pointer">
                          {filter}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger 
              value="for-you" 
              data-testid="tab-for-you"
              className="rounded-full data-[state=active]:bg-recipal-deep-green data-[state=active]:text-white transition-all duration-300"
            >
              For You
            </TabsTrigger>
            <TabsTrigger 
              value="new" 
              data-testid="tab-new"
              className="rounded-full data-[state=active]:bg-recipal-deep-green data-[state=active]:text-white transition-all duration-300"
            >
              Something New
            </TabsTrigger>
            <TabsTrigger 
              value="favorites" 
              data-testid="tab-favorites"
              className="rounded-full data-[state=active]:bg-recipal-deep-green data-[state=active]:text-white transition-all duration-300"
            >
              Favorites {favorites.length > 0 && `(${favorites.length})`}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "favorites" && favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
            <Heart className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No favorites yet</p>
            <p className="text-xs mt-1">Tap the heart on any recipe to save it here</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 items-stretch">
            {filteredRecipes.map((recipe) => (
              <Card 
                key={recipe.id} 
                className="overflow-hidden cursor-pointer relative shadow-[2px_2px_6px_rgba(0,0,0,0.15)] flex flex-col h-full"
                onClick={() => setLocation(`/recipe/${recipe.id}`)}
                data-testid={`card-recipe-${recipe.id}`}
              >
                {(recipe as RecipeWithOverlap & { isInjected?: boolean }).isInjected && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary/80 to-primary/60 text-white text-[9px] py-0.5 px-2 z-10 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Almost Ready
                  </div>
                )}
                <div className="aspect-square bg-muted relative">
                  <img 
                    src={recipe.image} 
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="bg-white/80 backdrop-blur-sm h-7 w-7"
                      onClick={(e) => handleShare(e, recipe.id, recipe.title)}
                      data-testid={`button-share-${recipe.id}`}
                    >
                      <Share2 className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`bg-white/80 backdrop-blur-sm h-7 w-7 ${favorites.includes(recipe.id) ? "text-red-500" : ""}`}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe.id); }}
                      data-testid={`button-favorite-${recipe.id}`}
                    >
                      <Heart className={`w-3 h-3 ${favorites.includes(recipe.id) ? "fill-current" : ""}`} />
                    </Button>
                  </div>
                  
                  <div className="absolute bottom-2 left-2">
                    {getOverlapBadge(recipe)}
                  </div>
                </div>
                <CardContent className="p-3 flex flex-col flex-1 gap-1.5">
                  <h3 className="font-semibold text-sm line-clamp-2">{recipe.title}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {recipe.cookTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {recipe.servings}
                    </span>
                  </div>
                  
                  {/* Bottom-aligned content */}
                  <div className="mt-auto flex flex-col gap-1.5">
                    {/* Macros display */}
                    <div className="flex gap-1 justify-center">
                      <div className="bg-recipal-orange/10 border border-recipal-orange/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
                        <span className="text-[10px] font-bold text-recipal-orange leading-none">{recipe.protein}g</span>
                        <span className="text-[7px] text-muted-foreground leading-none">Protein</span>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
                        <span className="text-[10px] font-bold text-primary leading-none">{recipe.carbs}g</span>
                        <span className="text-[7px] text-muted-foreground leading-none">Carbs</span>
                      </div>
                      <div className="bg-recipal-deep-green/10 border border-recipal-deep-green/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
                        <span className="text-[10px] font-bold text-recipal-deep-green leading-none">{recipe.fat}g</span>
                        <span className="text-[7px] text-muted-foreground leading-none">Fat</span>
                      </div>
                      <div className="bg-yellow-100/30 border border-yellow-500/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
                        <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 leading-none">{recipe.calories}</span>
                        <span className="text-[7px] text-black dark:text-white leading-none">Calories</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-full text-[11px] gap-1 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold px-4" 
                        onClick={(e) => handleOpenPlanDialog(e, recipe)}
                        data-testid={`button-add-plan-${recipe.id}`}
                      >
                        <Plus className="w-[12px] h-[12px]" /> Add to Plan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Meal Plan</DialogTitle>
            <DialogDescription>
              {selectedRecipe && `Choose when you'd like to have ${selectedRecipe.title}`}
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
            <Button onClick={handleConfirmAddToPlan} data-testid="button-confirm-plan">
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
