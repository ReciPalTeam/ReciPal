import { Link } from "wouter";
import { BarChart3, Eye, Heart, Bookmark, Share2, MessageCircle, Loader2, Play, AlertCircle, Clapperboard } from "lucide-react";
import { useChefAnalytics } from "@/hooks/use-chef-analytics";

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`.replace(".0", "");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0", "");
}

interface StatTile {
  Icon: typeof Eye;
  label: string;
  value: number;
  tint: string;
}

export default function ChefAnalyticsPage() {
  const { data, isLoading, isError, error } = useChefAnalytics();

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-semibold">Analytics unavailable</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{(error as Error)?.message ?? "Try again later."}</p>
      </div>
    );
  }

  if (!data) return null;

  const tiles: StatTile[] = [
    { Icon: Eye,           label: "Views",    value: data.totals.totalViews,    tint: "text-blue-500" },
    { Icon: Heart,         label: "Likes",    value: data.totals.totalLikes,    tint: "text-red-500" },
    { Icon: Bookmark,      label: "Saves",    value: data.totals.totalSaves,    tint: "text-recipal-orange" },
    { Icon: MessageCircle, label: "Comments", value: data.totals.totalComments, tint: "text-blue-400" },
    { Icon: Share2,        label: "Shares",   value: data.totals.totalShares,   tint: "text-purple-500" },
  ];

  return (
    <div className="px-4 py-6 pb-24 max-w-md mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-recipal-orange flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-recipal-deep-green dark:text-foreground">
            Creator Stats
          </h1>
          <p className="text-xs text-muted-foreground">
            {data.totals.reelCount === 0
              ? "Upload your first reel to start tracking."
              : `Across ${data.totals.reelCount} published reel${data.totals.reelCount === 1 ? "" : "s"}.`}
          </p>
        </div>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(({ Icon, label, value, tint }) => (
          <div
            key={label}
            className="rounded-2xl border bg-card p-3 flex flex-col items-center"
            data-testid={`stat-${label.toLowerCase()}`}
          >
            <Icon className={`w-5 h-5 ${tint} mb-1`} />
            <p className="text-lg font-extrabold tabular-nums text-recipal-deep-green dark:text-foreground">
              {formatCount(value)}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Top reels */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Top reels by views
        </h2>
        {data.topReels.length === 0 ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <Clapperboard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No reels yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Your top performers will show up here.
            </p>
            <Link href="/chef/upload">
              <button className="mt-3 text-sm font-semibold text-recipal-orange hover:underline">
                Upload your first reel →
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {data.topReels.map((reel, idx) => (
              <Link key={reel.id} href={`/chef/${data.chef.handle}`}>
                <div
                  className="flex items-center gap-3 rounded-xl border bg-card p-2 cursor-pointer hover:bg-muted/30 transition-colors"
                  data-testid={`top-reel-${reel.id}`}
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-recipal-orange/15 flex items-center justify-center">
                    <span className="text-xs font-bold text-recipal-orange">{idx + 1}</span>
                  </div>
                  <div className="flex-shrink-0 w-12 h-16 rounded-md overflow-hidden bg-black">
                    {reel.thumbnailUrl ? (
                      <img src={reel.thumbnailUrl} alt={reel.title ?? "Reel"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-recipal-deep-green/20 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white/70" fill="currentColor" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {reel.title ?? "Untitled reel"}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(reel.viewCount)}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatCount(reel.likeCount)}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatCount(reel.commentCount)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center pt-2">
        Stats refresh roughly every minute. Watch-time and per-region breakdowns are deferred to a future phase.
      </p>
    </div>
  );
}
