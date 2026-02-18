import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Share2, Clock, Users, Plus, Sparkles, Pencil, Trash2 } from "lucide-react";
import type { Recipe } from "@/lib/mock-data";
import logoUrl from "@assets/Recipal_Logo_FILL_1768337767642.png";
import type { ReactNode } from "react";

interface RecipeCardProps {
  recipe: Recipe & {
    isInjected?: boolean;
  };
  onCardClick: (recipeId: string) => void;
  onToggleFavorite: (e: React.MouseEvent, recipe: Recipe) => void;
  onShare: (e: React.MouseEvent, recipeId: string, recipeTitle: string) => void;
  isFavorite: boolean;
  overlapBadge?: ReactNode;
  showLogo?: boolean;
  showEditDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function RecipeCard({
  recipe,
  onCardClick,
  onToggleFavorite,
  onShare,
  isFavorite,
  overlapBadge,
  showLogo = false,
  showEditDelete = false,
  onEdit,
  onDelete,
}: RecipeCardProps) {
  return (
    <Card
      className="overflow-hidden cursor-pointer relative shadow-[0_0_8px_rgba(0,0,0,0.35)] border-0 flex flex-col h-full"
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
        <div className="absolute top-2 right-2 flex gap-1">
          {showEditDelete && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl h-7 w-7 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              data-testid={`button-edit-${recipe.id}`}
            >
              <Pencil className="w-3 h-3 text-blue-500" />
            </Button>
          )}
          {showEditDelete && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl h-7 w-7 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              data-testid={`button-delete-${recipe.id}`}
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl h-7 w-7 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
            onClick={(e) => onToggleFavorite(e, recipe)}
            data-testid={`button-favorite-${recipe.id}`}
          >
            <Heart className={`w-3 h-3 text-pink-500 ${isFavorite ? "fill-current" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl h-7 w-7 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
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

        {showLogo && (
          <div className="absolute top-2 left-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 shadow-sm border border-white/70">
              <img src={logoUrl} alt="ReciPal" className="h-4 w-auto object-contain" />
            </div>
          </div>
        )}
      </div>
      <CardContent className="p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground -mt-1 -mb-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {recipe.cookTime}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" /> {recipe.servings}
          </span>
        </div>
        <h3 className="font-semibold text-sm line-clamp-2">{recipe.title}</h3>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex gap-1 justify-center">
            <div className="bg-recipal-orange/10 border border-recipal-orange/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
              <span className="text-[10px] font-bold text-recipal-orange leading-none">{recipe.protein}g</span>
              <span className="text-[7px] text-muted-foreground leading-none mt-[1px]">Protein</span>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
              <span className="text-[10px] font-bold text-primary leading-none">{recipe.carbs}g</span>
              <span className="text-[7px] text-muted-foreground leading-none mt-[1px]">Carbs</span>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 leading-none">{recipe.fat}g</span>
              <span className="text-[7px] text-muted-foreground leading-none mt-[1px]">Fat</span>
            </div>
            <div className="bg-yellow-100/30 border border-yellow-500/20 rounded px-1 py-0.5 flex flex-col items-center min-w-[34px]">
              <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 leading-none">{recipe.calories}</span>
              <span className="text-[7px] text-black dark:text-white leading-none mt-[1px]">Calories</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 pt-[2.5px]">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-full text-[11px] gap-1 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white rounded-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 font-bold px-4 mt-[1px]"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick(recipe.id);
              }}
              data-testid={`button-add-plan-${recipe.id}`}
            >
              <Plus className="w-[12px] h-[12px]" /> Add Recipe
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
