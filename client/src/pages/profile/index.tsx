import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Zap, Settings, TrendingUp, PieChart, Target, User, ChevronRight, Sliders, Calendar, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useDemoStore, PlannedMeal } from "@/lib/demo-store";
import { mockRecipes } from "@/lib/mock-data";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isWithinInterval, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { 
  computeTotalsFromConsumptionLogs, 
  computeMealNutritionSnapshot,
  ConsumptionLogInput,
  RecipeLookup 
} from "@/lib/planner-totals";

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function ProfilePage() {
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const [, setLocation] = useLocation();
  const { planner } = useDemoStore();

  const isPro = profile?.subscriptionTier === 'pro';
  const macrosSet = profile?.macrosSet === true;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

  const recipeLookup: RecipeLookup = useMemo(() => {
    const lookup: RecipeLookup = {};
    mockRecipes.forEach(r => {
      lookup[r.id] = r;
    });
    return lookup;
  }, []);

  const { data: consumptionLogs = [] } = useQuery<ConsumptionLogInput[]>({
    queryKey: ['/api/consumption-logs', monthStartStr, monthEndStr],
    enabled: isPro,
  });

  const getMealDate = (meal: PlannedMeal): string | null => {
    if (meal.date) return meal.date;
    const mealDateFromIndex = addDays(weekStart, meal.dayIndex);
    return format(mealDateFromIndex, 'yyyy-MM-dd');
  };

  const getConsumedTotalsForDay = (dayStr: string): MacroTotals => {
    const dayLogs = consumptionLogs.filter(log => log.date === dayStr);
    const logTotals = computeTotalsFromConsumptionLogs(dayLogs);
    
    const countedMeals = planner.filter(m => {
      if (m.mealState !== 'cooked' && m.mealState !== 'autoCounted') return false;
      const mealDateStr = getMealDate(m);
      return mealDateStr === dayStr;
    });
    
    let mealTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    countedMeals.forEach(meal => {
      const recipe = recipeLookup[meal.recipeId];
      const nutrition = computeMealNutritionSnapshot(meal, recipe);
      mealTotals.calories += nutrition.calories;
      mealTotals.protein += nutrition.protein;
      mealTotals.carbs += nutrition.carbs;
      mealTotals.fat += nutrition.fat;
    });
    
    return {
      calories: Math.round(logTotals.calories + mealTotals.calories),
      protein: Math.round(logTotals.protein + mealTotals.protein),
      carbs: Math.round(logTotals.carbs + mealTotals.carbs),
      fat: Math.round(logTotals.fat + mealTotals.fat),
    };
  };

  const getConsumedTotalsForRange = (startStr: string, endStr: string): MacroTotals => {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    let current = start;
    while (current <= end) {
      const dayStr = format(current, 'yyyy-MM-dd');
      const dayTotals = getConsumedTotalsForDay(dayStr);
      totals.calories += dayTotals.calories;
      totals.protein += dayTotals.protein;
      totals.carbs += dayTotals.carbs;
      totals.fat += dayTotals.fat;
      current = addDays(current, 1);
    }
    
    return totals;
  };

  const todayConsumed = useMemo(() => getConsumedTotalsForDay(todayStr), [todayStr, planner, consumptionLogs, recipeLookup]);
  const weekConsumed = useMemo(() => getConsumedTotalsForRange(weekStartStr, weekEndStr), [weekStartStr, weekEndStr, planner, consumptionLogs, recipeLookup]);
  
  const daysInMonth = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysSoFarInMonth = Math.ceil((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const monthConsumed = useMemo(() => getConsumedTotalsForRange(monthStartStr, todayStr), [monthStartStr, todayStr, planner, consumptionLogs, recipeLookup]);

  const targets = {
    daily: {
      calories: profile?.targetCalories || 2000,
      protein: profile?.targetProtein || 150,
      carbs: profile?.targetCarbs || 250,
      fat: profile?.targetFat || 65,
    },
    weekly: {
      calories: (profile?.targetCalories || 2000) * 7,
      protein: (profile?.targetProtein || 150) * 7,
      carbs: (profile?.targetCarbs || 250) * 7,
      fat: (profile?.targetFat || 65) * 7,
    },
    monthly: {
      calories: (profile?.targetCalories || 2000) * daysSoFarInMonth,
      protein: (profile?.targetProtein || 150) * daysSoFarInMonth,
      carbs: (profile?.targetCarbs || 250) * daysSoFarInMonth,
      fat: (profile?.targetFat || 65) * daysSoFarInMonth,
    }
  };

  const calcProgress = (consumed: number, target: number) => Math.min(Math.round((consumed / target) * 100), 100);
  
  const avgDailyCalories = daysSoFarInMonth > 0 ? Math.round(monthConsumed.calories / daysSoFarInMonth) : 0;
  const avgDailyProtein = daysSoFarInMonth > 0 ? Math.round(monthConsumed.protein / daysSoFarInMonth) : 0;
  const proteinTrend = avgDailyProtein >= (targets.daily.protein * 0.9) ? "On track" : "Below target";

  const handleOpenMacroWizard = () => {
    setLocation("/macro-wizard");
  };

  if (isPro) {
    return (
      <div className="p-4 space-y-4 pb-24 overflow-y-auto">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-recipal-deep-green flex items-center justify-center text-white font-bold text-xl">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="font-bold text-lg">Hello, {user?.username?.split('@')[0] || 'User'}</h2>
              <span className="text-[10px] bg-recipal-orange/10 text-recipal-orange px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Pro Member</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} data-testid="button-settings">
            <Settings className="w-5 h-5" />
          </Button>
        </header>

        {!macrosSet && (
          <Card className="bg-recipal-orange/10 border-recipal-orange/30">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-recipal-orange flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Macros: Not set</p>
                  <p className="text-xs text-muted-foreground">Unlock optimized planning and tracking</p>
                </div>
              </div>
              <Button
                onClick={handleOpenMacroWizard}
                className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
                data-testid="button-setup-macros"
              >
                Set up my macros
              </Button>
            </CardContent>
          </Card>
        )}

        {macrosSet && (
          <div className="flex flex-wrap gap-2">
            <Button 
              className="flex-1 justify-between bg-recipal-orange text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={handleOpenMacroWizard}
              data-testid="button-macros-set-edit"
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Macros: Set / Edit</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button 
              className="flex-1 justify-between bg-green-600 text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={() => setLocation("/preferences")}
              data-testid="button-edit-preferences"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <span>Edit Preferences</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        <Card data-testid="card-today-dashboard" className="border-0 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-recipal-orange" /> Today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Calories</span>
                <span data-testid="text-today-cal">{todayConsumed.calories} / {targets.daily.calories}</span>
              </div>
              <Progress value={calcProgress(todayConsumed.calories, targets.daily.calories)} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-recipal-orange">Protein</span>
                <span data-testid="text-today-protein">{todayConsumed.protein}g / {targets.daily.protein}g</span>
              </div>
              <Progress value={calcProgress(todayConsumed.protein, targets.daily.protein)} className="h-2 bg-orange-100 [&>div]:bg-recipal-orange" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-primary">Carbs</span>
                <span data-testid="text-today-carbs">{todayConsumed.carbs}g / {targets.daily.carbs}g</span>
              </div>
              <Progress value={calcProgress(todayConsumed.carbs, targets.daily.carbs)} className="h-2 bg-green-100 [&>div]:bg-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-blue-800 dark:text-blue-300">Fat</span>
                <span data-testid="text-today-fat">{todayConsumed.fat}g / {targets.daily.fat}g</span>
              </div>
              <Progress value={calcProgress(todayConsumed.fat, targets.daily.fat)} className="h-2 bg-blue-100 [&>div]:bg-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-week-dashboard" className="border-0 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Calories</span>
                <span data-testid="text-week-cal">{weekConsumed.calories} / {targets.weekly.calories}</span>
              </div>
              <Progress value={calcProgress(weekConsumed.calories, targets.weekly.calories)} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-recipal-orange">P</span>
                <span data-testid="text-week-protein">{weekConsumed.protein}g / {targets.weekly.protein}g</span>
              </div>
              <Progress value={calcProgress(weekConsumed.protein, targets.weekly.protein)} className="h-2 bg-orange-100 [&>div]:bg-recipal-orange" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-primary">C</span>
                <span data-testid="text-week-carbs">{weekConsumed.carbs}g / {targets.weekly.carbs}g</span>
              </div>
              <Progress value={calcProgress(weekConsumed.carbs, targets.weekly.carbs)} className="h-2 bg-green-100 [&>div]:bg-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-blue-800 dark:text-blue-300">F</span>
                <span data-testid="text-week-fat">{weekConsumed.fat}g / {targets.weekly.fat}g</span>
              </div>
              <Progress value={calcProgress(weekConsumed.fat, targets.weekly.fat)} className="h-2 bg-blue-100 [&>div]:bg-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-month-dashboard" className="border-0 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-recipal-deep-green" /> This Month ({format(today, 'MMMM')})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Calories</span>
                <span data-testid="text-month-cal">{monthConsumed.calories} / {targets.monthly.calories}</span>
              </div>
              <Progress value={calcProgress(monthConsumed.calories, targets.monthly.calories)} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">P</p>
                <p className="text-sm font-medium text-recipal-orange" data-testid="text-month-protein">{monthConsumed.protein}g</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">C</p>
                <p className="text-sm font-medium text-primary" data-testid="text-month-carbs">{monthConsumed.carbs}g</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">F</p>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300" data-testid="text-month-fat">{monthConsumed.fat}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-trends" className="border-0 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-recipal-orange" /> Trends Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-muted-foreground">Avg calories/day</span>
              <span className="text-sm font-medium" data-testid="text-trend-avg-cal">{avgDailyCalories} cal</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-muted-foreground">Avg protein/day</span>
              <span className="text-sm font-medium" data-testid="text-trend-avg-protein">{avgDailyProtein}g</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-muted-foreground">Protein trend</span>
              <span className={`text-sm font-medium ${proteinTrend === "On track" ? "text-green-600" : "text-amber-600"}`} data-testid="text-trend-protein">
                {proteinTrend}
              </span>
            </div>
          </CardContent>
        </Card>

      </div>
    );
  }

  return (
    <div className="p-4 space-y-8 flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <User className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-recipal-deep-green" data-testid="text-username">{user?.username?.split('@')[0] || 'User'}</h2>
        <p className="text-muted-foreground text-sm">Free Account</p>
      </div>
      
      <Card className="bg-recipal-orange/5 border-recipal-orange/20 w-full max-w-xs">
        <CardContent className="pt-6 space-y-4">
          <div className="h-12 w-12 bg-recipal-orange/20 rounded-2xl flex items-center justify-center mx-auto">
            <Zap className="text-recipal-orange" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold">Upgrade to Pro</h3>
            <p className="text-xs text-muted-foreground">Unlock macro tracking, personalized meal plans, and more.</p>
          </div>
          <Button 
            className="w-full bg-recipal-orange hover:bg-recipal-orange/90 font-bold" 
            onClick={() => setLocation("/paywall")}
            data-testid="button-upgrade"
          >
            View Pro Plans
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="ghost" className="text-muted-foreground" onClick={() => setLocation("/preferences")} data-testid="button-edit-preferences-free">
          Edit Preferences
        </Button>
        <Button variant="ghost" className="text-muted-foreground" onClick={() => setLocation("/settings")} data-testid="button-account-settings">
          Settings
        </Button>
      </div>
    </div>
  );
}
