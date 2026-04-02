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
    <div className="mt-1.5 px-2 py-1.5 bg-[rgba(255,99,0,0.06)] rounded-md flex items-center gap-1.5 text-[11px] font-semibold">
      <span className="text-muted-foreground whitespace-nowrap">Meal Total</span>
      <div className="flex gap-1 text-[10px] font-bold flex-wrap">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-[#ffb380]/30 to-[#ff6300]/25 text-[#ff6300]">P: {Math.round(nutrition.protein)}g</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-[#2ecc71]/20 to-[#27ae60]/30 text-[#2ecc71]">C: {Math.round(nutrition.carbs)}g</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-[#3498db]/20 to-[#2980b9]/30 text-[#3498db]">F: {Math.round(nutrition.fat)}g</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-[#f1c40f]/25 to-[#e67e22]/35 text-[#e67e22]">{Math.round(nutrition.calories)} cal</span>
      </div>
    </div>
  );
}
