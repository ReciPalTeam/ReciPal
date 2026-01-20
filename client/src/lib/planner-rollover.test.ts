import { describe, it, expect } from 'vitest';
import {
  getLocalDateString,
  isDateBefore,
  shouldRunRollover,
  getMealsToTransition,
  applyMidnightRollover,
  canMarkAsCooked,
  markMealCooked,
  removeMealAndComputeDelta,
  shouldSubtractFromTotals,
  RolloverMealInput,
  RolloverState,
} from './planner-rollover';

function createMockMeal(
  id: string,
  mealState: 'scheduled' | 'cooked' | 'autoCounted' = 'scheduled',
  date?: string
): RolloverMealInput {
  return {
    id,
    recipeId: 'recipe-1',
    dayIndex: 0,
    mealType: 'Lunch',
    mealState,
    date,
    servings: 1,
  };
}

describe('getLocalDateString', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 20);
    const result = getLocalDateString(date);
    expect(result).toBe('2025-01-20');
  });

  it('should pad single digit months and days', () => {
    const date = new Date(2025, 4, 5);
    const result = getLocalDateString(date);
    expect(result).toBe('2025-05-05');
  });
});

describe('isDateBefore', () => {
  it('should return true when dateA is before dateB', () => {
    expect(isDateBefore('2025-01-19', '2025-01-20')).toBe(true);
  });

  it('should return false when dateA equals dateB', () => {
    expect(isDateBefore('2025-01-20', '2025-01-20')).toBe(false);
  });

  it('should return false when dateA is after dateB', () => {
    expect(isDateBefore('2025-01-21', '2025-01-20')).toBe(false);
  });
});

describe('shouldRunRollover', () => {
  it('should return true when lastRolloverDate is before current date', () => {
    expect(shouldRunRollover('2025-01-19', '2025-01-20')).toBe(true);
  });

  it('should return false when lastRolloverDate equals current date', () => {
    expect(shouldRunRollover('2025-01-20', '2025-01-20')).toBe(false);
  });

  it('should return false when lastRolloverDate is after current date', () => {
    expect(shouldRunRollover('2025-01-21', '2025-01-20')).toBe(false);
  });
});

describe('getMealsToTransition', () => {
  it('should return only scheduled meals before the date', () => {
    const meals = [
      createMockMeal('1', 'scheduled', '2025-01-19'),
      createMockMeal('2', 'scheduled', '2025-01-20'),
      createMockMeal('3', 'cooked', '2025-01-19'),
    ];
    
    const result = getMealsToTransition(meals, '2025-01-20');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should not include already cooked meals', () => {
    const meals = [
      createMockMeal('1', 'cooked', '2025-01-19'),
      createMockMeal('2', 'autoCounted', '2025-01-19'),
    ];
    
    const result = getMealsToTransition(meals, '2025-01-20');
    expect(result).toHaveLength(0);
  });
});

