import { useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { Bell, Heart, Bookmark, MessageCircle, Loader2, User as UserIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotifications, useMarkNotificationsRead, type NotificationItem } from "@/hooks/use-notifications";

const typeMeta: Record<NotificationItem["type"], { Icon: typeof Heart; color: string; verb: string }> = {
  like:    { Icon: Heart,         color: "text-red-500",        verb: "liked your reel" },
  save:    { Icon: Bookmark,      color: "text-recipal-orange", verb: "saved your reel" },
  comment: { Icon: MessageCircle, color: "text-blue-500",       verb: "commented on your reel" },
};

export default function NotificationsPage() {
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = useNotifications(30);
  const markRead = useMarkNotificationsRead();
  const hasMarked = useRef(false);

  // On first mount with notifications, mark all as read. Use the ref so we don't loop
  // re-marking after the optimistic count flips to 0.
  useEffect(() => {
    if (hasMarked.current) return;
    if (data && data.pages.some((p) => p.notifications.some((n) => n.readAt === null))) {
      hasMarked.current = true;
      markRead.mutate();
    }
  }, [data, markRead]);

  const items = useMemo(() => data?.pages.flatMap((p) => p.notifications) ?? [], [data]);

  // Infinite-scroll sentinel.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { threshold: 0.1 });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  return (
    <div className="px-4 py-6 pb-24 max-w-md mx-auto">
      <header className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-recipal-orange flex items-center justify-center">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-recipal-deep-green dark:text-foreground">Activity</h1>
          <p className="text-xs text-muted-foreground">Likes, comments, and saves on your reels.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="text-center py-12">
          <p className="text-sm text-destructive">Couldn't load notifications</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Nothing yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            When someone likes or comments on your reels, it'll show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((n) => {
            const meta = typeMeta[n.type];
            const Icon = meta.Icon;
            const actorName = n.actorDisplayName || n.actorUsername?.split("@")[0] || "Someone";
            const wasUnread = n.readAt === null;
            return (
              <Link key={n.id} href="/reels">
                <div
                  className={`flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors hover:bg-muted/40 ${
                    wasUnread ? "bg-recipal-orange/5" : ""
                  }`}
                  data-testid={`notification-${n.id}`}
                >
                  {/* Actor avatar with action-type badge */}
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-recipal-orange/15 flex items-center justify-center overflow-hidden">
                      {n.actorAvatarUrl ? (
                        <img src={n.actorAvatarUrl} alt={actorName} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-recipal-orange" />
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-card flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                      <Icon className={`w-3 h-3 ${meta.color}`} fill="currentColor" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-semibold">{actorName}</span>{" "}
                      <span className="text-muted-foreground">{meta.verb}</span>
                      {wasUnread && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-recipal-orange ml-1.5 align-middle" />
                      )}
                    </p>
                    {n.commentBody && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic line-clamp-1">"{n.commentBody}"</p>
                    )}
                    {n.reelTitle && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">on "{n.reelTitle}"</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {n.reelThumbnail && (
                    <div className="w-12 h-16 rounded-md overflow-hidden bg-black flex-shrink-0">
                      <img src={n.reelThumbnail} alt={n.reelTitle ?? "Reel"} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          {hasNextPage && (
            <div ref={sentinelRef} className="h-px" />
          )}
          {isFetchingNextPage && (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
