import { useState } from "react";
import { useCurrentPlan, useGeneratePlan, useRefreshMeal, useToggleMealLock } from "@/hooks/use-plans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Lock, Unlock, ChefHat, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import clsx from "clsx";

export default function WeeklyPlan() {
  const { data: plan, isLoading, error } = useCurrentPlan();
  const { mutate: generatePlan, isPending: isGenerating } = useGeneratePlan();
  const { mutate: refreshMeal, isPending: isRefreshing } = useRefreshMeal();
  const { mutate: toggleLock } = useToggleMealLock();
  
  const [activeDay, setActiveDay] = useState("0"); // index of day

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>;

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 sm:space-y-6 px-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <ChefHat className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold">No plan found</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md">You haven't generated a meal plan for this week yet. Let's create one tailored to your goals.</p>
        <Button size="default" className="sm:size-lg shadow-lg shadow-primary/25" onClick={() => generatePlan()} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate Weekly Plan
        </Button>
      </div>
    );
  }

  // Assuming plan structure matches WeeklyPlanWithDays
  const days = plan.days || [];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Weekly Plan</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Week of {format(parseISO(plan.weekStartDate), "MMM d, yyyy")}
          </p>
        </div>
        <Button variant="outline" size="sm" className="sm:size-default" onClick={() => generatePlan()} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Regenerate Week
        </Button>
      </div>

      <Tabs defaultValue="0" className="w-full" onValueChange={setActiveDay}>
        <div className="overflow-x-auto pb-2 sm:pb-4 -mx-1 px-1">
          <TabsList className="h-auto p-1 bg-transparent gap-1 sm:gap-2">
            {days.map((day: any, idx: number) => {
              const date = parseISO(day.date);
              const isActive = activeDay === String(idx);
              const allMealsLocked = day.meals && day.meals.length > 0 && day.meals.every((m: any) => m.locked);
              
              return (
                <TabsTrigger
                  key={day.id}
                  value={String(idx)}
                  data-testid={`tab-day-${idx}`}
                  className={clsx(
                    "flex flex-col items-center min-w-[56px] sm:min-w-[80px] py-2 sm:py-3 rounded-xl border-2 transition-all",
                    allMealsLocked
                      ? "bg-green-500 dark:bg-green-600 text-white border-green-500 dark:border-green-600"
                      : isActive
                        ? "border-green-500 bg-transparent"
                        : "border-transparent bg-transparent"
                  )}
                >
                  <span className={clsx("text-[10px] sm:text-xs uppercase mb-0.5 sm:mb-1", allMealsLocked ? "opacity-90" : "opacity-70")}>{format(date, "EEE")}</span>
                  <span className="text-lg sm:text-xl font-bold font-display">{format(date, "d")}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {days.map((day: any, idx: number) => {
          const dayTotals = day.meals.reduce((acc: any, meal: any) => ({
            calories: acc.calories + (meal.recipe?.calories || 0),
            protein: acc.protein + (meal.recipe?.protein || 0),
            carbs: acc.carbs + (meal.recipe?.carbs || 0),
            fat: acc.fat + (meal.recipe?.fat || 0),
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

          return (
          <TabsContent key={day.id} value={String(idx)} className="space-y-3 sm:space-y-4 mt-2 sm:mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {/* Daily Stats Summary */}
              <Card className="sm:col-span-2 lg:col-span-3 bg-primary text-primary-foreground border-none shadow-lg">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-8 items-start sm:items-center justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold opacity-90">Daily Totals</h3>
                    <p className="text-xs sm:text-sm opacity-75">{dayTotals.calories} kcal for the day</p>
                  </div>
                  <div className="flex gap-4 sm:gap-6 text-center">
                    <div>
                      <div className="text-lg sm:text-2xl font-bold font-display">{dayTotals.protein}g</div>
                      <div className="text-[10px] sm:text-xs opacity-70 uppercase tracking-wider">Protein</div>
                    </div>
                    <div>
                      <div className="text-lg sm:text-2xl font-bold font-display">{dayTotals.carbs}g</div>
                      <div className="text-[10px] sm:text-xs opacity-70 uppercase tracking-wider">Carbs</div>
                    </div>
                    <div>
                      <div className="text-lg sm:text-2xl font-bold font-display">{dayTotals.fat}g</div>
                      <div className="text-[10px] sm:text-xs opacity-70 uppercase tracking-wider">Fat</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Meal Cards */}
              {day.meals.map((meal: any) => (
                <Card key={meal.id} className="group hover:border-primary/50 transition-all duration-300 relative overflow-hidden">
                  {meal.locked && (
                    <div className="absolute top-0 right-0 p-2 z-10">
                       <div className="bg-primary/10 text-primary p-1.5 rounded-full">
                         <Lock className="w-3 h-3" />
                       </div>
                    </div>
                  )}
                  
                  <div className="aspect-video w-full bg-secondary relative overflow-hidden">
                    {/* Placeholder for image - use meal.recipe.imageUrl if exists */}
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      {meal.recipe.imageUrl ? (
                         <img src={meal.recipe.imageUrl} alt={meal.recipe.name} className="w-full h-full object-cover" />
                      ) : (
                         <ChefHat className="w-12 h-12 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
                      <span className="text-white text-xs font-bold uppercase tracking-wider bg-black/30 backdrop-blur-md px-2 py-1 rounded-md">
                        {meal.mealType}
                      </span>
                    </div>
                  </div>

                  <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                    <CardTitle className="text-base sm:text-lg leading-tight">{meal.recipe.name}</CardTitle>
                    <CardDescription className="flex gap-2 text-xs">
                      <span>{meal.recipe.calories} kcal</span>
                      <span>•</span>
                      <span>{meal.recipe.prepTimeMinutes} min prep</span>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="p-3 sm:p-6 pt-0">
                     <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 sm:mb-3 text-xs text-muted-foreground">
                       <span><strong className="text-foreground">{meal.recipe.protein}g</strong> protein</span>
                       <span><strong className="text-foreground">{meal.recipe.carbs}g</strong> carbs</span>
                       <span><strong className="text-foreground">{meal.recipe.fat}g</strong> fat</span>
                     </div>
                     <div className="flex gap-1.5 sm:gap-2 flex-wrap mb-3 sm:mb-4">
                       {meal.recipe.tags.slice(0, 3).map((tag: string) => (
                         <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0.5">{tag}</Badge>
                       ))}
                     </div>

                     <div className="flex gap-2">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="flex-1"
                         onClick={() => refreshMeal(meal.id)}
                         disabled={meal.locked || isRefreshing}
                       >
                         <RefreshCw className={clsx("w-3 h-3 mr-2", isRefreshing && "animate-spin")} />
                         Swap
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className={clsx("shrink-0", meal.locked && "text-primary bg-primary/10")}
                         onClick={() => toggleLock({ id: meal.id, locked: !meal.locked })}
                       >
                         {meal.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                       </Button>
                     </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        );
        })}
      </Tabs>
    </div>
  );
}
