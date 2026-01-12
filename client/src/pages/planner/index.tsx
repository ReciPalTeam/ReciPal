import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";

const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function PlannerPage() {
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background p-4 space-y-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} data-testid="button-prev-week">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-sm">
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} data-testid="button-next-week">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "card" | "list")}>
            <TabsList className="h-8">
              <TabsTrigger value="card" className="h-6 px-2" data-testid="button-card-view">
                <LayoutGrid className="w-3 h-3" />
              </TabsTrigger>
              <TabsTrigger value="list" className="h-6 px-2" data-testid="button-list-view">
                <List className="w-3 h-3" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === "card" ? (
          <div className="space-y-4">
            {days.map((day) => (
              <Card key={day.toISOString()} data-testid={`card-day-${format(day, 'yyyy-MM-dd')}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{format(day, "EEEE, MMM d")}</span>
                    <span className="text-xs text-muted-foreground font-normal">0 cal</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {mealTypes.map((meal) => (
                    <div key={meal} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-xs text-muted-foreground">{meal}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" data-testid={`button-add-${meal.toLowerCase()}-${format(day, 'yyyy-MM-dd')}`}>
                        <Plus className="w-3 h-3" /> Add
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {days.map((day) => (
              <div key={day.toISOString()} className="p-3 border rounded-lg" data-testid={`row-day-${format(day, 'yyyy-MM-dd')}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{format(day, "EEE, MMM d")}</span>
                  <span className="text-xs text-muted-foreground">No meals planned</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
