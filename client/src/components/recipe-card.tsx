import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Share2, Clock, Plus, Sparkles, Pencil, Trash2 } from "lucide-react";
import type { Recipe } from "@/lib/mock-data";
import type { ReactNode } from "react";
import { formatMinutesHumanReadable } from "@/lib/time-format";
import { StarRating } from "@/components/star-rating";

interface RecipeCardProps {
  recipe: Recipe & {
    isInjected?: boolean;
  };
  onCardClick: (recipeId: string) => void;
  onToggleFavorite: (e: React.MouseEvent, recipe: Recipe) => void;
  onShare: (e: React.MouseEvent, recipeId: string, recipeTitle: string) => void;
  isFavorite: boolean;
  overlapBadge?: ReactNode;
  showEditDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  averageRating?: number;
}

export function RecipeCard({
  recipe,
  onCardClick,
  onToggleFavorite,
  onShare,
  isFavorite,
  overlapBadge,
  showEditDelete = false,
  onEdit,
  onDelete,
  averageRating = 0,
}: RecipeCardProps) {
  return (
    <Card
      className="overflow-hidden cursor-pointer relative shadow-[0_1px_6px_rgba(0,0,0,0.14)] border-0 flex flex-col h-full"
      onClick={() => onCardClick(recipe.id)}
      data-testid={`card-recipe-${recipe.id}`}
    >
      {recipe.isInjected && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary/80 to-primary/60 text-white text-[9px] py-0.5 px-2 z-10 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Almost Ready
        </div>
      )}
      <div className="w-full aspect-square bg-muted relative overflow-hidden flex-shrink-0">
        <img
          src={recipe.image}
          alt={recipe.title}
          className="w-full h-full object-cover"
        />

        {showEditDelete && onDelete && (
          <div className="absolute top-2 left-2">
            <Button
              variant="ghost"
              size="icon"
              className="bg-white/90 backdrop-blur-md h-7 w-7 rounded-full border border-black/10"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              data-testid={`button-delete-${recipe.id}`}
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-1">
          {showEditDelete && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="bg-white/90 backdrop-blur-md h-7 w-7 rounded-full border border-black/10"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              data-testid={`button-edit-${recipe.id}`}
            >
              <Pencil className="w-3 h-3 text-blue-500" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="bg-white/90 backdrop-blur-md h-7 w-7 rounded-full border border-black/10"
            onClick={(e) => onToggleFavorite(e, recipe)}
            data-testid={`button-favorite-${recipe.id}`}
          >
            <Heart className={`w-3 h-3 text-pink-500 ${isFavorite ? "fill-current" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-white/90 backdrop-blur-md h-7 w-7 rounded-full border border-black/10"
            onClick={(e) => onShare(e, recipe.id, recipe.title)}
            data-testid={`button-share-${recipe.id}`}
          >
            <Share2 className="w-3 h-3 text-orange-500" />
          </Button>
        </div>

        {overlapBadge && (
          <div className="absolute bottom-2 left-2">
            {overlapBadge}
          </div>
        )}
      </div>
      <CardContent className="p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground -mt-1 -mb-1">
          <span className="flex items-center gap-1" data-testid={`text-time-${recipe.id}`}>
            <Clock className="w-3 h-3" /> {recipe.total_time_minutes ? formatMinutesHumanReadable(recipe.total_time_minutes) : recipe.totalTime}
          </span>
          <StarRating rating={averageRating} size="sm" />
        </div>
        <h3 className="font-semibold text-sm line-clamp-2">{recipe.title}</h3>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="grid grid-cols-4 gap-1">
            <div className="relative overflow-hidden rounded bg-white/70 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)] py-0.5 flex flex-col items-center">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff6300] to-[#ff8533]" />
              <span className="text-[10px] font-extrabold text-[#ff6300] leading-none mt-[3px]">{recipe.protein}g</span>
              <span className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[1px]">Protein</span>
            </div>
            <div className="relative overflow-hidden rounded bg-white/70 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)] py-0.5 flex flex-col items-center">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#2ecc71] to-[#27ae60]" />
              <span className="text-[10px] font-extrabold text-[#2ecc71] leading-none mt-[3px]">{recipe.carbs}g</span>
              <span className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[1px]">Carbs</span>
            </div>
            <div className="relative overflow-hidden rounded bg-white/70 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)] py-0.5 flex flex-col items-center">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#3498db] to-[#2980b9]" />
              <span className="text-[10px] font-extrabold text-[#3498db] leading-none mt-[3px]">{recipe.fat}g</span>
              <span className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[1px]">Fat</span>
            </div>
            <div className="relative overflow-hidden rounded bg-white/70 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)] py-0.5 flex flex-col items-center">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#f1c40f] to-[#e67e22]" />
              <span className="text-[10px] font-extrabold text-[#e67e22] leading-none mt-[3px]">{recipe.calories}</span>
              <span className="text-[7px] font-semibold text-gray-400 uppercase tracking-wider leading-none mt-[1px]">Calories</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
