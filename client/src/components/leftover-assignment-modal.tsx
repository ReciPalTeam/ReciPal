import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Minus, Plus } from 'lucide-react';
import { Recipe } from '@/lib/mock-data';
import { MealType } from '@/lib/demo-store';

interface DayAssignment {
  date: string;
  dayLabel: string;
  selected: boolean;
  mealType: MealType;
}

interface LeftoverAssignmentProps {
  recipe: Recipe;
  weekDates: { date: string; label: string }[];
  totalServings: number; // Total servings from recipe/planner
  onAssign: (assignments: { date: string; mealType: MealType; servings: number }[]) => void;
  onSkip: () => void;
}

const FRACTION_STEPS = [0.25, 1/3, 0.5, 0.75, 1];
const FRACTION_LABELS: Record<number, string> = {
  0.25: '1/4',
  [1/3]: '1/3',
  0.5: '1/2',
  0.75: '3/4',
  1: '1',
};

function getServingSteps(totalServings: number): number[] {
  const steps = [...FRACTION_STEPS];
  // If recipe has multiple servings, add whole-number steps up to total
  if (totalServings > 1) {
    for (let i = 2; i <= totalServings; i++) {
      steps.push(i);
    }
  }
  return steps;
}

function formatServing(value: number): string {
  if (FRACTION_LABELS[value]) return FRACTION_LABELS[value];
  // Check 1/3 specifically due to floating point
  if (Math.abs(value - 1/3) < 0.001) return '1/3';
  return value.toString();
}

const MEAL_TYPE_OPTIONS: MealType[] = ['Breakfast', 'Lunch', 'Dinner'];

export function LeftoverAssignment({ recipe, weekDates, totalServings, onAssign, onSkip }: LeftoverAssignmentProps) {
  const servingSteps = getServingSteps(totalServings);
  const defaultServing = totalServings > 1 ? 1 : 0.5;

  const [days, setDays] = useState<(DayAssignment & { servings: number })[]>(
    weekDates.map(d => ({
      date: d.date,
      dayLabel: d.label,
      selected: false,
      mealType: 'Lunch' as MealType,
      servings: defaultServing,
    }))
  );

  const selectedCount = days.filter(d => d.selected).length;

  const toggleDay = (index: number) => {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, selected: !d.selected } : d));
  };

  const setMealType = (index: number, mealType: MealType) => {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, mealType } : d));
  };

  const cycleServings = (index: number, direction: 1 | -1) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== index) return d;
      const currentIdx = servingSteps.findIndex(s => Math.abs(s - d.servings) < 0.001);
      let nextIdx = currentIdx + direction;
      if (nextIdx < 0) nextIdx = 0;
      if (nextIdx >= servingSteps.length) nextIdx = servingSteps.length - 1;
      return { ...d, servings: servingSteps[nextIdx] };
    }));
  };

  const handleAssign = () => {
    const assignments = days
      .filter(d => d.selected)
      .map(d => ({ date: d.date, mealType: d.mealType, servings: d.servings }));
    onAssign(assignments);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold">Assign Leftovers</h3>
        <p className="text-sm text-muted-foreground">Pick which days to eat your leftover {recipe.title}</p>
      </div>

      <div className="space-y-2">
        {days.map((day, idx) => (
          <div key={day.date} className="flex flex-col gap-1.5 p-2 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={day.selected}
                onCheckedChange={() => toggleDay(idx)}
              />
              <span className="text-sm font-medium flex-1">{day.dayLabel}</span>
            </div>
            {day.selected && (
              <div className="ml-7 space-y-2">
                {/* Meal type toggle */}
                <div className="flex gap-1">
                  {MEAL_TYPE_OPTIONS.map(mt => (
                    <Button
                      key={mt}
                      size="sm"
                      variant={day.mealType === mt ? 'default' : 'outline'}
                      className={`h-6 px-2 text-[10px] ${
                        day.mealType === mt
                          ? 'bg-[#ff6300] hover:bg-[#ff6300]/90 text-white'
                          : ''
                      }`}
                      onClick={() => setMealType(idx, mt)}
                    >
                      {mt}
                    </Button>
                  ))}
                </div>
                {/* How much remaining */}
                <div className="flex items-center gap-2 bg-white rounded-md px-2 py-1.5 border">
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">How much left?</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => cycleServings(idx, -1)}
                      disabled={Math.abs(day.servings - servingSteps[0]) < 0.001}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <div className="flex items-baseline gap-0.5 min-w-[60px] justify-center">
                      <span className="text-sm font-bold text-[#ff6300]">
                        {formatServing(day.servings)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        of {totalServings} {totalServings === 1 ? 'serving' : 'servings'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => cycleServings(idx, 1)}
                      disabled={Math.abs(day.servings - servingSteps[servingSteps.length - 1]) < 0.001}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onSkip}>
          Skip
        </Button>
        <Button
          className="flex-1 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white font-bold"
          onClick={handleAssign}
          disabled={selectedCount === 0}
        >
          Assign to {selectedCount} day{selectedCount !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}
