import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useCurrentPlan() {
  return useQuery({
    queryKey: [api.plans.current.path],
    queryFn: async () => {
      const res = await fetch(api.plans.current.path, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch plan");
      return await res.json(); // Complex type, trusting backend for now
    },
  });
}

export function useGeneratePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.plans.generate.path, {
        method: api.plans.generate.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate plan");
      return api.plans.generate.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.plans.current.path] }),
  });
}

export function useRefreshMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mealId: number) => {
      const url = buildUrl(api.meals.refresh.path, { id: mealId });
      const res = await fetch(url, {
        method: api.meals.refresh.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to refresh meal");
      return api.meals.refresh.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.plans.current.path] }),
  });
}

export function useToggleMealLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, locked }: { id: number; locked: boolean }) => {
      const url = buildUrl(api.meals.toggleLock.path, { id });
      const res = await fetch(url, {
        method: api.meals.toggleLock.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to toggle lock");
      return api.meals.toggleLock.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.plans.current.path] }),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: [api.dashboard.get.path],
    queryFn: async () => {
      const res = await fetch(api.dashboard.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return api.dashboard.get.responses[200].parse(await res.json());
    },
  });
}

export function useCart() {
  return useQuery({
    queryKey: [api.cart.get.path],
    queryFn: async () => {
      const res = await fetch(api.cart.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cart");
      return await res.json();
    },
  });
}

export function useFavoriteIds() {
  return useQuery({
    queryKey: [api.favorites.ids.path],
    queryFn: async () => {
      const res = await fetch(api.favorites.ids.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch favorite IDs");
      return api.favorites.ids.responses[200].parse(await res.json()) as number[];
    },
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: [api.favorites.list.path],
    queryFn: async () => {
      const res = await fetch(api.favorites.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch favorites");
      return await res.json();
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipeId, isFavorite }: { recipeId: number; isFavorite: boolean }) => {
      const url = buildUrl(api.favorites.add.path, { recipeId });
      const method = isFavorite ? "DELETE" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.favorites.ids.path] });
      queryClient.invalidateQueries({ queryKey: [api.favorites.list.path] });
    },
  });
}
