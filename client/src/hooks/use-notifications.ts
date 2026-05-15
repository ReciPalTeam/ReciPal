import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface NotificationItem {
  id: number;
  type: "like" | "save" | "comment";
  reelId: number | null;
  commentId: number | null;
  readAt: string | null;
  createdAt: string;
  actorUserId: number;
  actorUsername: string;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  reelTitle: string | null;
  reelThumbnail: string | null;
  commentBody: string | null;
}

interface NotificationsPage {
  notifications: NotificationItem[];
  nextCursor: number | null;
}

const UNREAD_KEY = ["/api/notifications/unread-count"] as const;
const LIST_KEY = ["/api/notifications"] as const;

export function useNotifications(limit = 30) {
  return useInfiniteQuery<NotificationsPage>({
    queryKey: [...LIST_KEY, { limit }] as const,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (pageParam != null) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/notifications?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/**
 * Lightweight badge-only count. Polls every 30s while the tab is focused so the bell
 * stays roughly fresh without subscribing via Realtime (deferred follow-up).
 */
export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: UNREAD_KEY,
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
      if (res.status === 401) return { count: 0 };
      if (!res.ok) throw new Error("Failed to load unread count");
      return res.json();
    },
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark read");
      return res.json();
    },
    onMutate: async () => {
      // Optimistically zero the badge.
      await qc.cancelQueries({ queryKey: UNREAD_KEY });
      const previous = qc.getQueryData<{ count: number }>(UNREAD_KEY);
      qc.setQueryData(UNREAD_KEY, { count: 0 });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(UNREAD_KEY, context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_KEY });
    },
  });
}