describe('applyMidnightRollover', () => {
  it('should transition scheduled meals to autoCounted', () => {
    const meals = [
      createMockMeal('1', 'scheduled', '2025-01-19'),
      createMockMeal('2', 'scheduled', '2025-01-20'),
    ];
    const rolloverState: RolloverState = { lastRolloverDate: '2025-01-19' };
    
    const result = applyMidnightRollover(meals, rolloverState, '2025-01-20');
    
    expect(result.mealsTransitioned).toBe(1);
    expect(result.newRolloverDate).toBe('2025-01-20');
    
    const transitioned = result.updatedMeals.find(m => m.id === '1');
    expect(transitioned?.mealState).toBe('autoCounted');
    
    const notTransitioned = result.updatedMeals.find(m => m.id === '2');
    expect(notTransitioned?.mealState).toBe('scheduled');
  });

  it('should NOT run rollover if already processed today (prevents double counting)', () => {
    const meals = [
      createMockMeal('1', 'scheduled', '2025-01-19'),
    ];
    const rolloverState: RolloverState = { lastRolloverDate: '2025-01-20' };
    
    const result = applyMidnightRollover(meals, rolloverState, '2025-01-20');
    
    expect(result.mealsTransitioned).toBe(0);
    expect(result.newRolloverDate).toBe('2025-01-20');
    expect(result.updatedMeals[0].mealState).toBe('scheduled');
  });

  it('should not double-count: autoCounted meals stay autoCounted', () => {
    const meals = [
      createMockMeal('1', 'autoCounted', '2025-01-18'),
      createMockMeal('2', 'scheduled', '2025-01-19'),
    ];
    const rolloverState: RolloverState = { lastRolloverDate: '2025-01-19' };
    
    const result = applyMidnightRollover(meals, rolloverState, '2025-01-20');
    
    const firstMeal = result.updatedMeals.find(m => m.id === '1');
    expect(firstMeal?.mealState).toBe('autoCounted');
    
    const secondMeal = result.updatedMeals.find(m => m.id === '2');
    expect(secondMeal?.mealState).toBe('autoCounted');
    
    expect(result.mealsTransitioned).toBe(1);
  });
});

describe('markMealCooked', () => {
  it('should mark scheduled meal as cooked', () => {
    const meals = [createMockMeal('1', 'scheduled')];
    const result = markMealCooked(meals, '1');
    
    expect(result.wasTransitioned).toBe(true);
    expect(result.updatedMeals[0].mealState).toBe('cooked');
  });

  it('should NOT re-mark autoCounted meal as cooked (prevents double counting)', () => {
    const meals = [createMockMeal('1', 'autoCounted')];
    const result = markMealCooked(meals, '1');
    
    expect(result.wasTransitioned).toBe(false);
    expect(result.updatedMeals[0].mealState).toBe('autoCounted');
  });

  it('should NOT re-mark already cooked meal', () => {
    const meals = [createMockMeal('1', 'cooked')];
    const result = markMealCooked(meals, '1');
    
    expect(result.wasTransitioned).toBe(false);
    expect(result.updatedMeals[0].mealState).toBe('cooked');
  });
});

describe('canMarkAsCooked', () => {
  it('should return true for scheduled meals', () => {
    const meal = createMockMeal('1', 'scheduled');
    expect(canMarkAsCooked(meal)).toBe(true);
  });

  it('should return false for cooked meals', () => {
    const meal = createMockMeal('1', 'cooked');
    expect(canMarkAsCooked(meal)).toBe(false);
  });

  it('should return false for autoCounted meals', () => {
    const meal = createMockMeal('1', 'autoCounted');
    expect(canMarkAsCooked(meal)).toBe(false);
  });
});

describe('removeMealAndComputeDelta', () => {
  it('should remove meal and return its state', () => {
    const meals = [
      createMockMeal('1', 'cooked'),
      createMockMeal('2', 'scheduled'),
    ];
    
    const result = removeMealAndComputeDelta(meals, '1');
    
    expect(result.updatedMeals).toHaveLength(1);
    expect(result.removedMealState).toBe('cooked');
  });

  it('should return null state for non-existent meal', () => {
    const meals = [createMockMeal('1', 'cooked')];
    
    const result = removeMealAndComputeDelta(meals, 'non-existent');
    
    expect(result.updatedMeals).toHaveLength(1);
    expect(result.removedMealState).toBe(null);
  });
});

describe('shouldSubtractFromTotals', () => {
  it('should return true for cooked state', () => {
    expect(shouldSubtractFromTotals('cooked')).toBe(true);
  });

  it('should return true for autoCounted state', () => {
    expect(shouldSubtractFromTotals('autoCounted')).toBe(true);
  });

  it('should return false for scheduled state', () => {
    expect(shouldSubtractFromTotals('scheduled')).toBe(false);
  });

  it('should return false for null state', () => {
    expect(shouldSubtractFromTotals(null)).toBe(false);
  });
});
