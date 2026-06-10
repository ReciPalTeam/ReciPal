import { useMemo, useEffect, useRef } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { Hash, Loader2, Play, AlertCircle, Clapperboard, ArrowLeft } from "lucide-react";
import { useHashtag, useHashtagReels } from "@/hooks/use-search";
import { Button } from "@/components/ui/button";
import { goBack } from "@/lib/back";

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`.replace(".0", "");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0", "");
}

export default function HashtagPage() {
  const [, params] = useRoute<{ tag: string }>("/hashtag/:tag");
  const [, setLocation] = useLocation();
  const tag = params?.tag?.toLowerCase();

  const { data: hashtagData, isLoading: hashtagLoading, error: hashtagError } = useHashtag(tag);
  const reelsQuery = useHashtagReels(tag, 12);

  const reels = useMemo(
    () => reelsQuery.data?.pages.flatMap((p) => p.reels) ?? [],
    [reelsQuery.data]
  );

  // Infinite-scroll sentinel for the grid.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !reelsQuery.hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !reelsQuery.isFetchingNextPage) {
        reelsQuery.fetchNextPage();
      }
    }, { threshold: 0.1 });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [reelsQuery.hasNextPage, reelsQuery.isFetchingNextPage, reelsQuery.fetchNextPage, reels.length]);

  if (hashtagLoading) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hashtagError || !hashtagData?.hashtag) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-semibold">Hashtag not found</p>
        <p className="text-xs text-muted-foreground mt-1">
          No one has tagged a reel with #{tag} yet.
        </p>
        <Link href="/reels">
          <Button variant="ghost" className="mt-4 text-recipal-orange">Back to Reels</Button>
        </Link>
      </div>
    );
  }

  const { tag: canonicalTag, usageCount } = hashtagData.hashtag;

  return (
    <div className="pb-24">
      <div className="px-6 pt-4 pb-6 bg-gradient-to-b from-recipal-orange/10 to-transparent">
        {/* Back to wherever the user came from (reels feed or search) */}
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goBack(setLocation, "/reels")}
            className="-ml-2"
            data-testid="button-hashtag-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="max-w-md mx-auto flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-recipal-orange/15 flex items-center justify-center mb-3">
            <Hash className="w-10 h-10 text-recipal-orange" />
          </div>
          <h1 className="text-2xl font-bold text-recipal-deep-green dark:text-foreground" data-testid="text-hashtag-tag">
            #{canonicalTag}
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5">
            {formatCount(usageCount)} reel{usageCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4">
        {reelsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : reels.length === 0 ? (
          <div className="text-center py-12">
            <Clapperboard className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No public reels yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {reels.map((reel) => (
                <Link key={reel.id} href={`/chef/${reel.chefHandle}`}>
                  <div
                    className="aspect-[9/16] rounded-md overflow-hidden bg-black relative cursor-pointer"
                    data-testid={`hashtag-reel-${reel.id}`}
                  >
                    {reel.thumbnailUrl ? (
                      <img
                        src={reel.thumbnailUrl}
                        alt={reel.title ?? "Reel"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-recipal-deep-green/20 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white/70" fill="currentColor" />
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 text-[10px] font-semibold text-white drop-shadow-md truncate max-w-[60%]">
                      @{reel.chefHandle}
                    </div>
                    <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded px-1 py-0.5 text-[9px] font-semibold text-white">
                      <Play className="w-2.5 h-2.5" fill="currentColor" />
                      {formatCount(reel.viewCount)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {reelsQuery.hasNextPage && (
              <div ref={sentinelRef} className="h-1 mt-4" />
            )}
            {reelsQuery.isFetchingNextPage && (
              <div className="flex justify-center mt-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
