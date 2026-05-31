import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useChefMe, useUpdateChef, useUploadChefAvatar, usePublicChefReels, usePublicChefRecipes } from "@/hooks/use-chef";
import { useDeleteChefRecipe, type ChefRecipe } from "@/hooks/use-chef-recipes";
import { useDeleteReel } from "@/hooks/use-reels";
import { ChefRecipeEditSheet } from "@/components/chef-recipe-edit-sheet";
import { FollowersSheet } from "@/components/followers-sheet";
import { ReelEditSheet } from "@/components/reel-edit-sheet";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import {
  ChefHat, Camera, Loader2, Save, AlertCircle, Settings as SettingsIcon,
  Play, BarChart3, Eye, Heart, ShoppingBag, Share2, MessageCircle, Clapperboard, Utensils,
  Users, Percent, Pencil,
} from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { RecipeCard } from "@/components/recipe-card";
import { chefRecipeToRecipe, extractChefRecipeId } from "@/lib/chef-recipe-adapter";

const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`.replace(".0", "");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0", "");
}

interface ReelMetrics {
  id: number;
  title: string | null;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
  engagementRate: number; // %
}
interface ChefAnalytics {
  chef: { id: number; handle: string; displayName: string };
  totals: {
    reelCount: number;
    totalViews: number;
    totalLikes: number;
    totalSaves: number;
    totalShares: number;
    totalComments: number;
  };
  followerCount: number;
  engagementRate: number; // %
  followerGrowth: Array<{ week: string; count: number }>;
  engagementGrowth: Array<{ week: string; count: number }>;
  reels: ReelMetrics[];
  topReels: ReelMetrics[];
}

/**
 * Creator Page — the chef's own public-style profile, with a Stats toggle and a
 * Settings sheet for editing display name / handle / bio / avatar.
 */
export default function ChefMyPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: chefData, isLoading } = useChefMe();
  const updateChef = useUpdateChef();
  const uploadAvatar = useUploadChefAvatar();
  const [followersOpen, setFollowersOpen] = useState(false);

  const profile = chefData?.profile;
  const handle = profile?.handle;

  // Public view data — same hooks as /chef/[handle] so the rendering matches pixel-for-pixel.
  const reelsQuery = usePublicChefReels(handle, 12);
  const recipesQuery = usePublicChefRecipes(handle, 24);

  // Stats view data
  const analyticsQuery = useQuery({
    queryKey: ["/api/chef/analytics"] as const,
    queryFn: async (): Promise<ChefAnalytics> => {
      const res = await fetch("/api/chef/analytics", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    enabled: !!handle,
    staleTime: 60_000,
  });

  const [activeView, setActiveView] = useState<"public" | "stats">("public");
  const [activeTab, setActiveTab] = useState<"reels" | "recipes">("reels");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<ChefRecipe | null>(null);
  const [deletingRecipeId, setDeletingRecipeId] = useState<number | null>(null);
  const [deletingReelId, setDeletingReelId] = useState<number | null>(null);
  const [editingReel, setEditingReel] = useState<{ id: number; title: string | null; description: string | null } | null>(null);
  const deleteRecipe = useDeleteChefRecipe();
  const deleteReel = useDeleteReel();

  // Settings form state
  const [displayName, setDisplayName] = useState("");
  const [handleValue, setHandleValue] = useState("");
  const [bio, setBio] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAvatarDataUrl, setPendingAvatarDataUrl] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setHandleValue(profile.handle ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-semibold">You're not a Chef Creator yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Apply from the hamburger menu. After approval you'll be able to edit your chef profile here.
        </p>
      </div>
    );
  }

  const handleSaveSettings = async () => {
    const trimmedHandle = handleValue.trim().toLowerCase();
    if (trimmedHandle !== profile.handle && !HANDLE_REGEX.test(trimmedHandle)) {
      toast({ title: "Invalid handle", description: "3-30 lowercase letters, numbers, or underscores only.", variant: "destructive" });
      return;
    }
    if (displayName.trim().length < 2) {
      toast({ title: "Display name too short", variant: "destructive" });
      return;
    }
    try {
      await updateChef.mutateAsync({ displayName: displayName.trim(), bio: bio.trim(), handle: trimmedHandle });
      toast({ title: "Profile updated" });
      setSettingsOpen(false);
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err?.message ?? "", variant: "destructive" });
    }
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Pick an image file", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Image too large", description: "Max 5MB.", variant: "destructive" }); return; }
    // Read as data URL and open the cropper. Upload happens after the user confirms the crop.
    const reader = new FileReader();
    reader.onload = () => {
      setPendingAvatarDataUrl(typeof reader.result === "string" ? reader.result : null);
      setCropOpen(true);
    };
    reader.onerror = () => toast({ title: "Couldn't read image", variant: "destructive" });
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      await uploadAvatar.mutateAsync(file);
      toast({ title: "Avatar updated" });
      setCropOpen(false);
      setPendingAvatarDataUrl(null);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message ?? "", variant: "destructive" });
    }
  };

  const settingsHasChanges =
    displayName.trim() !== (profile.displayName ?? "") ||
    handleValue.trim().toLowerCase() !== (profile.handle ?? "") ||
    bio.trim() !== (profile.bio ?? "");

  const reels = reelsQuery.data?.pages.flatMap((p) => p.reels) ?? [];
  const recipes = recipesQuery.data?.recipes ?? [];
  const analytics = analyticsQuery.data;

  return (
    <div className="pb-24">
      {/* Top bar: Public ↔ Stats toggle + Settings gear */}
      <div className="px-4 pt-6 pb-2 max-w-md mx-auto flex items-center gap-2">
        <div className="flex-1 bg-muted/40 dark:bg-card rounded-full p-1 flex items-center">
          <button
            onClick={() => setActiveView("public")}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-all ${
              activeView === "public"
                ? "bg-white dark:bg-background shadow-[0_2px_6px_rgba(0,0,0,0.08)] text-recipal-deep-green dark:text-foreground"
                : "text-muted-foreground"
            }`}
            data-testid="view-toggle-public"
          >
            Public View
          </button>
          <button
            onClick={() => setActiveView("stats")}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeView === "stats"
                ? "bg-white dark:bg-background shadow-[0_2px_6px_rgba(0,0,0,0.08)] text-recipal-deep-green dark:text-foreground"
                : "text-muted-foreground"
            }`}
            data-testid="view-toggle-stats"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Stats
          </button>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSettingsOpen(true)}
          data-testid="button-creator-settings"
          aria-label="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </Button>
      </div>

      {activeView === "public" ? (
        // ── PUBLIC VIEW — mirrors /chef/[handle] exactly ──
        <>
          <div className="px-6 pt-2 pb-6 bg-gradient-to-b from-recipal-orange/10 to-transparent">
            <div className="max-w-md mx-auto flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-recipal-orange/15 flex items-center justify-center overflow-hidden mb-3 shadow-[0_4px_16px_rgba(255,99,0,0.15)]">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <ChefHat className="w-12 h-12 text-recipal-orange" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-recipal-deep-green dark:text-foreground">
                {profile.displayName}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">@{profile.handle}</p>
              {profile.bio && (
                <p className="text-sm text-muted-foreground mt-3 max-w-xs leading-relaxed">{profile.bio}</p>
              )}
              <button
                onClick={() => setFollowersOpen(true)}
                className="text-sm mt-3 hover:opacity-80 transition-opacity"
                data-testid="button-open-followers"
              >
                <span className="font-bold text-recipal-deep-green dark:text-foreground">{formatCount(profile.followerCount ?? 0)}</span>
                <span className="text-muted-foreground"> {(profile.followerCount ?? 0) === 1 ? "follower" : "followers"}</span>
              </button>
            </div>
          </div>
          <FollowersSheet open={followersOpen} onOpenChange={setFollowersOpen} />

          <div className="max-w-md mx-auto px-4">
            <div className="bg-muted/40 dark:bg-card rounded-full p-1 flex items-center">
              <button
                onClick={() => setActiveTab("reels")}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "reels"
                    ? "bg-white dark:bg-background shadow-[0_2px_6px_rgba(0,0,0,0.08)] text-recipal-deep-green dark:text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Clapperboard className="w-4 h-4" /> Reels
              </button>
              <button
                onClick={() => setActiveTab("recipes")}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "recipes"
                    ? "bg-white dark:bg-background shadow-[0_2px_6px_rgba(0,0,0,0.08)] text-recipal-deep-green dark:text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <Utensils className="w-4 h-4" /> Recipes
              </button>
            </div>
          </div>

          <div className="max-w-md mx-auto px-4 mt-4">
            {activeTab === "reels" ? (
              reelsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : reels.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <Clapperboard className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No reels yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Upload a reel from the orange "+" button.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {reels.map((reel) => (
                    <div key={reel.id} className="relative group">
                      <Link href="/reels">
                        <div className="aspect-[9/16] rounded-md overflow-hidden bg-black relative cursor-pointer">
                          {reel.thumbnailUrl ? (
                            <img src={reel.thumbnailUrl} alt={reel.title ?? "Reel"} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-recipal-deep-green/20 flex items-center justify-center">
                              <Play className="w-6 h-6 text-white/70" fill="currentColor" />
                            </div>
                          )}
                          <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded px-1 py-0.5 text-[9px] font-semibold text-white">
                            <Play className="w-2.5 h-2.5" fill="currentColor" />
                            {formatCount(reel.viewCount)}
                          </div>
                        </div>
                      </Link>
                      {/* Edit + delete overlays — own profile only. Always visible on touch;
                          shown on hover on desktop via group-hover. */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingReel({ id: reel.id, title: reel.title, description: reel.description }); }}
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
                        data-testid={`button-edit-reel-${reel.id}`}
                        aria-label="Edit reel"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingReelId(reel.id); }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
                        data-testid={`button-delete-reel-${reel.id}`}
                        aria-label="Delete reel"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : recipesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Utensils className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No recipes yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recipes.map((recipe) => {
                  const r = chefRecipeToRecipe(recipe);
                  return (
                    <RecipeCard
                      key={r.id}
                      recipe={r}
                      onCardClick={(id) => {
                        const chefId = extractChefRecipeId(id);
                        if (chefId != null) setLocation(`/chef-recipe/${chefId}`);
                      }}
                      onToggleFavorite={() => { /* chef-recipe favorites — future */ }}
                      onShare={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/chef-recipe/${recipe.id}`;
                        navigator.clipboard?.writeText(url).then(() => toast({ title: "Link copied" }));
                      }}
                      isFavorite={false}
                      showEditDelete
                      onEdit={() => setEditingRecipe(recipe)}
                      onDelete={() => setDeletingRecipeId(recipe.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        // ── STATS VIEW ──
        <div className="px-4 pt-4 pb-12 max-w-md mx-auto">
          {analyticsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !analytics ? (
            <div className="text-center py-12 px-6">
              <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No stats yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              <header>
                <h2 className="text-xl font-bold text-recipal-deep-green dark:text-foreground">Your stats</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Aggregated across all published reels.</p>
              </header>
              <div className="grid grid-cols-2 gap-3">
                <StatTile icon={Clapperboard} label="Reels" value={analytics.totals.reelCount} accent="text-recipal-orange" />
                <StatTile icon={Eye} label="Views" value={analytics.totals.totalViews} accent="text-blue-500" />
                <StatTile icon={Heart} label="Likes" value={analytics.totals.totalLikes} accent="text-pink-500" />
                <StatTile icon={ShoppingBag} label="Saves" value={analytics.totals.totalSaves} accent="text-green-500" />
                <StatTile icon={Share2} label="Shares" value={analytics.totals.totalShares} accent="text-purple-500" />
                <StatTile icon={MessageCircle} label="Comments" value={analytics.totals.totalComments} accent="text-amber-500" />
                <StatTile icon={Users} label="Followers" value={analytics.followerCount ?? 0} accent="text-recipal-deep-green dark:text-foreground" />
                <StatTile icon={Percent} label="Engagement" value={analytics.engagementRate ?? 0} accent="text-teal-500" suffix="%" />
              </div>

              <GrowthChart title="New followers / week" data={analytics.followerGrowth ?? []} color="#22c55e" />
              <GrowthChart title="Weekly engagement" data={analytics.engagementGrowth ?? []} color="#ff6300" />

              {analytics.topReels.length > 0 && (
                <section className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Top reels</h3>
                  <div className="space-y-1.5">
                    {analytics.topReels.map((reel) => (
                      <Link key={reel.id} href="/reels">
                        <div className="flex items-center gap-3 rounded-xl border bg-card p-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                          <div className="w-14 h-14 rounded-md bg-black overflow-hidden flex-shrink-0">
                            {reel.thumbnailUrl ? (
                              <img src={reel.thumbnailUrl} alt={reel.title ?? "Reel"} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-recipal-deep-green/20 flex items-center justify-center">
                                <Play className="w-4 h-4 text-white/70" fill="currentColor" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{reel.title ?? "Untitled"}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatCount(reel.viewCount)} views · {formatCount(reel.likeCount)} likes
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {(analytics.reels?.length ?? 0) > 0 && (
                <section className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">All reels</h3>
                  <div className="space-y-1.5">
                    {analytics.reels.map((reel) => (
                      <Link key={reel.id} href="/reels">
                        <div className="rounded-xl border bg-card p-2.5 cursor-pointer hover:bg-muted/40 transition-colors" data-testid={`reel-metrics-${reel.id}`}>
                          <p className="text-sm font-semibold truncate">{reel.title ?? "Untitled"}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                            <span><Eye className="inline w-3 h-3 mr-0.5 -mt-0.5" />{formatCount(reel.viewCount)}</span>
                            <span><Heart className="inline w-3 h-3 mr-0.5 -mt-0.5" />{formatCount(reel.likeCount)}</span>
                            <span><ShoppingBag className="inline w-3 h-3 mr-0.5 -mt-0.5" />{formatCount(reel.saveCount)}</span>
                            <span><Share2 className="inline w-3 h-3 mr-0.5 -mt-0.5" />{formatCount(reel.shareCount)}</span>
                            <span><MessageCircle className="inline w-3 h-3 mr-0.5 -mt-0.5" />{formatCount(reel.commentCount)}</span>
                            <span className="text-teal-600 font-semibold">{reel.engagementRate}% eng.</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px) saturate(1.5)",
            WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          }}
        >
          <SheetHeader>
            <SheetTitle>Creator Settings</SheetTitle>
            <SheetDescription>Edit how your public chef profile appears.</SheetDescription>
          </SheetHeader>

          <div className="py-6 space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24">
                <div className="w-24 h-24 rounded-full bg-recipal-orange/10 flex items-center justify-center overflow-hidden shadow-[0_4px_16px_rgba(255,99,0,0.15)]">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <ChefHat className="w-12 h-12 text-recipal-orange" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatar.isPending}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-recipal-orange shadow-[0_4px_12px_rgba(255,99,0,0.4)] flex items-center justify-center text-white"
                  data-testid="button-upload-avatar"
                  aria-label="Change avatar"
                >
                  {uploadAvatar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
                data-testid="input-avatar-file"
              />
              <p className="text-[11px] text-muted-foreground mt-2">JPG, PNG, or WebP. Up to 5MB.</p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display name</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} className="mt-1" data-testid="input-display-name" />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Handle</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-muted-foreground text-sm flex-shrink-0">@</span>
                <Input
                  value={handleValue}
                  onChange={(e) => setHandleValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  maxLength={30}
                  className="flex-1"
                  data-testid="input-handle"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">3-30 characters: lowercase letters, numbers, underscores.</p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bio</label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                placeholder="What you cook, where you're from, what makes your reels different."
                className="mt-1 min-h-[100px] resize-none"
                data-testid="textarea-bio"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{bio.length} / 500</p>
            </div>
          </div>

          <SheetFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSettingsOpen(false)} className="flex-1">Cancel</Button>
            <Button
              onClick={handleSaveSettings}
              disabled={!settingsHasChanges || updateChef.isPending}
              className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90 text-white gap-2"
              data-testid="button-save-profile"
            >
              {updateChef.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Avatar crop dialog — opens after the file picker, before the upload. */}
      <AvatarCropDialog
        open={cropOpen}
        onOpenChange={(o) => { setCropOpen(o); if (!o) setPendingAvatarDataUrl(null); }}
        imageUrl={pendingAvatarDataUrl}
        onCropped={handleCroppedAvatar}
        isUploading={uploadAvatar.isPending}
      />

      {/* Edit recipe sheet (driven by pencil icon on recipe cards) */}
      <ChefRecipeEditSheet
        open={editingRecipe !== null}
        onOpenChange={(o) => { if (!o) setEditingRecipe(null); }}
        recipe={editingRecipe}
      />

      {/* Confirm delete recipe */}
      <Dialog open={deletingRecipeId !== null} onOpenChange={(o) => { if (!o) setDeletingRecipeId(null); }}>
        <DialogContent className="sm:max-w-sm" style={{ background: "white" }}>
          <DialogHeader>
            <DialogTitle>Delete this recipe?</DialogTitle>
            <DialogDescription>
              This can't be undone. Any reels linked to this recipe stay published but lose the recipe link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRecipeId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deletingRecipeId == null) return;
                try {
                  await deleteRecipe.mutateAsync(deletingRecipeId);
                  toast({ title: "Recipe deleted" });
                } catch (err: any) {
                  toast({ title: "Couldn't delete", description: err?.message, variant: "destructive" });
                } finally {
                  setDeletingRecipeId(null);
                }
              }}
              disabled={deleteRecipe.isPending}
              data-testid="button-confirm-delete-recipe"
            >
              {deleteRecipe.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete reel */}
      {/* Edit-reel metadata sheet (Phase H.20) */}
      <ReelEditSheet open={editingReel !== null} onOpenChange={(o) => { if (!o) setEditingReel(null); }} reel={editingReel} />

      <Dialog open={deletingReelId !== null} onOpenChange={(o) => { if (!o) setDeletingReelId(null); }}>
        <DialogContent className="sm:max-w-sm" style={{ background: "white" }}>
          <DialogHeader>
            <DialogTitle>Delete this reel?</DialogTitle>
            <DialogDescription>
              This can't be undone. The video is removed from Cloudflare Stream and engagement
              history (likes/saves/comments) is wiped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingReelId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deletingReelId == null) return;
                try {
                  await deleteReel.mutateAsync(deletingReelId);
                  toast({ title: "Reel deleted" });
                } catch (err: any) {
                  toast({ title: "Couldn't delete", description: err?.message, variant: "destructive" });
                } finally {
                  setDeletingReelId(null);
                }
              }}
              disabled={deleteReel.isPending}
              data-testid="button-confirm-delete-reel"
            >
              {deleteReel.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, accent, suffix }: { icon: any; label: string; value: number; accent: string; suffix?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${accent}`} />
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      </div>
      <p className={`text-2xl font-extrabold ${accent}`}>{formatCount(value)}{suffix}</p>
    </div>
  );
}

// Weekly growth bar chart (followers / engagement) with a graceful empty state. Phase H.19.
function GrowthChart({ title, data, color }: { title: string; data: { week: string; count: number }[]; color: string }) {
  const hasData = data.some((d) => d.count > 0);
  const labeled = data.map((d) => ({
    ...d,
    label: new Date(d.week).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  }));
  return (
    <section className="mt-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      {!hasData ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">Not enough data yet</div>
      ) : (
        <div className="rounded-xl border bg-card p-3" style={{ height: 168 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={labeled} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
