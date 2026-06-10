import { useToast } from "@/hooks/use-toast";
import { useUpdateChefRecipe, type ChefRecipe, type ChefRecipeInput } from "@/hooks/use-chef-recipes";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { RecipeForm } from "@/components/recipe-form";

interface ChefRecipeEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: ChefRecipe | null;
}

/**
 * Slide-in sheet that wraps RecipeForm for editing an existing chef recipe.
 * Pre-populates every field from the recipe row, PUTs on submit, and invalidates the
 * relevant React Query caches via the hook so the chef profile + detail page
 * refresh automatically.
 */
export function ChefRecipeEditSheet({ open, onOpenChange, recipe }: ChefRecipeEditSheetProps) {
  const { toast } = useToast();
  const updateRecipe = useUpdateChefRecipe(recipe?.id);

  const handleSubmit = async (payload: ChefRecipeInput) => {
    try {
      await updateRecipe.mutateAsync(payload);
      toast({ title: "Recipe updated" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err?.message ?? "Try again", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
        <SheetHeader>
          <SheetTitle>Edit Recipe</SheetTitle>
          <SheetDescription>
            Update the recipe details. Macros recompute automatically if you change the ingredients.
          </SheetDescription>
        </SheetHeader>

        <div className="pt-6 pb-4">
          {recipe && (
            <RecipeForm
              initial={{
                title: recipe.title,
                description: recipe.description ?? undefined,
                photoUrl: recipe.photoUrl ?? undefined,
                prepTimeMinutes: recipe.prepTimeMinutes ?? undefined,
                cookTimeMinutes: recipe.cookTimeMinutes ?? undefined,
                passiveTimeMinutes: recipe.passiveTimeMinutes ?? undefined,
                servings: recipe.servings ?? undefined,
                ingredients: recipe.ingredients,
                steps: recipe.steps.map((s) =>
                  typeof s === "string"
                    ? { instruction: s, time: null, location: null }
                    : s,
                ),
              }}
              source={recipe.source}
              onSubmit={handleSubmit}
              isSubmitting={updateRecipe.isPending}
              submitLabel="Save changes"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
