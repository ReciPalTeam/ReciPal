import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays, startOfWeek, isSameDay, isWithinInterval, eachDayOfInterval } from "date-fns";
import type { MealType } from "@/lib/demo-store";

type DateSelectionMode = "single" | "range" | "select";
const SCHEDULE_MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Desserts", "Snackitizers"];

interface ManualEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualEntrySheet({ open, onOpenChange }: ManualEntrySheetProps) {
  const { toast } = useToast();
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });

  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [selectedMealType, setSelectedMealType] = useState<MealType>("Lunch");
  const [dateMode, setDateMode] = useState<DateSelectionMode>("single");
  const [calendarWeekStart, setCalendarWeekStart] = useState(weekStart);
  const [selectedDates, setSelectedDates] = useState<Date[]>([today]);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  const getSelectedDatesToSchedule = (): Date[] => {
    if (dateMode === "single") {
      return selectedDates.slice(0, 1);
    } else if (dateMode === "range" && rangeStart && rangeEnd) {
      return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    } else if (dateMode === "select") {
      return selectedDates;
    }
    return [];
  };

  const handleCalendarDayClick = (date: Date) => {
    if (dateMode === "single") {
      setSelectedDates([date]);
      setRangeStart(null);
      setRangeEnd(null);
    } else if (dateMode === "range") {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(date);
        setRangeEnd(null);
        setSelectedDates([]);
      } else {
        if (date < rangeStart) {
          setRangeEnd(rangeStart);
          setRangeStart(date);
        } else {
          setRangeEnd(date);
        }
      }
    } else if (dateMode === "select") {
      const exists = selectedDates.some(d => isSameDay(d, date));
      if (exists) {
        setSelectedDates(selectedDates.filter(d => !isSameDay(d, date)));
      } else {
        setSelectedDates([...selectedDates, date]);
      }
    }
  };

  const isDateSelected = (date: Date): boolean => {
    if (dateMode === "range" && rangeStart && rangeEnd) {
      return isWithinInterval(date, { start: rangeStart, end: rangeEnd });
    }
    return selectedDates.some(d => isSameDay(d, date));
  };

  const resetForm = () => {
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setSelectedMealType("Lunch");
    setDateMode("single");
    setSelectedDates([today]);
    setRangeStart(null);
    setRangeEnd(null);
    setCalendarWeekStart(weekStart);
  };

  const handleManualAdd = async () => {
    if (!name || !calories) {
      toast({ title: "Error", description: "Name and calories are required", variant: "destructive" });
      return;
    }

    const datesToLog = getSelectedDatesToSchedule();
    if (datesToLog.length === 0) {
      toast({ title: "Error", description: "Please select at least one date", variant: "destructive" });
      return;
    }
    
    try {
      for (const date of datesToLog) {
        await apiRequest('POST', '/api/consumption-logs', {
          date: format(date, 'yyyy-MM-dd'),
          name: name,
          calories: parseInt(calories),
          protein: parseInt(protein) || 0,
          carbs: parseInt(carbs) || 0,
          fat: parseInt(fat) || 0,
          mealSlot: selectedMealType,
          sourceType: 'manual_custom_entry'
        });
      }
      
      resetForm();
      toast({ title: "Added", description: datesToLog.length > 1 ? `Manual entry added for ${datesToLog.length} days` : "Manual entry added to your log" });
      queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add entry", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">Manual Entry</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              placeholder="e.g., Protein shake"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              data-testid="input-manual-name"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Meal Slot</Label>
            <Select value={selectedMealType} onValueChange={(v) => setSelectedMealType(v as MealType)}>
              <SelectTrigger data-testid="select-manual-meal-slot">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_MEAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Calories</Label>
              <Input
                type="number"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="h-9 text-sm"
                data-testid="input-manual-calories"
              />
            </div>
            <div>
              <Label className="text-xs">Protein (g)</Label>
              <Input
                type="number"
                placeholder="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="h-9 text-sm"
                data-testid="input-manual-protein"
              />
            </div>
            <div>
              <Label className="text-xs">Carbs (g)</Label>
              <Input
                type="number"
                placeholder="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="h-9 text-sm"
                data-testid="input-manual-carbs"
              />
            </div>
            <div>
              <Label className="text-xs">Fat (g)</Label>
              <Input
                type="number"
                placeholder="0"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="h-9 text-sm"
                data-testid="input-manual-fat"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Date Selection</Label>
            <div className="flex gap-1">
              <Button
                variant={dateMode === "single" ? "default" : "outline"}
                size="sm"
                onClick={() => { setDateMode("single"); setSelectedDates([today]); setRangeStart(null); setRangeEnd(null); }}
                data-testid="button-manual-mode-single"
                className="flex-1 text-xs"
              >
                Single Day
              </Button>
              <Button
                variant={dateMode === "range" ? "default" : "outline"}
                size="sm"
                onClick={() => { setDateMode("range"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                data-testid="button-manual-mode-range"
                className="flex-1 text-xs"
              >
                Date Range
              </Button>
              <Button
                variant={dateMode === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => { setDateMode("select"); setSelectedDates([]); setRangeStart(null); setRangeEnd(null); }}
                data-testid="button-manual-mode-select"
                className="flex-1 text-xs"
              >
                Select Days
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, -7))}
                data-testid="button-manual-calendar-prev"
              >
                &larr;
              </Button>
              <span className="text-sm font-medium" data-testid="text-manual-calendar-range">
                {format(calendarWeekStart, "MMM d")} - {format(addDays(calendarWeekStart, 13), "MMM d, yyyy")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, 7))}
                data-testid="button-manual-calendar-next"
              >
                &rarr;
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                <div key={day} className="text-xs text-muted-foreground font-medium py-1">
                  {day}
                </div>
              ))}
              
              {Array.from({ length: 14 }, (_, i) => {
                const date = addDays(calendarWeekStart, i);
                const selected = isDateSelected(date);
                const isToday = isSameDay(date, today);
                const isPast = date < today && !isToday;
                
                return (
                  <Button
                    key={i}
                    variant="ghost"
                    size="sm"
                    onClick={() => !isPast && handleCalendarDayClick(date)}
                    disabled={isPast}
                    className={`h-10 p-0 relative ${
                      isPast
                        ? "opacity-50 cursor-not-allowed text-muted-foreground"
                        : selected 
                          ? "bg-primary text-primary-foreground" 
                          : isToday 
                            ? "border border-primary" 
                            : ""
                    }`}
                    data-testid={`manual-calendar-day-${format(date, "yyyy-MM-dd")}`}
                  >
                    <span className="text-xs">{format(date, "d")}</span>
                  </Button>
                );
              })}
            </div>

            {dateMode === "range" && rangeStart && !rangeEnd && (
              <p className="text-xs text-muted-foreground text-center">Click another day to complete the range</p>
            )}
            {dateMode === "select" && (
              <p className="text-xs text-muted-foreground text-center">Click to select/deselect days</p>
            )}
          </div>

          <Button
            onClick={handleManualAdd}
            className="w-full bg-recipal-orange"
            data-testid="button-manual-save"
          >
            Save Entry
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
