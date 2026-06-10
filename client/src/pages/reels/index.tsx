import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Clapperboard, Loader2, ChefHat, AlertCircle, Volume2, VolumeX } from "lucide-react";
import { useReelsFeed } from "@/hooks/use-reels";
import { useChefMe } from "@/hooks/use-chef";
import { useCreatorMode } from "@/lib/creator-mode-store";
import { useReelsFeedStore } from "@/lib/reels-feed-store";
import { ReelPlayer } from "@/components/reel-player";
import { Button } from "@/components/ui/button";
import { ExpandingSearch } from "@/components/expanding-search";

export default function ReelsPage() {
  const feedType = useReelsFeedStore((s) => s.feedType);
  const setFeedType = useReelsFeedStore((s) => s.setFeedType);
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useReelsFeed(10, feedType);
  const { data: chefData } = useChefMe();
  const isCreatorMode = useCreatorMode((s) => s.isCreatorMode);

  // The expanded search field (w-[min(92vw,420px)]) spans the whole top-control row, so while
  // it's open the Discover/Following toggle and mute button fade out (opacity + pointer-events;
  // they're fixed-position, so nothing reflows) instead of sitting underneath it.
  const [searchOpen, setSearchOpen] = useState(false);
  const hideWhileSearching = searchOpen
    ? "opacity-0 pointer-events-none"
    : "opacity-100";

  // Fixed-position search overlay shared by every render branch (loading / error / empty / feed).
  // Top baseline (80px) = 56px header (h-14) + 12px top strip + 12px gap; shared by search, the
  // Discover/Following toggle, and the mute button so all three top controls sit on one line,
  // clearly below the top strip (not merged with it). All are 44px (h-11).
  const searchOverlay = (
    <ExpandingSearch className="fixed top-[80px] left-4 z-40" onOpenChange={setSearchOpen} />
  );

  // Discover/Following toggle — fixed top-center, shown on every render branch. Black-glass
  // track (bg-black/30 + backdrop-blur-sm) matches the mute button and action rail; blur-sm
  // deliberately — the generic `.dark .backdrop-blur-md` override would repaint blur-md glass
  // white in dark mode. The active segment fills its full shape (no outer gap) — overflow-hidden
  // clips it to the pill so the selected side rounds to the track edge and butts flush against
  // the other at the seam.
  const feedToggle = (
    <div className={`fixed top-[80px] left-1/2 -translate-x-1/2 z-40 transition-opacity duration-200 ${hideWhileSearching}`}>
      <div className="flex h-11 items-stretch rounded-full bg-black/30 backdrop-blur-sm overflow-hidden" data-testid="reels-feed-toggle">
        {(["discover", "following"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFeedType(t)}
            className={`no-bevel flex items-center px-5 text-sm font-semibold transition-colors ${
              feedType === t ? "bg-recipal-orange text-white" : "text-white"
            }`}
            data-testid={`reels-tab-${t}`}
          >
            {t === "discover" ? "Discover" : "Following"}
          </button>
        ))}
      </div>
    </div>
  );

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
        {searchOverlay}
        {feedToggle}
        <div className="h-[calc(100dvh-9rem)] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        {searchOverlay}
        {feedToggle}
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
    // Following feed with no results → tailored empty state (CTA back to Discover).
    if (feedType === "following") {
      return (
        <>
          {searchOverlay}
          {feedToggle}
          <div className="h-[calc(100dvh-9rem)] flex flex-col items-center justify-center px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-recipal-orange/10 flex items-center justify-center mb-4">
              <ChefHat className="w-10 h-10 text-recipal-orange" />
            </div>
            <h1 className="text-xl font-bold text-recipal-deep-green dark:text-foreground mb-2">No reels from people you follow</h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              Follow some chef creators and their latest reels show up here.
            </p>
            <Button onClick={() => setFeedType("discover")} className="mt-5 bg-recipal-orange hover:bg-recipal-orange/90 text-white" data-testid="button-go-discover">
              Discover creators
            </Button>
          </div>
        </>
      );
    }
    return (
      <>
        {searchOverlay}
        {feedToggle}
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
      {searchOverlay}
      {feedToggle}
      {/* Mute toggle — lifted out of the per-reel player into the shared overlay layer so it sits
          on the same 64px baseline as search + toggle, and shares the action rail's right column
          (right-3) and size (h-11). isMuted is page-level state, so one control mutes all reels. */}
      <button
        onClick={() => setIsMuted((m) => !m)}
        className={`fixed top-[80px] right-3 z-40 w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white transition-opacity duration-200 ${hideWhileSearching}`}
        data-testid="button-mute-toggle"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
      {/* Three-row layout: top strip — scrolling reels — bottom strip (matches action-bar
          color). The 12px strips replace the previous pt-3-on-feed approach. The top strip is
          transparent in light mode so the body's warm bloom flows from the (transparent) header
          down to the feed with no white band; dark keeps bg-card to match the solid gunmetal
          header above it. */}
      <div className="h-[calc(100dvh-7.5rem)] flex flex-col">
        <div className="h-3 bg-transparent dark:bg-card flex-shrink-0" />
        <div
          key={feedType}
          ref={containerRef}
          className={`flex-1 overflow-y-scroll snap-y snap-mandatory bg-black scrollbar-none animate-in fade-in duration-300 ${
            feedType === "following" ? "slide-in-from-right-8" : "slide-in-from-left-8"
          }`}
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
