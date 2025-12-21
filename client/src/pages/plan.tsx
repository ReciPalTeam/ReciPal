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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <ChefHat className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-display font-bold">No plan found</h2>
        <p className="text-muted-foreground max-w-md">You haven't generated a meal plan for this week yet. Let's create one tailored to your goals.</p>
        <Button size="lg" onClick={() => generatePlan()} disabled={isGenerating} className="shadow-lg shadow-primary/25">
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate Weekly Plan
        </Button>
      </div>
    );
  }

  // Assuming plan structure matches WeeklyPlanWithDays
  const days = plan.days || [];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Weekly Plan</h1>
          <p className="text-muted-foreground">
            Week of {format(parseISO(plan.weekStartDate), "MMM d, yyyy")}
          </p>
        </div>
        <Button variant="outline" onClick={() => generatePlan()} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Regenerate Week
        </Button>
      </div>

      <Tabs defaultValue="0" className="w-full" onValueChange={setActiveDay}>
        <div className="overflow-x-auto pb-4">
          <TabsList className="h-auto p-1 bg-transparent gap-2">
            {days.map((day: any, idx: number) => {
              const date = parseISO(day.date);
              const isToday = new Date().toISOString().split('T')[0] === day.date;
              const allMealsLocked = day.meals.length > 0 && day.meals.every((m: any) => m.locked);
              
              return (
                <TabsTrigger
                  key={day.id}
                  value={String(idx)}
                  data-testid={`tab-day-${idx}`}
                  className={clsx(
                    "flex flex-col items-center min-w-[80px] py-3 rounded-xl border-2 transition-all",
                    allMealsLocked
                      ? "bg-green-500 dark:bg-green-600 text-white border-green-500 dark:border-green-600"
                      : "border-transparent data-[state=active]:border-green-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground",
                    isToday && !allMealsLocked && "bg-accent/20"
                  )}
                >
                  <span className={clsx("text-xs uppercase mb-1", allMealsLocked ? "opacity-90" : "opacity-70")}>{format(date, "EEE")}</span>
                  <span className="text-xl font-bold font-display">{format(date, "d")}</span>
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
          <TabsContent key={day.id} value={String(idx)} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Stats Summary */}
              <Card className="lg:col-span-3 bg-primary text-primary-foreground border-none shadow-lg">
                <CardContent className="p-6 flex flex-wrap gap-8 items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold opacity-90">Daily Totals</h3>
                    <p className="text-sm opacity-75">{dayTotals.calories} kcal for the day</p>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <div className="text-2xl font-bold font-display">{dayTotals.protein}g</div>
                      <div className="text-xs opacity-70 uppercase tracking-wider">Protein</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-display">{dayTotals.carbs}g</div>
                      <div className="text-xs opacity-70 uppercase tracking-wider">Carbs</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-display">{dayTotals.fat}g</div>
                      <div className="text-xs opacity-70 uppercase tracking-wider">Fat</div>
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

                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg leading-tight">{meal.recipe.name}</CardTitle>
                    <CardDescription className="flex gap-2 text-xs">
                      <span>{meal.recipe.calories} kcal</span>
                      <span>•</span>
                      <span>{meal.recipe.prepTimeMinutes} min prep</span>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                     <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
                       <span><strong className="text-foreground">{meal.recipe.protein}g</strong> protein</span>
                       <span><strong className="text-foreground">{meal.recipe.carbs}g</strong> carbs</span>
                       <span><strong className="text-foreground">{meal.recipe.fat}g</strong> fat</span>
                     </div>
                     <div className="flex gap-2 flex-wrap mb-4">
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
