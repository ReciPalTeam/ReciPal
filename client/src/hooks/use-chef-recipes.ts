import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type ChefRecipeStep = { instruction: string; time: string | null; location: string | null };

export interface ChefRecipe {
  id: number;
  chefId: number;
  title: string;
  description: string | null;
  photoUrl: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  passiveTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  servings: number | null;
  ingredients: { name: string; amount: string; unit: string }[];
  // Object shape; legacy rows may still be strings — render code must handle both.
  steps: (ChefRecipeStep | string)[];
  source: "manual" | "gpt_extracted" | "cloned_from_public";
  sourceTranscript: string | null;
  nutrition: {
    calories: number; protein: number; carbs: number; fat: number;
    saturatedFat: number; polyunsaturatedFat: number; monounsaturatedFat: number; transFat: number;
    fiber: number; sugar: number; addedSugars: number;
    cholesterol: number; sodium: number; potassium: number; calcium: number; iron: number;
    vitaminA: number; vitaminC: number; vitaminD: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChefRecipeInput {
  title: string;
  description?: string | null;
  photoUrl?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  passiveTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  servings?: number | null;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: ChefRecipeStep[];
  source?: "manual" | "gpt_extracted" | "cloned_from_public";
  sourceTranscript?: string | null;
}

const MY_RECIPES_KEY = ["/api/chef-recipes/me"] as const;

/** List the currently-signed-in chef's own recipes. */
export function useMyChefRecipes() {
  return useQuery<{ recipes: ChefRecipe[] }>({
    queryKey: MY_RECIPES_KEY,
    queryFn: async () => {
      const res = await fetch("/api/chef-recipes/me", { credentials: "include" });
      if (res.status === 401) return { recipes: [] };
      if (!res.ok) throw new Error("Failed to load chef recipes");
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}

/** Fetch one chef recipe by id (with the authoring chef joined). */
export function useChefRecipe(id: number | string | undefined) {
  return useQuery<{ recipe: ChefRecipe & { chef: { handle: string; displayName: string; avatarUrl: string | null } } }>({
    queryKey: ["/api/chef-recipes", id ? Number(id) : null] as const,
    enabled: id != null,
    queryFn: async () => {
      const res = await fetch(`/api/chef-recipes/${id}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Recipe not found");
        throw new Error("Failed to load recipe");
      }
      return res.json();
    },
    retry: false,
  });
}

export function useCreateChefRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChefRecipeInput) => {
      const res = await fetch("/api/chef-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to create recipe");
      return body as { recipe: ChefRecipe };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_RECIPES_KEY });
    },
  });
}

export function useUpdateChefRecipe(id: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ChefRecipeInput>) => {
      const res = await fetch(`/api/chef-recipes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to update recipe");
      return body as { recipe: ChefRecipe };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_RECIPES_KEY });
      qc.invalidateQueries({ queryKey: ["/api/chef-recipes", id] });
    },
  });
}

/** Owner-only delete of a chef recipe. Invalidates the chef's library lists. */
export function useDeleteChefRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/chef-recipes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to delete recipe");
      return body as { deleted: true };
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: MY_RECIPES_KEY });
      qc.invalidateQueries({ queryKey: ["/api/chef-recipes", id] });
      // Also invalidate the public-by-handle list since the recipe appears on /chef/:handle
      qc.invalidateQueries({ queryKey: ["/api/chef"] });
    },
  });
}

export function useUploadRecipePhoto() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/chef-recipes/photo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Photo upload failed");
      return body as { photoUrl: string };
    },
  });
}
