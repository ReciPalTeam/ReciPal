interface MealTotalRowProps {
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export function MealTotalRow({ nutrition }: MealTotalRowProps) {
  return (
    <div className="mt-1.5 px-2 py-1.5 bg-[rgba(255,99,0,0.06)] rounded-md flex items-center justify-between text-[11px] font-semibold">
      <span className="text-muted-foreground">Meal Total</span>
      <div className="flex gap-2.5 text-[10px] font-semibold">
        <span style={{ color: '#ff6300' }}>P: {Math.round(nutrition.protein)}g</span>
        <span style={{ color: '#15803d' }}>C: {Math.round(nutrition.carbs)}g</span>
        <span style={{ color: '#1e40af' }}>F: {Math.round(nutrition.fat)}g</span>
        <span style={{ color: '#ca8a04' }}>{Math.round(nutrition.calories)} cal</span>
      </div>
    </div>
  );
}
