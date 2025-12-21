import { useDashboard } from "@/hooks/use-plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Flame, TrendingUp, Utensils, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  if (error) return <div className="text-destructive text-center p-12">Failed to load dashboard data.</div>;
  if (!data) return null;

  const macroData = [
    { name: 'Protein', value: 150, color: '#22c55e' }, // Mock values, replace with real if available
    { name: 'Carbs', value: 200, color: '#f59e0b' },
    { name: 'Fat', value: 60, color: '#ef4444' },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Today's Overview</h1>
          <p className="text-muted-foreground">You're on track to hit your goals!</p>
        </div>
        <Link href="/plan">
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
            View Full Plan <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border/50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Calories Consumed</CardTitle>
            <Flame className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{data.dailyCalories} <span className="text-sm text-muted-foreground font-normal">/ 2400 kcal</span></div>
            <div className="h-2 w-full bg-secondary mt-3 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 w-[65%]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Savings</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-green-600">${data.weeklySavings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              You've saved <span className="font-medium text-foreground">${data.lifetimeSavings.toFixed(2)}</span> lifetime!
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-md bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Next Meal</CardTitle>
            <Utensils className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {data.nextMeal ? (
              <>
                <div className="text-lg font-bold font-display truncate">{data.nextMeal.recipe.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {data.nextMeal.recipe.calories} kcal • {data.nextMeal.recipe.protein}g Protein
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No more meals planned today.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-64">
         {/* Placeholder for macro chart - using mock static for now */}
        <Card className="md:col-span-1 border-border/50 shadow-md">
           <CardHeader>
             <CardTitle>Macro Split</CardTitle>
           </CardHeader>
           <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {macroData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"/> Protein</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500"/> Carbs</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/> Fat</div>
              </div>
           </CardContent>
        </Card>
        
        <div className="md:col-span-2 bg-slate-900 rounded-xl p-6 text-white flex flex-col justify-center items-center text-center shadow-lg">
           <h3 className="text-2xl font-display font-bold mb-2">Ready to shop?</h3>
           <p className="text-slate-400 mb-6 max-w-md">Your grocery list is automatically generated based on your weekly plan. Check for deals before you go!</p>
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
