import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, Heart, Clock, Users, Plus, Share2, ChefHat, Sparkles, Baby, DollarSign, Timer, Minus, ShoppingCart, Utensils, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CollapsibleFilterSection } from "@/components/collapsible-filter-section";
import { mockRecipes, Recipe } from "@/lib/mock-data";
import { useDemoStore, FoodGroup, MealType } from "@/lib/demo-store";
import { useProfile } from "@/hooks/use-profile";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

/*
 * FILTER OPTIONS SPEC:
 * These filters reflect how people actually choose meals (meal type, time, cost, kid-friendly)
 * and must map to onboarding personalization inputs.
 */

const FILTER_MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks"];

const CUISINE_CATEGORIES = [
  "American",
  "Italian", 
  "Mexican",
  "Asian",
  "Mediterranean",
  "Indian",
  "Middle Eastern",
  "Caribbean",
  "Southern / Comfort Food",
  "BBQ / Grill",
  "Healthy / Light",
  "Breakfast / Brunch",
  "Desserts / Baking"
];

const TIME_DIFFICULTY_OPTIONS = [
  { value: "quick", label: "Quick & easy" },
  { value: "comfortable", label: "Comfortable following recipes" },
  { value: "involved", label: "I enjoy more involved cooking" },
];

const COST_PREFERENCE_OPTIONS = [
  { value: "low", label: "Keeping costs low" },
  { value: "balanced", label: "A balance of cost and quality" },
  { value: "flexible", label: "I'm flexible" },
];

const DIETARY_RESTRICTIONS = [
  "None", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", 
  "Dairy-free", "Gluten-free", "Low-carb"
];

const ALLERGIES = [
  "Peanuts", "Tree nuts", "Shellfish", "Fish", "Dairy", 
  "Eggs", "Soy", "Gluten", "Sesame", "Other"
];

