import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import Hls from "hls.js";
import {
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  Volume2,
  VolumeX,
  Play,
  ChefHat,
  Utensils,
  ChevronRight,
} from "lucide-react";
import type { ReelFeedItem } from "@/hooks/use-reels";
import { useToggleLike, useToggleSave } from "@/hooks/use-engagements";
import { CommentsSheet } from "@/components/comments-sheet";
import { ShareSheet } from "@/components/share-sheet";

interface ReelPlayerProps {
  reel: ReelFeedItem;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

// Parse "#tag" patterns and render each as a clickable link to /hashtag/:tag.
function renderDescription(description: string | null, onHashtagClick: (tag: string) => void) {
  if (!description) return null;
  const parts = description.split(/(#[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (!part.startsWith("#")) return <span key={i}>{part}</span>;
    const tag = part.slice(1).toLowerCase();
    return (
      <button
        key={i}
        onClick={(e) => {
          e.stopPropagation();
          onHashtagClick(tag);
        }}
        className="text-recipal-orange font-semibold hover:underline"
        data-testid={`hashtag-link-${tag}`}
      >
        {part}
      </button>
    );
  });
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`.replace(".0", "");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0", "");
}

export function ReelPlayer({ reel, isActive, isMuted, onToggleMute }: ReelPlayerProps) {
  const [, setLocation] = useLocation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();

  // Wire HLS.js (or native Safari) — only when the reel is active to save bandwidth.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = reel.playbackUrl;
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(reel.playbackUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else {
      video.src = reel.playbackUrl;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (video) video.removeAttribute("src");
    };
  }, [isActive, reel.playbackUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive && !isPaused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive, isPaused]);

  useEffect(() => {
    if (!isActive) setIsPaused(false);
  }, [isActive]);

  const handleTapVideo = () => {
    setIsPaused((p) => {
      setShowPauseIcon(true);
      setTimeout(() => setShowPauseIcon(false), 400);
      return !p;
    });
  };

  // Engagement action button — generic styling with active fill + tint colors.
  type ActionButtonProps = {
    Icon: typeof Heart;
    label: string;
    active?: boolean;
    activeColor?: string; // tailwind text-color class for the active state
    onClick: () => void;
    testId: string;
  };
  const ActionButton = ({ Icon, label, active, activeColor, onClick, testId }: ActionButtonProps) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-col items-center gap-1 text-white"
      data-testid={testId}
    >
      <div
        className={`w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-transform ${
          active ? "scale-110" : ""
        }`}
      >
        <Icon
          className={`w-5 h-5 transition-colors ${active ? activeColor : "text-white"}`}
          fill={active ? "currentColor" : "none"}
          strokeWidth={2}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums">{label}</span>
    </button>
  );

  return (
    <div className="relative h-full w-full bg-black overflow-hidden snap-start snap-always" data-testid={`reel-${reel.id}`}>
      <video
        ref={videoRef}
        muted={isMuted}
        playsInline
        loop
        poster={reel.thumbnailUrl || undefined}
        onClick={handleTapVideo}
        className="absolute inset-0 w-full h-full object-cover"
        data-testid={`reel-video-${reel.id}`}
      />

      {showPauseIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            {isPaused ? (
              <Play className="w-10 h-10 text-white" fill="currentColor" />
            ) : (
              <div className="flex gap-2">
                <div className="w-2.5 h-10 bg-white rounded" />
                <div className="w-2.5 h-10 bg-white rounded" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top-right: mute toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white"
        data-testid="button-mute-toggle"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* Right action rail. Order: Like → Comment → Save → Share.
          Save also adds the reel's linked recipe to the user's My Meals (favorites) collection.
          z-10 keeps the action rail above the bottom metadata overlay so the buttons can't
          be obscured by wrapping title/description text. */}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4">
        <ActionButton
          Icon={Heart}
          label={formatCount(reel.likeCount)}
          active={reel.liked}
          activeColor="text-red-500"
          onClick={() => toggleLike.mutate(reel.id)}
          testId={`button-like-${reel.id}`}
        />
        <ActionButton
          Icon={MessageCircle}
          label={formatCount(reel.commentCount)}
          onClick={() => setCommentsOpen(true)}
          testId={`button-comment-${reel.id}`}
        />
        <ActionButton
          Icon={Bookmark}
          label={formatCount(reel.saveCount)}
          active={reel.saved}
          activeColor="text-recipal-orange"
          onClick={() => toggleSave.mutate(reel.id)}
          testId={`button-save-${reel.id}`}
        />
        <ActionButton
          Icon={Share2}
          label={formatCount(reel.shareCount)}
          onClick={() => setShareOpen(true)}
          testId={`button-share-${reel.id}`}
        />
      </div>

      {/* Bottom gradient + metadata overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white pointer-events-none">
        <div className="flex items-center gap-2 mb-2 pr-16 pointer-events-auto">
          <div className="w-8 h-8 rounded-full bg-recipal-orange/30 backdrop-blur-sm flex items-center justify-center overflow-hidden flex-shrink-0">
            {reel.chefAvatarUrl ? (
              <img src={reel.chefAvatarUrl} alt={reel.chefDisplayName} className="w-full h-full object-cover" />
            ) : (
              <ChefHat className="w-4 h-4 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{reel.chefDisplayName}</p>
            <p className="text-[11px] opacity-80 truncate">@{reel.chefHandle}</p>
          </div>
        </div>
        {/* Orange "Open Recipe" CTA — only renders when a recipe is linked. Sits between
            the chef bar and the title. Routes to /chef-recipe/:id if the reel has a chef
            recipe attached; otherwise to the system /recipe/:id detail page. */}
        {(reel.chefRecipeId || reel.recipeId) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (reel.chefRecipeId) {
                setLocation(`/chef-recipe/${reel.chefRecipeId}`);
              } else if (reel.recipeId) {
                setLocation(`/recipe/${reel.recipeId}`);
              }
            }}
            className="no-bevel w-fit mb-2 flex items-center gap-2 rounded-full px-4 py-2 bg-recipal-orange hover:bg-recipal-orange/90 shadow-[0_4px_12px_rgba(255,99,0,0.4)] pointer-events-auto transition-colors"
            data-testid={`button-open-recipe-${reel.id}`}
          >
            <span className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">Open recipe</span>
            </span>
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        )}

        {reel.title && (
          <p className="text-sm font-semibold mb-1 line-clamp-2 pr-16 pointer-events-auto">{reel.title}</p>
        )}
        {reel.description && (
          <p className="text-xs leading-relaxed line-clamp-3 pr-16 pointer-events-auto">
            {renderDescription(reel.description, (tag) => setLocation(`/hashtag/${tag}`))}
          </p>
        )}
      </div>

      {/* Sheets (Radix portals render outside this tree) */}
      <CommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        reelId={reel.id}
        reelChefId={reel.chefId}
      />
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        reelId={reel.id}
        chefHandle={reel.chefHandle}
        reelTitle={reel.title}
        chefDisplayName={reel.chefDisplayName}
      />
    </div>
  );
}
