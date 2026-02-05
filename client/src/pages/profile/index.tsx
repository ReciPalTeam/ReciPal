import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Zap, Settings, TrendingUp, Target, User, Sliders, Calendar, Sparkles, Brain, BarChart3, Gauge, AlertTriangle, Lightbulb, ClipboardList, ChevronDown, ChevronUp, Check, Minus } from "lucide-react";
import { useLocation } from "wouter";
import { useDemoStore, PlannedMeal } from "@/lib/demo-store";
import { mockRecipes } from "@/lib/mock-data";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import { 
  computeTotalsFromConsumptionLogs, 
  computeMealNutritionSnapshot,
  ConsumptionLogInput,
  RecipeLookup 
} from "@/lib/planner-totals";

interface DailyChartEntry {
  date: string;
  dayLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  target: number;
  mealsLogged: number;
}

interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface InsightItem {
  text: string;
  type: 'positive' | 'neutral' | 'warning';
}

interface InsightsResult {
  consistency: InsightItem[];
  patternDetection: InsightItem[];
  paceProjections: InsightItem[];
  nutritionalGaps: InsightItem[];
  behavioralNudges: InsightItem[];
  weeklySnapshot: {
    avgCalories: number;
    calorieTarget: number;
    calorieDelta: number;
    bestDay: string | null;
    worstDay: string | null;
    topFoods: string[];
    adherencePercent: number;
    dailyData: DailyChartEntry[];
  } | null;
}

interface InsightCategoryProps {
  title: string;
  icon: React.ReactNode;
  items: InsightItem[];
  categoryKey: string;
}

