import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Clapperboard, Loader2, ChefHat, AlertCircle } from "lucide-react";
import { useReelsFeed } from "@/hooks/use-reels";
import { useChefMe } from "@/hooks/use-chef";
import { useCreatorMode } from "@/lib/creator-mode-store";
import { ReelPlayer } from "@/components/reel-player";
import { Button } from "@/components/ui/button";
import { ExpandingSearch } from "@/components/expanding-search";

// Fixed-position search overlay shared by every render branch (loading / error / empty / feed).
const SEARCH_OVERLAY = (
  <ExpandingSearch className="fixed top-[72px] left-4 z-30" />
);

export default function ReelsPage() {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useReelsFeed(10);
  const { data: chefData } = useChefMe();
  const isCreatorMode = useCreatorMode((s) => s.isCreatorMode);

  const reels = useMemo(() => data?.pages.flatMap((p) => p.reels) ?? [], [data]);

  const [activeReelId, setActiveReelId] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true); // Browsers require muted autoplay; user can unmute.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Set first reel as active once data lands.
  useEffect(() => {
    if (activeReelId === null && reels.length > 0) {
      setActiveReelId(reels[0].id);
    }
  }, [reels, activeReelId]);

  // IntersectionObserver: track which reel is "in view" (60%+ visible) and mark it active.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idAttr = (entry.target as HTMLElement).dataset.reelId;
            if (idAttr) setActiveReelId(Number(idAttr));
          }
        }
      },
      { root, threshold: [0, 0.3, 0.6, 0.9] }
    );

    const slides = root.querySelectorAll<HTMLElement>("[data-reel-id]");
    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  // Infinite-scroll sentinel.
  useEffect(() => {
    const root = containerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root, threshold: 0.1 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, reels.length]);

  if (isLoading) {
    return (
      <>
        {SEARCH_OVERLAY}
        <div className="h-[calc(100dvh-9rem)] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        {SEARCH_OVERLAY}
        <div className="h-[calc(100dvh-9rem)] flex flex-col items-center justify-center px-6 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm font-semibold">Couldn't load the feed</p>
          <p className="text-xs text-muted-foreground mt-1">Try again in a moment.</p>
        </div>
      </>
    );
  }

  if (reels.length === 0) {
    const isApprovedChef = chefData?.profile?.isApproved;
    return (
      <>
        {SEARCH_OVERLAY}
        <div className="h-[calc(100dvh-9rem)] flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-recipal-orange/10 flex items-center justify-center mb-4">
            <Clapperboard className="w-10 h-10 text-recipal-orange" />
          </div>
          <h1 className="text-xl font-bold text-recipal-deep-green dark:text-foreground mb-2">
            No reels yet
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isApprovedChef
              ? isCreatorMode
                ? "Tap the orange + button below to upload the first reel."
                : "Switch to Chef Creator Mode (Profile → toggle) and upload the first reel."
              : "Vetted chefs will start posting short cooking videos here soon."}
          </p>
          {isApprovedChef && (
            <Link href="/chef/upload">
              <Button className="mt-5 bg-recipal-orange hover:bg-recipal-orange/90 text-white">
                <ChefHat className="w-4 h-4 mr-2" /> Upload a reel
              </Button>
            </Link>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {SEARCH_OVERLAY}
      {/* Three-row layout: top strip (matches top-bar color) — scrolling reels — bottom strip
          (matches action-bar color). The 12px strips replace the previous pt-3-on-feed approach
          so each strip can carry its own background to blend with the chrome above/below. */}
      <div className="h-[calc(100dvh-7.5rem)] flex flex-col">
        <div className="h-3 bg-[#FDFCFB] dark:bg-card flex-shrink-0" />
        <div
          ref={containerRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-none"
          data-testid="reels-feed"
          style={{ scrollbarWidth: "none" }}
        >
          {reels.map((reel) => (
            <div
              key={reel.id}
              data-reel-id={reel.id}
              className="h-full w-full snap-start snap-always"
            >
              <ReelPlayer
                reel={reel}
                isActive={activeReelId === reel.id}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted((m) => !m)}
              />
            </div>
          ))}
          {hasNextPage && (
            <div ref={sentinelRef} className="h-px w-full" data-testid="sentinel-next-page" />
          )}
          {isFetchingNextPage && (
            <div className="h-12 flex items-center justify-center bg-black">
              <Loader2 className="w-5 h-5 animate-spin text-white/60" />
            </div>
          )}
        </div>
        <div className="h-3 bg-white dark:bg-card flex-shrink-0" />
      </div>
    </>
  );
}
