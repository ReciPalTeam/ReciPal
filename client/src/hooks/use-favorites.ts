import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Recipe } from "@/lib/mock-data";

/**
 * Phase H.20 — server-persisted favorites via the text-id `userFavoriteRecipes` table
 * (`/api/user-favorites/*`). Carries a recipe payload so favorited recipes (incl. chef recipes,
 * id `"chef:<id>"`) render without a re-fetch. Distinct from the legacy int `useToggleFavorite`.
 */

const IDS_KEY = ["/api/user-favorites/ids"] as const;
const LIST_KEY = ["/api/user-favorites"] as const;

export function useUserFavoriteIds() {
  return useQuery({
    queryKey: IDS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/user-favorites/ids", { credentials: "include" });
      if (!res.ok) return { ids: [] as string[] };
      return (await res.json()) as { ids: string[] };
    },
  });
}

export function useUserFavorites() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async () => {
      const res = await fetch("/api/user-favorites", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load favorites");
      return (await res.json()) as { favorites: Recipe[] };
    },
  });
}

export function useToggleUserFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipe, favorite }: { recipe: Recipe; favorite: boolean }) => {
      const url = `/api/user-favorites/${encodeURIComponent(recipe.id)}`;
      const res = await fetch(
        url,
        favorite
          ? { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ recipe }) }
          : { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to update favorite");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: IDS_KEY });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
