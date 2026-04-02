import { Repeat, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Recipe } from '@/lib/mock-data';

interface SideMealCardProps {
  recipe: Recipe;
  servings?: number;
  onSwap: () => void;
  onRemove: () => void;
  onClickImage?: () => void;
}

export function SideMealCard({ recipe, servings, onSwap, onRemove, onClickImage }: SideMealCardProps) {
  return (
    <div className="relative px-2 py-1.5 border-b border-[rgba(255,99,0,0.08)] last:border-b-0">
      <button
        className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
        onClick={onRemove}
      >
        <X className="w-3 h-3" />
      </button>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-[5px] bg-muted flex-shrink-0 bg-cover bg-center cursor-pointer"
              style={recipe.image ? { backgroundImage: `url(${recipe.image})` } : undefined}
              onClick={onClickImage}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">{recipe.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {servings || 1} {(servings || 1) === 1 ? 'serving' : 'servings'}
              </p>
            </div>
          </div>
          <div className="flex gap-1 mt-1 mr-[5px]">
            <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[28px]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#ff6300] to-[#ff8533]" />
              <p className="text-[10px] font-extrabold text-[#ff6300] leading-none mt-0.5">{recipe.protein}g</p>
              <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Protein</p>
            </div>
            <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[28px]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2ecc71] to-[#27ae60]" />
              <p className="text-[10px] font-extrabold text-[#2ecc71] leading-none mt-0.5">{recipe.carbs}g</p>
              <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Carbs</p>
            </div>
            <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[28px]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#3498db] to-[#2980b9]" />
              <p className="text-[10px] font-extrabold text-[#3498db] leading-none mt-0.5">{recipe.fat}g</p>
              <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Fat</p>
            </div>
            <div className="flex-1 relative overflow-hidden rounded-lg bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-[1px] py-1 text-center min-w-[28px]">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#f1c40f] to-[#e67e22]" />
              <p className="text-[10px] font-extrabold text-[#e67e22] leading-none mt-0.5">{recipe.calories}</p>
              <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[2px]">Calories</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-center justify-center flex-shrink-0">
          <Button
            size="sm"
            className="border-0 gap-0 bg-gradient-to-b from-[#60a5fa] via-[#3b82f6] to-[#2563eb] hover:opacity-90 text-white px-2 py-1 min-h-0 w-full rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)] font-bold"
            onClick={onSwap}
          >
            <Repeat className="w-3 h-3 text-white" />
            <span className="text-[10px] font-medium text-white ml-[2px]">Swap</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
