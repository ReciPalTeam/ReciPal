import { MealState } from './demo-store';

export interface RolloverMealInput {
  id: string;
  recipeId: string;
  dayIndex: number;
  mealType: string;
  mealState: MealState;
  date?: string;
  servings: number;
}

export interface RolloverState {
  lastRolloverDate: string;
}

export interface RolloverResult {
  updatedMeals: RolloverMealInput[];
  newRolloverDate: string;
  mealsTransitioned: number;
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isDateBefore(dateA: string, dateB: string): boolean {
  const a = parseLocalDate(dateA);
  const b = parseLocalDate(dateB);
  return a.getTime() < b.getTime();
}

export function shouldRunRollover(
  lastRolloverDate: string,
  currentDate: string = getLocalDateString()
): boolean {
  return isDateBefore(lastRolloverDate, currentDate);
}

export function getMealsToTransition(
  meals: RolloverMealInput[],
  beforeDate: string
): RolloverMealInput[] {
  return meals.filter(meal => {
    if (meal.mealState !== 'scheduled') {
      return false;
    }
    
    if (meal.date) {
      return isDateBefore(meal.date, beforeDate);
    }
    
    return true;
  });
}

export function applyMidnightRollover(
  meals: RolloverMealInput[],
  rolloverState: RolloverState,
  currentDate: string = getLocalDateString()
): RolloverResult {
  if (!shouldRunRollover(rolloverState.lastRolloverDate, currentDate)) {
    return {
      updatedMeals: meals,
      newRolloverDate: rolloverState.lastRolloverDate,
      mealsTransitioned: 0,
    };
  }
  
  const mealsToTransition = getMealsToTransition(meals, currentDate);
  const transitionedIds = new Set(mealsToTransition.map(m => m.id));
  
  const updatedMeals = meals.map(meal => {
    if (transitionedIds.has(meal.id)) {
      return { ...meal, mealState: 'autoCounted' as MealState };
    }
    return meal;
  });
  
  return {
    updatedMeals,
    newRolloverDate: currentDate,
    mealsTransitioned: transitionedIds.size,
  };
}

export function canMarkAsCooked(meal: RolloverMealInput): boolean {
  return meal.mealState === 'scheduled';
}

export function markMealCooked(
  meals: RolloverMealInput[],
  mealId: string
): { updatedMeals: RolloverMealInput[]; wasTransitioned: boolean } {
  const meal = meals.find(m => m.id === mealId);
  
  if (!meal || meal.mealState === 'cooked' || meal.mealState === 'autoCounted') {
    return { updatedMeals: meals, wasTransitioned: false };
  }
  
  const updatedMeals = meals.map(m => 
    m.id === mealId ? { ...m, mealState: 'cooked' as MealState } : m
  );
  
  return { updatedMeals, wasTransitioned: true };
}

export function removeMealAndComputeDelta(
  meals: RolloverMealInput[],
  mealId: string
): { updatedMeals: RolloverMealInput[]; removedMealState: MealState | null } {
  const meal = meals.find(m => m.id === mealId);
  
  if (!meal) {
    return { updatedMeals: meals, removedMealState: null };
  }
  
  const removedMealState = meal.mealState;
  const updatedMeals = meals.filter(m => m.id !== mealId);
  
  return { updatedMeals, removedMealState };
}

export function shouldSubtractFromTotals(mealState: MealState | null): boolean {
  return mealState === 'cooked' || mealState === 'autoCounted';
}
