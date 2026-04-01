import { Repeat, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Recipe } from '@/lib/mock-data';

interface SideMealCardProps {
  recipe: Recipe;
  onSwap: () => void;
  onRemove: () => void;
}

export function SideMealCard({ recipe, onSwap, onRemove }: SideMealCardProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[rgba(255,99,0,0.08)] last:border-b-0">
      <div
        className="w-8 h-8 rounded-[5px] bg-muted flex-shrink-0 bg-cover bg-center"
        style={recipe.image ? { backgroundImage: `url(${recipe.image})` } : undefined}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium truncate">{recipe.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {recipe.calories} cal · P: {recipe.protein}g · C: {recipe.carbs}g · F: {recipe.fat}g
        </p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Button
          size="sm"
          className="h-5 w-5 p-0 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white rounded shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
          onClick={onSwap}
        >
          <Repeat className="w-2.5 h-2.5" />
        </Button>
        <Button
          size="sm"
          className="h-5 w-5 p-0 bg-[#ef4444] hover:bg-[#ef4444]/90 text-white rounded shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
          onClick={onRemove}
        >
          <X className="w-2.5 h-2.5" />
        </Button>
      </div>
    </div>
  );
}
