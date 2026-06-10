import { useState } from "react";
import { useCurrentPlan, useGeneratePlan, useRefreshMeal, useToggleMealLock, useFavoriteIds, useToggleFavorite } from "@/hooks/use-plans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Lock, Unlock, ChefHat, Sparkles, Calendar, Clock, UtensilsCrossed, Heart, Crown } from "lucide-react";
import { format, parseISO } from "date-fns";
import clsx from "clsx";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/use-profile";
import { useDemoStore } from "@/lib/demo-store";
import { useLocation } from "wouter";

function CalorieRing({ remaining, total, size = 140, strokeWidth = 10 }: { remaining: number; total: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const eaten = total - remaining;
  const progress = total > 0 ? Math.min(eaten / total, 1) : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#calorieGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(245, 158, 11)" />
            <stop offset="100%" stopColor="rgb(217, 119, 6)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-display leading-none" data-testid="text-remaining-cal">{Math.max(remaining, 0).toLocaleString()}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Remaining</span>
      </div>
    </div>
  );
}

function MacroBar({ label, consumed, target, color, trackColor }: { label: string; consumed: number; target: number; color: string; trackColor: string }) {
  const left = Math.max(target - consumed, 0);
  const progress = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-1 mb-1">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{left}g left</span>
      </div>
      <div className={`h-2 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// Helper to convert grams to ounces
function formatIngredient(amount: number, unit: string): string {
  if (unit === 'g' || unit === 'grams' || unit === 'gram') {
    const oz = (amount / 28.35).toFixed(1);
    return `${oz} oz`;
  }
  return `${amount} ${unit}`;
}

export default function WeeklyPlan() {
  const { data: plan, isLoading, error } = useCurrentPlan();
  const { mutate: generatePlan, isPending: isGenerating } = useGeneratePlan();
  const { mutate: refreshMeal, isPending: isRefreshing } = useRefreshMeal();
  const { mutate: toggleLock } = useToggleMealLock();
  const { data: favoriteIds = [] } = useFavoriteIds();
  const { mutate: toggleFavorite } = useToggleFavorite();
  const { data: profile } = useProfile();
  const { planner } = useDemoStore();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [activeDay, setActiveDay] = useState("0"); // index of day
  
  const isPro = profile?.subscriptionTier === 'pro';
  const macrosSet = isPro && profile?.macrosSet === true;
  
  const handleRegenerate = () => {
    generatePlan(undefined, {
      onSuccess: () => {
        toast({
          title: "Plan regenerated",
          description: "Your new meal plan has been created with fresh recipes.",
        });
      },
      onError: () => {
        toast({
          title: "Regeneration failed",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>;

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 sm:space-y-6 px-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <ChefHat className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold">No plan found</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md">You haven't generated a meal plan for this week yet. Let's create one tailored to your goals.</p>
        <Button size="default" className="sm:size-lg" onClick={handleRegenerate} disabled={isGenerating}>
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
        <Button variant="outline" size="sm" className="sm:size-default" onClick={handleRegenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Regenerate Week
        </Button>
      </div>

      {/* Calorie & Macro Counter Card */}
      {plan && (() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todayDay = days.find((d: any) => d.date === todayStr);
        const todayMeals = todayDay?.meals || [];
        
        const cookedSlots = new Set(
          planner
            .filter(p => p.date === todayStr && (p.mealState === 'cooked' || p.mealState === 'autoCounted'))
            .map(p => `${p.date}|${p.mealType}|${p.recipeId}`)
        );
        
        const totalPlanned = todayMeals.reduce((acc: number, meal: any) => {
          const mult = meal.servingMultiplier || 1;
          return acc + Math.round((meal.recipe?.calories || 0) * mult);
        }, 0);
        
        const eaten = todayMeals.reduce((acc: { calories: number; protein: number; carbs: number; fat: number }, meal: any) => {
          const key = `${todayStr}|${meal.mealType}|${String(meal.recipe?.id)}`;
          if (!cookedSlots.has(key)) return acc;
          const mult = meal.servingMultiplier || 1;
          return {
            calories: acc.calories + Math.round((meal.recipe?.calories || 0) * mult),
            protein: acc.protein + Math.round((meal.recipe?.protein || 0) * mult),
            carbs: acc.carbs + Math.round((meal.recipe?.carbs || 0) * mult),
            fat: acc.fat + Math.round((meal.recipe?.fat || 0) * mult),
          };
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const goalCalories = isPro && profile?.targetCalories ? profile.targetCalories : totalPlanned;
        const goalProtein = isPro && profile?.targetProtein ? profile.targetProtein : 0;
        const goalCarbs = isPro && profile?.targetCarbs ? profile.targetCarbs : 0;
        const goalFat = isPro && profile?.targetFat ? profile.targetFat : 0;
        const remaining = goalCalories - eaten.calories;

        return (
          <Card 
            className="border-0 overflow-visible" 
            style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)' }}
            data-testid="card-calorie-counter"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-4 sm:gap-6">
                <CalorieRing remaining={remaining} total={goalCalories} />
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium" data-testid="text-daily-goal-label">
                      {isPro ? 'Daily Goal' : "Today's Plan"}
                    </p>
                    <p className="text-lg font-bold font-display" data-testid="text-daily-goal-value">
                      {goalCalories.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">cal</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2 text-center">
                      <p className="text-base sm:text-lg font-bold font-display text-green-700 dark:text-green-400" data-testid="text-eaten-cal">{eaten.calories.toLocaleString()}</p>
                      <p className="text-[10px] uppercase tracking-wider text-green-600/70 dark:text-green-400/70 font-medium">Eaten</p>
                    </div>
                    <div className="flex-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 text-center">
                      <p className="text-base sm:text-lg font-bold font-display text-amber-700 dark:text-amber-400" data-testid="text-left-cal">{Math.max(remaining, 0).toLocaleString()}</p>
                      <p className="text-[10px] uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 font-medium">Left</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t mt-4 pt-3 relative">
                {isPro && macrosSet ? (
                  <div className="flex gap-4">
                    <MacroBar label="Protein" consumed={eaten.protein} target={goalProtein} color="bg-orange-500" trackColor="bg-orange-100 dark:bg-orange-950/30" />
                    <MacroBar label="Carbs" consumed={eaten.carbs} target={goalCarbs} color="bg-green-400" trackColor="bg-green-100 dark:bg-green-950/30" />
                    <MacroBar label="Fat" consumed={eaten.fat} target={goalFat} color="bg-[#1e3a5f]" trackColor="bg-slate-200 dark:bg-slate-800" />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex gap-4 blur-[3px] opacity-50 pointer-events-none select-none">
                      <MacroBar label="Protein" consumed={0} target={100} color="bg-orange-500" trackColor="bg-orange-100" />
                      <MacroBar label="Carbs" consumed={0} target={100} color="bg-green-400" trackColor="bg-green-100" />
                      <MacroBar label="Fat" consumed={0} target={100} color="bg-[#1e3a5f]" trackColor="bg-slate-200" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button
                        size="sm"
                        className="bg-recipal-orange hover:bg-recipal-orange/90 text-white text-[11px] font-semibold rounded-full"
                        onClick={() => setLocation("/settings")}
                        data-testid="button-join-pro-macros"
                      >
                        <Crown className="w-3 h-3 mr-1" /> Join Pro
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Tabs value={activeDay} className="w-full" onValueChange={setActiveDay}>
        {/* Mobile: Dropdown selector */}
        {isMobile ? (
          <div className="mb-4">
            <Select value={activeDay} onValueChange={setActiveDay}>
              <SelectTrigger className="w-full" data-testid="select-day-mobile">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <SelectValue placeholder="Select day" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {days.map((day: any, idx: number) => {
                  const date = parseISO(day.date);
                  const allMealsLocked = day.meals && day.meals.length > 0 && day.meals.every((m: any) => m.locked);
                  return (
                    <SelectItem key={day.id} value={String(idx)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{format(date, "EEEE, MMM d")}</span>
                        {allMealsLocked && <Lock className="w-3 h-3 text-green-500" />}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ) : (
          /* Desktop: Tab buttons */
          <div className="pb-4">
            <TabsList className="h-auto p-1 bg-transparent gap-2">
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
                      "flex flex-col items-center min-w-[80px] py-3 rounded-xl border-2 transition-all",
                      allMealsLocked
                        ? "bg-green-500 dark:bg-green-600 text-white border-green-500 dark:border-green-600"
                        : isActive
                          ? "border-green-500 bg-transparent"
                          : "border-transparent bg-transparent"
                    )}
                  >
                    <span className={clsx("text-xs uppercase mb-1", allMealsLocked ? "opacity-90" : "opacity-70")}>{format(date, "EEE")}</span>
                    <span className="text-xl font-bold font-display">{format(date, "d")}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        )}

        {days.map((day: any, idx: number) => {
          const dayTotals = day.meals.reduce((acc: any, meal: any) => {
            const mult = meal.servingMultiplier || 1;
            return {
              calories: acc.calories + Math.round((meal.recipe?.calories || 0) * mult),
              protein: acc.protein + Math.round((meal.recipe?.protein || 0) * mult),
              carbs: acc.carbs + Math.round((meal.recipe?.carbs || 0) * mult),
              fat: acc.fat + Math.round((meal.recipe?.fat || 0) * mult),
            };
          }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

          return (
          <TabsContent key={day.id} value={String(idx)} className="space-y-3 sm:space-y-4 mt-2 sm:mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {/* Daily Stats Summary */}
              <Card className="sm:col-span-2 lg:col-span-3 bg-primary border-none shadow-lg">
                <CardContent className="p-4 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold text-white">Daily Totals</h3>
                    <p className="text-sm sm:text-base text-white/80 font-medium">{dayTotals.calories} kcal</p>
                  </div>
                  <div className="flex gap-4 sm:gap-6 text-center text-white border-t border-white/20 pt-3">
                    <div>
                      <div className="text-lg sm:text-2xl font-bold font-display">{dayTotals.protein}g</div>
                      <div className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wider">Protein</div>
                    </div>
                    <div>
                      <div className="text-lg sm:text-2xl font-bold font-display">{dayTotals.carbs}g</div>
                      <div className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wider">Carbs</div>
                    </div>
                    <div>
                      <div className="text-lg sm:text-2xl font-bold font-display">{dayTotals.fat}g</div>
                      <div className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wider">Fat</div>
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
                    {/* Green overlay for locked meals */}
                    {meal.locked && (
                      <div className="absolute inset-0 bg-green-500/50 pointer-events-none" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
                      <span className="text-white text-xs font-bold uppercase tracking-wider bg-black/30 backdrop-blur-md px-2 py-1 rounded-md">
                        {meal.mealType}
                      </span>
                    </div>
                  </div>

                  <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                    <CardTitle className="text-base sm:text-lg leading-tight">
                      {meal.recipe.name}
                      {meal.servingMultiplier && meal.servingMultiplier > 1 && (
                        <span className="ml-2 text-xs font-normal text-primary">({meal.servingMultiplier}x)</span>
                      )}
                    </CardTitle>
                    <CardDescription className="flex gap-2 text-xs">
                      <span>{Math.round(meal.recipe.calories * (meal.servingMultiplier || 1))} kcal</span>
                      <span>•</span>
                      <span>{meal.recipe.prepTimeMinutes} min prep</span>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="p-3 sm:p-6 pt-0">
                     {/* Prep Time */}
                     <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                       <Clock className="w-3.5 h-3.5" />
                       <span>{meal.recipe.prepTimeMinutes} min prep time</span>
                     </div>

                     {/* Macros (scaled by serving multiplier) */}
                     <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 text-xs text-muted-foreground">
                       <span><strong className="text-foreground">{Math.round(meal.recipe.protein * (meal.servingMultiplier || 1))}g</strong> protein</span>
                       <span><strong className="text-foreground">{Math.round(meal.recipe.carbs * (meal.servingMultiplier || 1))}g</strong> carbs</span>
                       <span><strong className="text-foreground">{Math.round(meal.recipe.fat * (meal.servingMultiplier || 1))}g</strong> fat</span>
                     </div>

                     {/* Ingredients List */}
                     <div className="mb-3">
                       <div className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2">
                         <UtensilsCrossed className="w-3.5 h-3.5" />
                         <span>Ingredients</span>
                       </div>
                       <ul className="text-xs text-muted-foreground space-y-1 max-h-28 overflow-y-auto">
                         {meal.recipe.ingredients?.slice(0, 6).map((ing: { name: string; amount: number; unit: string }, i: number) => (
                           <li key={i} className="flex gap-1">
                             <span className="text-foreground font-medium whitespace-nowrap">{formatIngredient(ing.amount * (meal.servingMultiplier || 1), ing.unit)}</span>
                             <span>{ing.name}</span>
                           </li>
                         ))}
                         {meal.recipe.ingredients?.length > 6 && (
                           <li className="text-muted-foreground/70 italic">+{meal.recipe.ingredients.length - 6} more</li>
                         )}
                       </ul>
                     </div>

                     {/* Tags */}
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
                         className="shrink-0"
                         data-testid={`button-favorite-${meal.recipe.id}`}
                         onClick={() => {
                           const isFav = favoriteIds.includes(meal.recipe.id);
                           toggleFavorite({ recipeId: meal.recipe.id, isFavorite: isFav }, {
                             onSuccess: () => {
                               toast({
                                 title: isFav ? "Removed from favorites" : "Added to favorites",
                                 description: isFav ? `${meal.recipe.name} removed from your favorites.` : `${meal.recipe.name} saved to your favorites.`,
                               });
                             },
                           });
                         }}
                       >
                         <Heart className={clsx("w-4 h-4", favoriteIds.includes(meal.recipe.id) ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
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