interface RecipeWithOverlap extends Recipe {
  overlap: { have: string[]; might: string[]; missing: string[] };
  overlapScore: number;
  pantryHaveCount: number;
  pantryMissingCount: number;
  pantryMissingIsSmall: boolean;
}

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("for-you");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: profile } = useProfile();
  
  // Filter state
  const [selectedMealTypes, setSelectedMealTypes] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedServingSize, setSelectedServingSize] = useState<number>(1);
  const [kidFriendly, setKidFriendly] = useState(false);
  const [timeDifficulty, setTimeDifficulty] = useState<string>("");
  const [costPreference, setCostPreference] = useState<string>("");
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedDay, setSelectedDay] = useState("0");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");

  const { favorites, toggleFavorite, getPantryOverlap, addToPlanner } = useDemoStore();

  // Get user's profile preferences for ranking
  const userDietaryPreferences = profile?.dietaryPreferences || [];
  const userAllergies = profile?.allergies || [];
  const userCookingComfort = profile?.cookingComfort || "comfortable";
  const userCostPreference = profile?.costPreference || "balanced";

  const recipesWithOverlap: RecipeWithOverlap[] = useMemo(() => {
    return mockRecipes.map(recipe => {
      const overlap = getPantryOverlap(recipe);
      const total = recipe.ingredients.length;
      const overlapRatio = total > 0 ? ((overlap.have.length * 2) + overlap.might.length) / (total * 2) : 0;
      return { 
        ...recipe, 
        overlap, 
        overlapScore: overlapRatio,
        pantryHaveCount: overlap.have.length,
        pantryMissingCount: overlap.missing.length,
        pantryMissingIsSmall: overlap.missing.length >= 2 && overlap.missing.length <= 3,
      };
    });
  }, [getPantryOverlap]);

  // Check if recipe violates allergies (hard exclusion)
  const hasAllergyConflict = (recipe: Recipe, allergies: string[]) => {
    if (allergies.length === 0) return false;
    const ingredientNames = recipe.ingredients.map(i => i.name.toLowerCase());
    return allergies.some(allergy => {
      const allergyLower = allergy.toLowerCase();
      return ingredientNames.some(ing => ing.includes(allergyLower));
    });
  };

  // Check if recipe matches dietary preferences
  const matchesDietary = (recipe: Recipe, dietary: string[]) => {
    if (dietary.length === 0 || dietary.includes("None")) return true;
    // For now, basic matching based on cooking style / tags
    // In production, this would check recipe tags or categorization
    return true;
  };

  // For You feed with deterministic ranking
  const forYouRecipes = useMemo(() => {
    // Step 1: Filter out allergy conflicts (hard exclusion)
    const safeRecipes = recipesWithOverlap.filter(
      r => !hasAllergyConflict(r, userAllergies)
    );

    // Cost scoring: maps cuisine categories to estimated cost tier (1=low, 2=balanced, 3=premium)
    const getCostTier = (cuisine: string): number => {
      const costMap: Record<string, number> = {
        "American": 1,
        "Mexican": 1,
        "Southern / Comfort Food": 1,
        "Breakfast / Brunch": 1,
        "Desserts / Baking": 1,
        "Italian": 2,
        "Asian": 2,
        "Indian": 2,
        "Caribbean": 2,
        "BBQ / Grill": 2,
        "Healthy / Light": 2,
        "Mediterranean": 3,
        "Middle Eastern": 3,
      };
      return costMap[cuisine] || 2;
    };

    // Get preferred cost tier based on user preference
    const getPreferredCostTier = (pref: string): number => {
      switch (pref) {
        case "low": return 1;
        case "balanced": return 2;
        case "flexible": return 3;
        default: return 2;
      }
    };

    const preferredCostTier = getPreferredCostTier(userCostPreference);

    // Comfort map for cuisine preference matching based on cooking complexity
    const comfortMap: Record<string, string[]> = {
      quick: ["American", "Mexican", "Breakfast / Brunch", "Healthy / Light"],
      comfortable: ["Italian", "Asian", "Mediterranean", "Indian"],
      involved: ["BBQ / Grill", "Southern / Comfort Food", "Middle Eastern", "Caribbean", "Desserts / Baking"],
    };
    const preferredCuisines = comfortMap[userCookingComfort] || [];

    // Step 2: Create baseList (excludes recipes with 2-3 missing ingredients)
    // Deterministic ranking: overlap → comfort → cost → id
    const baseList = safeRecipes
      .filter(r => !r.pantryMissingIsSmall)
      .sort((a, b) => {
        // Priority 1: Pantry overlap score (higher is better)
        // Use significant difference threshold to group similar overlaps
        const overlapDiff = b.overlapScore - a.overlapScore;
        if (Math.abs(overlapDiff) > 0.1) return overlapDiff > 0 ? 1 : -1;
        
        // Priority 2: Cuisine comfort match (boost matching recipes)
        const aComfortMatch = preferredCuisines.includes(a.cookingStyle) ? 1 : 0;
        const bComfortMatch = preferredCuisines.includes(b.cookingStyle) ? 1 : 0;
        if (aComfortMatch !== bComfortMatch) return bComfortMatch - aComfortMatch;

        // Priority 3: Cost preference (boost recipes closer to user's cost preference)
        const aCostTier = getCostTier(a.cookingStyle);
        const bCostTier = getCostTier(b.cookingStyle);
        const aCostDistance = Math.abs(aCostTier - preferredCostTier);
        const bCostDistance = Math.abs(bCostTier - preferredCostTier);
        if (aCostDistance !== bCostDistance) return aCostDistance - bCostDistance;

        // Priority 4: Deterministic tie-breaker using recipe id
        return a.id.localeCompare(b.id);
      });

    // Step 3: Create closeList (recipes with exactly 2-3 missing)
    const closeList = safeRecipes
      .filter(r => r.pantryMissingIsSmall)
      .sort((a, b) => a.pantryMissingCount - b.pantryMissingCount);

    // Step 4: Compose finalFeed with strict every-5th injection
    const finalFeed: (RecipeWithOverlap & { isInjected?: boolean })[] = [];
    let baseIndex = 0;
    let closeIndex = 0;
    const usedIds = new Set<string>();

    // Dev-only debug logging for top 10 recipes
    if (process.env.NODE_ENV === 'development') {
      console.log('=== For You Feed Debug ===');
      console.log('User preferences:', { 
        cookingComfort: userCookingComfort, 
        costPreference: userCostPreference,
        preferredCostTier,
      });
      console.log('Top 10 baseList recipes:', baseList.slice(0, 10).map(r => ({
        title: r.title,
        overlapScore: r.overlapScore.toFixed(2),
        missingCount: r.pantryMissingCount,
        cookingStyle: r.cookingStyle,
        costTier: getCostTier(r.cookingStyle),
        costDistance: Math.abs(getCostTier(r.cookingStyle) - preferredCostTier),
      })));
      console.log('closeList recipes:', closeList.map(r => ({
        title: r.title,
        missingCount: r.pantryMissingCount,
      })));
    }

    let position = 1;
    while (baseIndex < baseList.length || closeIndex < closeList.length) {
      // Every 5th position: inject from closeList if available
      if (position % 5 === 0 && closeIndex < closeList.length) {
        const recipe = closeList[closeIndex];
        if (!usedIds.has(recipe.id)) {
          finalFeed.push({ ...recipe, isInjected: true });
          usedIds.add(recipe.id);
          closeIndex++;
        }
      } else if (baseIndex < baseList.length) {
        const recipe = baseList[baseIndex];
        if (!usedIds.has(recipe.id)) {
          finalFeed.push(recipe);
          usedIds.add(recipe.id);
        }
        baseIndex++;
      } else if (closeIndex < closeList.length) {
        // If baseList is exhausted but we're not at position 5, still add from closeList
        const recipe = closeList[closeIndex];
        if (!usedIds.has(recipe.id)) {
          finalFeed.push({ ...recipe, isInjected: true });
          usedIds.add(recipe.id);
        }
        closeIndex++;
      }
      position++;
    }

    return finalFeed;
  }, [recipesWithOverlap, userAllergies, userCookingComfort, userCostPreference]);

  // Something New feed - exploratory, enforces allergies/dietary but not cooking style preferences
  const somethingNewRecipes = useMemo(() => {
    // Always enforce allergies
    const safeRecipes = recipesWithOverlap.filter(
      r => !hasAllergyConflict(r, userAllergies)
    );
    
    // Always enforce dietary restrictions from profile
    const dietaryFiltered = safeRecipes.filter(r => matchesDietary(r, userDietaryPreferences));
    
    // NOT constrained by preferred cooking styles by default (exploratory)
    // Use stable sorting based on recipe id for deterministic behavior
    return dietaryFiltered.sort((a, b) => a.id.localeCompare(b.id));
  }, [recipesWithOverlap, userAllergies, userDietaryPreferences]);

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

    // Apply user-selected filters
    if (searchQuery) {
      recipes = recipes.filter(r => 
        r.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedMealTypes.length > 0) {
      recipes = recipes.filter(r => 
        r.mealTypes.some(mt => selectedMealTypes.includes(mt))
      );
    }

    if (selectedCuisines.length > 0) {
      recipes = recipes.filter(r => selectedCuisines.includes(r.cookingStyle));
    }

    if (selectedServingSize > 1) {
      recipes = recipes.filter(r => {
        if (selectedServingSize >= 10) return r.servings >= 10;
        return r.servings === selectedServingSize;
      });
    }

    // Filter by allergies selected in filter (combines with profile allergies)
    if (selectedAllergies.length > 0) {
      recipes = recipes.filter(r => !hasAllergyConflict(r, selectedAllergies));
    }

    return recipes;
  };

  const filteredRecipes = getFilteredRecipes();

  const hasActiveFilters = selectedMealTypes.length > 0 || selectedCuisines.length > 0 || 
    selectedServingSize > 1 || kidFriendly || timeDifficulty || costPreference || 
    selectedDietary.length > 0 || selectedAllergies.length > 0;

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
      servings: 1,
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

  const toggleMealType = (type: string) => {
    setSelectedMealTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines(prev => 
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
    );
  };

  const incrementServingSize = () => {
    setSelectedServingSize(prev => Math.min(prev + 1, 10));
  };

  const decrementServingSize = () => {
    setSelectedServingSize(prev => Math.max(prev - 1, 1));
  };

  const toggleDietary = (diet: string) => {
    if (diet === "None") {
      setSelectedDietary(["None"]);
    } else {
      setSelectedDietary(prev => {
        const filtered = prev.filter(d => d !== "None");
        return filtered.includes(diet) ? filtered.filter(d => d !== diet) : [...filtered, diet];
      });
    }
  };

  const toggleAllergy = (allergy: string) => {
    setSelectedAllergies(prev => 
      prev.includes(allergy) ? prev.filter(a => a !== allergy) : [...prev, allergy]
    );
  };

  const clearFilters = () => {
    setSelectedMealTypes([]);
    setSelectedCuisines([]);
    setSelectedServingSize(1);
    setKidFriendly(false);
    setTimeDifficulty("");
    setCostPreference("");
    setSelectedDietary([]);
    setSelectedAllergies([]);
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
    if (recipe.pantryMissingCount <= 3) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[9px]">Need {recipe.pantryMissingCount}</Badge>;
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
                className={hasActiveFilters ? "border-primary" : ""}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  Filter Recipes
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                      Clear
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>
              
              <div className="py-6 space-y-4">
                {/* 1) Meal Type - default open */}
                <CollapsibleFilterSection 
                  title="Meal Type" 
                  icon={<Utensils className="w-4 h-4" />}
                  defaultOpen={true}
                  testId="meal-type"
                >
                  <div className="space-y-2">
                    {FILTER_MEAL_TYPES.map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`meal-${type}`}
                          checked={selectedMealTypes.includes(type)}
                          onCheckedChange={() => toggleMealType(type)}
                          data-testid={`checkbox-meal-${type.toLowerCase()}`}
                        />
                        <Label htmlFor={`meal-${type}`} className="text-sm cursor-pointer">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleFilterSection>

                {/* 2) Cuisine Categories - default open */}
                <CollapsibleFilterSection 
                  title="Cuisine" 
                  icon={<ChefHat className="w-4 h-4" />}
                  defaultOpen={true}
                  testId="cuisine"
                >
                  <div className="space-y-2">
                    {CUISINE_CATEGORIES.map(cuisine => (
                      <div key={cuisine} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cuisine-${cuisine}`}
                          checked={selectedCuisines.includes(cuisine)}
                          onCheckedChange={() => toggleCuisine(cuisine)}
                          data-testid={`checkbox-cuisine-${cuisine.toLowerCase().replace(/[\s\/]+/g, '-')}`}
                        />
                        <Label htmlFor={`cuisine-${cuisine}`} className="text-sm cursor-pointer">
                          {cuisine}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleFilterSection>

                {/* 3) Serving Size - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Serving Size" 
                  icon={<Users className="w-4 h-4" />}
                  testId="serving-size"
                >
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={decrementServingSize}
                      disabled={selectedServingSize <= 1}
                      data-testid="button-serving-minus"
                      className="shadow-md border-0"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="text-lg font-semibold min-w-[3rem] text-center" data-testid="text-serving-size">
                      {selectedServingSize >= 10 ? "10+" : selectedServingSize}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={incrementServingSize}
                      disabled={selectedServingSize >= 10}
                      data-testid="button-serving-plus"
                      className="shadow-md border-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </CollapsibleFilterSection>

                {/* 4) Kid Friendly - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Kid Friendly" 
                  icon={<Baby className="w-4 h-4" />}
                  testId="kid-friendly"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="kid-friendly" className="text-sm font-medium">Kid Friendly</Label>
                    <Switch 
                      id="kid-friendly"
                      checked={kidFriendly}
                      onCheckedChange={setKidFriendly}
                      data-testid="switch-kid-friendly"
                    />
                  </div>
                </CollapsibleFilterSection>

                {/* 5) Time / Difficulty - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Time / Difficulty" 
                  icon={<Timer className="w-4 h-4" />}
                  testId="time-difficulty"
                >
                  <RadioGroup value={timeDifficulty} onValueChange={setTimeDifficulty}>
                    {TIME_DIFFICULTY_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.value} id={`time-${opt.value}`} data-testid={`radio-time-${opt.value}`} />
                        <Label htmlFor={`time-${opt.value}`} className="text-sm cursor-pointer">
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CollapsibleFilterSection>

                {/* 6) Cost Preference - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Cost Preference" 
                  icon={<DollarSign className="w-4 h-4" />}
                  testId="cost-preference"
                >
                  <RadioGroup value={costPreference} onValueChange={setCostPreference}>
                    {COST_PREFERENCE_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.value} id={`cost-${opt.value}`} data-testid={`radio-cost-${opt.value}`} />
                        <Label htmlFor={`cost-${opt.value}`} className="text-sm cursor-pointer">
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CollapsibleFilterSection>

                {/* 7) Dietary Restrictions / Preferences - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Dietary Restrictions" 
                  icon={<Utensils className="w-4 h-4" />}
                  testId="dietary"
                >
                  <div className="space-y-2">
                    {DIETARY_RESTRICTIONS.map(diet => (
                      <div key={diet} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`diet-${diet}`}
                          checked={selectedDietary.includes(diet)}
                          onCheckedChange={() => toggleDietary(diet)}
                          data-testid={`checkbox-diet-${diet.toLowerCase()}`}
                        />
                        <Label htmlFor={`diet-${diet}`} className="text-sm cursor-pointer">
                          {diet}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleFilterSection>

                {/* 8) Allergies - collapsed by default */}
                <CollapsibleFilterSection 
                  title="Allergies" 
                  icon={<AlertTriangle className="w-4 h-4" />}
                  testId="allergies"
                >
                  <div className="space-y-2">
                    {ALLERGIES.map(allergy => (
                      <div key={allergy} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`allergy-${allergy}`}
                          checked={selectedAllergies.includes(allergy)}
                          onCheckedChange={() => toggleAllergy(allergy)}
                          data-testid={`checkbox-allergy-${allergy.toLowerCase()}`}
                        />
                        <Label htmlFor={`allergy-${allergy}`} className="text-sm cursor-pointer">
                          {allergy}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleFilterSection>
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
                className="overflow-hidden cursor-pointer relative shadow-[0_0_8px_rgba(0,0,0,0.35)] border-0 flex flex-col h-full"
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
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground -mt-1 -mb-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {recipe.cookTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {recipe.servings}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2">{recipe.title}</h3>
                  
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
                    <div className="flex flex-col gap-1.5">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-full text-[11px] gap-1 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold px-4" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/recipe/${recipe.id}`);
                        }}
                        data-testid={`button-add-plan-${recipe.id}`}
                      >
                        <Plus className="w-[12px] h-[12px]" /> Add to Plan
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-full text-[11px] gap-1 bg-green-600 hover:bg-green-600/90 text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold px-4" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/recipe/${recipe.id}`);
                        }}
                        data-testid={`button-add-cart-${recipe.id}`}
                      >
                        <ShoppingCart className="w-[12px] h-[12px]" /> Add to Cart
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