function InsightCategory({ title, icon, items, categoryKey }: InsightCategoryProps) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) {
    return (
      <Card data-testid={`card-insight-${categoryKey}`} className="border-0 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {icon} {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground" data-testid={`text-insight-${categoryKey}-empty`}>Not enough data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={`card-insight-${categoryKey}`} className="border-0 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06)]">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)} data-testid={`button-toggle-${categoryKey}`}>
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">{icon} {title}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 text-xs p-2 rounded-md ${
                item.type === 'positive' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400' :
                item.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' :
                'bg-muted/50 text-muted-foreground'
              }`}
              data-testid={`text-insight-${categoryKey}-${idx}`}
            >
              <span className="mt-0.5 flex-shrink-0 w-3 h-3">
                {item.type === 'positive' ? <Check className="w-3 h-3" /> : item.type === 'warning' ? <AlertTriangle className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              </span>
              <span>{item.text}</span>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
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
  
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const recipeLookup: RecipeLookup = useMemo(() => {
    const lookup: RecipeLookup = {};
    mockRecipes.forEach(r => {
      lookup[r.id] = r;
    });
    return lookup;
  }, []);

  const { data: consumptionLogs = [] } = useQuery<ConsumptionLogInput[]>({
    queryKey: ['/api/consumption-logs', weekStartStr, weekEndStr],
    enabled: isPro,
  });

  const { data: insights } = useQuery<InsightsResult>({
    queryKey: ['/api/insights'],
    enabled: isPro && macrosSet,
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

  const todayConsumed = useMemo(() => getConsumedTotalsForDay(todayStr), [todayStr, planner, consumptionLogs, recipeLookup]);

  const targets = {
    daily: {
      calories: profile?.targetCalories || 2000,
      protein: profile?.targetProtein || 150,
      carbs: profile?.targetCarbs || 250,
      fat: profile?.targetFat || 65,
    },
  };

  const calcProgress = (consumed: number, target: number) => Math.min(Math.round((consumed / target) * 100), 100);

  const handleOpenMacroWizard = () => {
    setLocation("/macro-wizard");
  };

  if (isPro) {
    const snapshot = insights?.weeklySnapshot;

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
                className="w-full bg-recipal-orange"
                data-testid="button-setup-macros"
              >
                Set up my macros
              </Button>
            </CardContent>
          </Card>
        )}

        {macrosSet && (
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="w-full justify-center bg-recipal-orange text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={handleOpenMacroWizard}
              data-testid="button-macros-set-edit"
            >
              <Target className="w-4 h-4 mr-1.5" />
              Macros: Set / Edit
            </Button>
            <Button 
              className="w-full justify-center bg-green-600 text-white font-bold rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)] border-t border-white/20"
              onClick={() => setLocation("/preferences")}
              data-testid="button-edit-preferences"
            >
              <Sliders className="w-4 h-4 mr-1.5" />
              Edit Preferences
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

        {macrosSet && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Brain className="w-5 h-5 text-recipal-orange" />
              <h3 className="font-bold text-base" data-testid="text-insights-heading">Insights</h3>
            </div>

            {snapshot && (
              <Card data-testid="card-insight-weekly-snapshot" className="border-0 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-recipal-deep-green" /> Weekly Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="w-full h-[180px]" data-testid="chart-weekly-calories">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={snapshot.dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                          formatter={(value: number, name: string) => {
                            if (name === 'calories') return [`${value} cal`, 'Calories'];
                            return [value, name];
                          }}
                          labelFormatter={(label: string) => label}
                        />
                        <ReferenceLine y={snapshot.calorieTarget} stroke="hsl(var(--destructive))" strokeDasharray="5 5" strokeWidth={1.5} label={{ value: `Goal: ${snapshot.calorieTarget}`, position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                        <Bar dataKey="calories" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          {snapshot.dailyData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.mealsLogged === 0 ? 'hsl(var(--muted))' : entry.calories <= snapshot.calorieTarget * 1.05 ? 'hsl(142 71% 45%)' : 'hsl(38 92% 50%)'}
                              opacity={entry.mealsLogged === 0 ? 0.3 : 0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Avg Calories</p>
                      <p className="text-lg font-bold" data-testid="text-snapshot-avg-cal">{snapshot.avgCalories}</p>
                      <p className={`text-[10px] font-medium ${snapshot.calorieDelta > 0 ? 'text-amber-600' : 'text-green-600'}`} data-testid="text-snapshot-cal-delta">
                        {snapshot.calorieDelta > 0 ? '+' : ''}{snapshot.calorieDelta} vs goal
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Adherence</p>
                      <p className="text-lg font-bold" data-testid="text-snapshot-adherence">{snapshot.adherencePercent}%</p>
                      <p className="text-[10px] text-muted-foreground">of days on target</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {snapshot.bestDay && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Best Day</p>
                        <p className="text-sm font-medium text-green-600" data-testid="text-snapshot-best-day">{snapshot.bestDay}</p>
                      </div>
                    )}
                    {snapshot.worstDay && (
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Needs Work</p>
                        <p className="text-sm font-medium text-amber-600" data-testid="text-snapshot-worst-day">{snapshot.worstDay}</p>
                      </div>
                    )}
                  </div>
                  {snapshot.topFoods.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Top Foods</p>
                      <div className="flex flex-wrap gap-1">
                        {snapshot.topFoods.map((food, idx) => (
                          <span key={idx} className="text-[10px] bg-muted px-2 py-0.5 rounded-md" data-testid={`text-snapshot-food-${idx}`}>{food}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <InsightCategory
              title="Consistency"
              icon={<BarChart3 className="w-4 h-4 text-recipal-orange" />}
              items={insights?.consistency || []}
              categoryKey="consistency"
            />

            <InsightCategory
              title="Pace & Projections"
              icon={<Gauge className="w-4 h-4 text-recipal-deep-green" />}
              items={insights?.paceProjections || []}
              categoryKey="pace"
            />

            <InsightCategory
              title="Behavioral Nudges"
              icon={<Lightbulb className="w-4 h-4 text-yellow-500" />}
              items={insights?.behavioralNudges || []}
              categoryKey="nudges"
            />

            <InsightCategory
              title="Pattern Detection"
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
              items={insights?.patternDetection || []}
              categoryKey="patterns"
            />

            <InsightCategory
              title="Nutritional Gaps"
              icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
              items={insights?.nutritionalGaps || []}
              categoryKey="gaps"
            />
          </>
        )}

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
            className="w-full bg-recipal-orange font-bold" 
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
