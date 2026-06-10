import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalorieCounterCard } from "@/components/calorie-counter-card";
import { useUser } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useChefMe } from "@/hooks/use-chef";
import { FollowingSheet } from "@/components/following-sheet";
import { Zap, Settings, TrendingUp, Target, User, Sliders, Calendar, Sparkles, Brain, BarChart3, Gauge, AlertTriangle, Lightbulb, ClipboardList, ChevronDown, ChevronUp, ChevronRight, Check, Minus, Trophy, TrendingDown, Utensils } from "lucide-react";
import { useLocation } from "wouter";
import { useDemoStore, PlannedMeal } from "@/lib/demo-store";
import { mockRecipes } from "@/lib/mock-data";
import { useRecipeStore } from "@/lib/recipe-store";
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

interface WeeklyMacroSummary {
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
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
    bestDay: { name: string; calories: number } | null;
    worstDay: { name: string; calories: number } | null;
    topFoods: { name: string; count: number }[];
    adherencePercent: number;
    daysTracked: number;
    totalDays: number;
    macros: WeeklyMacroSummary;
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
  const { data: chefData } = useChefMe();
  const isChefApproved = chefData?.profile?.isApproved ?? false;
  const [followingOpen, setFollowingOpen] = useState(false);

  const isPro = profile?.subscriptionTier === 'pro';
  const macrosSet = profile?.macrosSet === true;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const storeRecipes = useRecipeStore(s => s.recipesById);
  const recipeLookup: RecipeLookup = useMemo(() => {
    const lookup: RecipeLookup = {};
    mockRecipes.forEach(r => {
      lookup[r.id] = r;
    });
    Object.entries(storeRecipes).forEach(([id, recipe]) => {
      lookup[id] = recipe;
    });
    return lookup;
  }, [storeRecipes]);

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
    
    const cookedLogRecipeIds = new Set(
      dayLogs.filter(l => l.sourceType === 'cooknow_logged_recipe' && l.recipeId).map(l => String(l.recipeId))
    );
    const cookedLogNames = new Set(
      dayLogs.filter(l => l.sourceType === 'cooknow_logged_recipe' && l.name).map(l => l.name!.toLowerCase())
    );
    
