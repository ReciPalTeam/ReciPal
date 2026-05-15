import { BookOpen, Sparkles, ChefHat } from "lucide-react";
import { useMyChefRecipes } from "@/hooks/use-chef-recipes";

interface RecipeChoiceStepProps {
  onPickExisting: () => void;
  onGenerate: () => void;
}

/**
 * First step of the upload flow (after picking a video). Asks the creator whether to
 * attach an existing recipe to this reel or generate a brand new one from the video's
 * audio + transcription.
 */
export function RecipeChoiceStep({ onPickExisting, onGenerate }: RecipeChoiceStepProps) {
  const { data: myRecipes } = useMyChefRecipes();
  const myCount = myRecipes?.recipes.length ?? 0;

  return (
    <div className="space-y-3">
      <header>
        <h2 className="text-lg font-bold text-recipal-deep-green dark:text-foreground">What recipe is this for?</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Attach an existing recipe or generate a new one from the video.
        </p>
      </header>

      <button
        onClick={onPickExisting}
        className="w-full flex items-center gap-3 p-4 rounded-2xl border bg-card hover:bg-muted/40 transition-colors text-left"
        data-testid="button-pick-existing"
      >
        <div className="w-11 h-11 rounded-full bg-recipal-deep-green/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-recipal-deep-green dark:text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-recipal-deep-green dark:text-foreground">
            Pick an existing recipe
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {myCount > 0
              ? `${myCount} of your recipes${myCount === 1 ? "" : ""} + every recipe in ReciPal`
              : "Your library is empty — pick from ReciPal's recipe library instead"}
          </p>
        </div>
      </button>

      <button
        onClick={onGenerate}
        className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-recipal-orange/40 bg-gradient-to-br from-recipal-orange/10 to-recipal-orange/5 hover:from-recipal-orange/15 hover:to-recipal-orange/10 transition-colors text-left relative overflow-hidden"
        data-testid="button-generate-new"
      >
        <div className="w-11 h-11 rounded-full bg-recipal-orange flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_rgba(255,99,0,0.35)]">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-recipal-deep-green dark:text-foreground">
            Generate a new recipe from the video
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            We'll listen to your video and pull out ingredients, times, and steps. You can edit everything before continuing.
          </p>
        </div>
      </button>

      <div className="flex items-center gap-2 px-2 py-1.5 mt-1 rounded-md bg-muted/30">
        <ChefHat className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          New recipes you generate are added to your public recipe library.
        </p>
      </div>
    </div>
  );
}
