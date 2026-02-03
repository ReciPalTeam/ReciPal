import { useDashboard } from "@/hooks/use-plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, TrendingUp, Utensils, Loader2, PieChart, Lock, Target } from "lucide-react";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useProfile } from "@/hooks/use-profile";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: profile } = useProfile();
  const isPro = profile?.subscriptionTier === "pro";

  const { data: stats, isLoading, error } = useQuery<any>({ 
    queryKey: ["/api/dashboard"],
    enabled: isPro 
  });

  if (isLoading && isPro) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  
  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
        <div className="bg-recipal-orange/10 p-6 rounded-full">
          <Lock className="w-12 h-12 text-recipal-orange" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-recipal-deep-green">Macro Tracking is a Pro Feature</h2>
          <p className="text-muted-foreground max-w-md mx-auto mt-2">
            Upgrade to Pro to track your daily macronutrients, visualize trends, and get personalized macro-balanced meal plans.
          </p>
        </div>
        <Link href="/pro">
          <Button className="bg-recipal-orange hover:bg-recipal-orange/90 text-lg px-8">
            Explore Pro
          </Button>
        </Link>
      </div>
    );
  }

  const macroData = [
    { name: 'Protein', value: profile?.targetProtein || 150, fill: 'hsl(var(--recipal-orange))' },
    { name: 'Carbs', value: profile?.targetCarbs || 200, fill: 'hsl(var(--primary))' },
    { name: 'Fat', value: profile?.targetFat || 70, fill: '#1e40af' },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-recipal-deep-green">Today's Overview</h1>
          <p className="text-muted-foreground">Plan meals • Order groceries • Cook smarter</p>
        </div>
        <div className="flex gap-2">
          <Link href="/plan">
            <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              View Full Plan <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover-elevate transition-all border-none shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Daily Macros</CardTitle>
            <PieChart className="h-4 w-4 text-recipal-orange" />
          </CardHeader>
          <CardContent>
            <div className="h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={macroData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center mt-4">
              <div>
                <p className="text-xs text-muted-foreground">Protein</p>
                <p className="text-lg font-bold text-recipal-orange">{profile?.targetProtein}g</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Carbs</p>
                <p className="text-lg font-bold text-primary">{profile?.targetCarbs}g</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fat</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-300">{profile?.targetFat}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-all border-none shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-recipal-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-recipal-deep-green">${stats?.weeklySavings.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              You've saved <span className="font-medium text-foreground">${stats?.lifetimeSavings.toFixed(2) || '0.00'}</span> lifetime!
            </p>
            <div className="mt-6 space-y-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-recipal-orange w-[75%]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-md bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Next Meal</CardTitle>
            <Utensils className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {stats?.nextMeal ? (
              <>
                <div className="text-lg font-bold font-display truncate">{stats.nextMeal.recipe.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stats.nextMeal.recipe.calories} kcal • {stats.nextMeal.recipe.protein}g Protein
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No more meals planned today.</div>
            )}
          </CardContent>
        </Card>

        <div className="bg-slate-900 rounded-xl p-6 text-white flex flex-col justify-center items-center text-center shadow-lg">
           <h3 className="text-2xl font-display font-bold mb-2">Ready to shop?</h3>
           <p className="text-slate-400 mb-6 max-w-md">Your grocery list is automatically generated based on your weekly plan.</p>
           <Link href="/cart">
             <Button className="bg-white text-slate-900 hover:bg-gray-100 font-bold">
               Go to Grocery List
             </Button>
           </Link>
        </div>
      </div>
    </div>
  );
}