    const countedMeals = planner.filter(m => {
      if (m.mealState !== 'cooked' && m.mealState !== 'autoCounted') return false;
      const mealDateStr = getMealDate(m);
      if (mealDateStr !== dayStr) return false;
      if (cookedLogRecipeIds.has(m.recipeId)) return false;
      const recipe = recipeLookup[m.recipeId];
      if (recipe && cookedLogNames.has(recipe.title.toLowerCase())) return false;
      return true;
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
              <button onClick={() => setFollowingOpen(true)} className="block text-xs text-muted-foreground mt-1 hover:text-recipal-orange transition-colors" data-testid="button-open-following">
                Following
              </button>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} data-testid="button-settings">
            <Settings className="w-5 h-5" />
          </Button>
        </header>
        <FollowingSheet open={followingOpen} onOpenChange={setFollowingOpen} />

        {isChefApproved && (
          // Phase H.4: mode toggle replaced with a direct navigation. The Creator Page
          // (/chef/me) handles its own public/Stats toggle + Settings sheet.
          <div
            className="bg-muted/50 dark:bg-card rounded-full p-1 flex items-center shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
            data-testid="mode-toggle"
          >
            <button
              disabled
              className="flex-1 rounded-full py-2 text-sm font-semibold bg-white dark:bg-background shadow-[0_2px_6px_rgba(0,0,0,0.08)] text-recipal-deep-green dark:text-foreground cursor-default"
              data-testid="mode-toggle-pro"
            >
              Pro Mode
            </button>
            <button
              onClick={() => setLocation("/chef/me")}
              className="flex-1 rounded-full py-2 text-sm font-semibold transition-all duration-200 text-muted-foreground hover:text-recipal-deep-green dark:hover:text-foreground"
              data-testid="mode-toggle-creator"
            >
              Chef Creator Mode
            </button>
          </div>
        )}

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
              className="w-full justify-center bg-recipal-orange text-white font-bold rounded-full"
              onClick={handleOpenMacroWizard}
              data-testid="button-macros-set-edit"
            >
              <Target className="w-4 h-4 mr-1.5" />
              Macros: Set / Edit
            </Button>
            <Button
              className="w-full justify-center bg-green-600 text-white font-bold rounded-full"
              onClick={() => setLocation("/preferences")}
              data-testid="button-edit-preferences"
            >
              <Sliders className="w-4 h-4 mr-1.5" />
              Edit Preferences
            </Button>
          </div>
        )}

        <CalorieCounterCard
          isPro={true}
          macrosSet={macrosSet}
          goalCalories={targets.daily.calories}
          goalProtein={targets.daily.protein}
          goalCarbs={targets.daily.carbs}
          goalFat={targets.daily.fat}
          consumed={todayConsumed}
          onFinishSetup={handleOpenMacroWizard}
        />

        {macrosSet && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Brain className="w-5 h-5 text-recipal-orange" />
              <h3 className="font-bold text-base" data-testid="text-insights-heading">Insights</h3>
            </div>

            {snapshot && (
              <Card data-testid="card-insight-weekly-snapshot" className="border-0 shadow-[0_4px_16px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.06)] overflow-visible">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-recipal-deep-green" /> Weekly Snapshot
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">{snapshot.daysTracked}/{snapshot.totalDays} days tracked</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <div className="rounded-md bg-muted/40 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Daily Calories</p>
                      <p className="text-xl font-bold" data-testid="text-snapshot-avg-cal">{snapshot.avgCalories}</p>
                      <p className={`text-[10px] font-semibold ${snapshot.calorieDelta > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} data-testid="text-snapshot-cal-delta">
                        {snapshot.calorieDelta > 0 ? '+' : ''}{snapshot.calorieDelta} vs {snapshot.calorieTarget} goal
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Adherence</p>
                      <p className={`text-xl font-bold ${snapshot.adherencePercent >= 70 ? 'text-green-600 dark:text-green-400' : snapshot.adherencePercent >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`} data-testid="text-snapshot-adherence">{snapshot.adherencePercent}%</p>
                      <p className="text-[10px] text-muted-foreground">of days on target</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Macros vs Targets (daily avg)</p>
                    {[
                      { label: 'Protein', avg: snapshot.macros.avgProtein, target: snapshot.macros.targetProtein, color: 'bg-recipal-orange', trackColor: 'bg-orange-100 dark:bg-orange-950/30' },
                      { label: 'Carbs', avg: snapshot.macros.avgCarbs, target: snapshot.macros.targetCarbs, color: 'bg-primary', trackColor: 'bg-green-100 dark:bg-green-950/30' },
                      { label: 'Fat', avg: snapshot.macros.avgFat, target: snapshot.macros.targetFat, color: 'bg-blue-500', trackColor: 'bg-blue-100 dark:bg-blue-950/30' },
                    ].map(macro => {
                      const pct = macro.target > 0 ? Math.min(Math.round((macro.avg / macro.target) * 100), 150) : 0;
                      const displayPct = Math.min(pct, 100);
                      return (
                        <div key={macro.label} className="space-y-0.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium">{macro.label}</span>
                            <span className="text-muted-foreground">{macro.avg}g / {macro.target}g <span className={`font-semibold ${pct > 105 ? 'text-amber-600 dark:text-amber-400' : pct >= 90 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>({pct}%)</span></span>
                          </div>
                          <div className={`h-2 rounded-full ${macro.trackColor} overflow-hidden`}>
                            <div className={`h-full rounded-full ${macro.color} transition-all`} style={{ width: `${displayPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {snapshot.bestDay && (
                      <div className="rounded-md border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20 p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Trophy className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Day</p>
                        </div>
                        <p className="text-sm font-bold text-green-700 dark:text-green-400" data-testid="text-snapshot-best-day">{snapshot.bestDay.name}</p>
                        <p className="text-[10px] text-green-600/80 dark:text-green-500/80">{snapshot.bestDay.calories} cal</p>
                      </div>
                    )}
                    {snapshot.worstDay && (
                      <div className="rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Needs Work</p>
                        </div>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400" data-testid="text-snapshot-worst-day">{snapshot.worstDay.name}</p>
                        <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80">{snapshot.worstDay.calories} cal</p>
                      </div>
                    )}
                  </div>

                  {snapshot.topFoods.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Utensils className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Top 3 Most-Logged</p>
                      </div>
                      <div className="space-y-1.5">
                        {snapshot.topFoods.map((food, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-muted/30 rounded-md px-3 py-1.5" data-testid={`text-snapshot-food-${idx}`}>
                            <span className="flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${idx === 0 ? 'bg-recipal-orange' : idx === 1 ? 'bg-recipal-deep-green' : 'bg-muted-foreground'}`}>{idx + 1}</span>
                              <span className="font-medium truncate max-w-[160px]">{food.name}</span>
                            </span>
                            <span className="text-muted-foreground flex-shrink-0">{food.count}x</span>
                          </div>
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

  const IconBox = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <div className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-white flex-shrink-0" style={{ background: color }}>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#f2f2f7' }}>
      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* Profile Card */}
        <div className="bg-white dark:bg-card rounded-2xl p-4 flex items-center gap-3.5">
          <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ff6300, #ff9500)' }}>
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-foreground" data-testid="text-username">{user?.username?.split('@')[0] || 'User'}</h2>
            <p className="text-[12px] text-muted-foreground">Free Account</p>
            <button onClick={() => setFollowingOpen(true)} className="text-[12px] text-muted-foreground hover:text-recipal-orange transition-colors" data-testid="button-open-following">
              Following
            </button>
          </div>
        </div>
        <FollowingSheet open={followingOpen} onOpenChange={setFollowingOpen} />

        {/* Upgrade Banner */}
        <button
          onClick={() => setLocation("/paywall")}
          className="w-full rounded-full bg-[#ff6300] text-white p-4 flex items-center gap-3.5 text-left"
          data-testid="button-upgrade"
        >
          <div className="flex-1">
            <h3 className="text-[16px] font-bold text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Upgrade to Pro
            </h3>
            <p className="text-[11px] text-white/90 mt-0.5">Macros, smart plans, insights & more</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
            <ChevronRight className="w-4 h-4 text-white" />
          </div>
        </button>

        {/* Quick Actions */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-1.5">Quick Actions</p>
          <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
            <button
              onClick={() => setLocation("/preferences")}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea] dark:border-border"
              data-testid="button-edit-preferences-free"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#34c759"><Sliders className="h-4 w-4" /></IconBox>
                <span className="text-[15px]">Edit Preferences</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
            </button>
            <button
              onClick={() => setLocation("/settings")}
              className="w-full flex items-center justify-between px-4 py-3"
              data-testid="button-account-settings"
            >
              <div className="flex items-center gap-3">
                <IconBox color="#8e8e93"><Settings className="h-4 w-4" /></IconBox>
                <span className="text-[15px]">Settings</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
