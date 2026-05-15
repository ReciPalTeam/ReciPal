import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { usePublicChef, usePublicChefReels, usePublicChefRecipes } from "@/hooks/use-chef";
import { Button } from "@/components/ui/button";
import {
  ChefHat,
  Share2,
  Loader2,
  Play,
  Clapperboard,
  Utensils,
  AlertCircle,
  Edit3,
} from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { chefRecipeToRecipe, extractChefRecipeId } from "@/lib/chef-recipe-adapter";

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`.replace(".0", "");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0", "");
}

export default function ChefHandlePage() {
  const [, params] = useRoute<{ handle: string }>("/chef/:handle");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const handle = params?.handle?.toLowerCase();

  const [activeTab, setActiveTab] = useState<"reels" | "recipes">("reels");

  const { data: chefData, isLoading, error } = usePublicChef(handle);
  const reelsQuery = usePublicChefReels(handle, 12);
  const recipesQuery = usePublicChefRecipes(handle, 24);

  const profile = chefData?.profile;
  const reels = reelsQuery.data?.pages.flatMap((p) => p.reels) ?? [];
  const recipes = recipesQuery.data?.recipes ?? [];

  const handleShare = async () => {
    if (!handle) return;
    const url = `${window.location.origin}/chef/${handle}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: profile ? `${profile.displayName} on ReciPal` : "Chef on ReciPal",
          text: profile?.bio ?? undefined,
          url,
        });
        return;
      } catch {
        /* user cancelled, fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-10 h-10 text-destructive mb-3" />
        <p className="text-sm font-semibold">Chef not found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Check the handle or browse the Reels feed.
        </p>
        <Link href="/reels">
          <Button variant="ghost" className="mt-4 text-recipal-orange">Back to Reels</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-6 pt-8 pb-6 bg-gradient-to-b from-recipal-orange/10 to-transparent">
        <div className="max-w-md mx-auto flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-recipal-orange/15 flex items-center justify-center overflow-hidden mb-3 shadow-[0_4px_16px_rgba(255,99,0,0.15)]">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <ChefHat className="w-12 h-12 text-recipal-orange" />
            )}
          </div>
          <h1
            className="text-2xl font-bold text-recipal-deep-green dark:text-foreground"
            data-testid="text-chef-name"
          >
            {profile.displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-chef-handle">
            @{profile.handle}
          </p>
          {profile.bio && (
            <p className="text-sm text-muted-foreground mt-3 max-w-xs leading-relaxed" data-testid="text-chef-bio">
              {profile.bio}
            </p>
          )}
          <div className="flex items-center gap-2 mt-5">
            <Button
              onClick={handleShare}
              className="bg-recipal-orange hover:bg-recipal-orange/90 text-white gap-2"
              data-testid="button-share-chef"
            >
              <Share2 className="w-4 h-4" /> Share
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/chef/me")}
              className="gap-2"
              data-testid="button-edit-from-public"
              title="Visible only to you"
            >
              <Edit3 className="w-4 h-4" /> Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-md mx-auto px-4">
        <div className="bg-muted/40 dark:bg-card rounded-full p-1 flex items-center">
          <button
            onClick={() => setActiveTab("reels")}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "reels"
                ? "bg-white dark:bg-background shadow-[0_2px_6px_rgba(0,0,0,0.08)] text-recipal-deep-green dark:text-foreground"
                : "text-muted-foreground"
            }`}
            data-testid="tab-chef-reels"
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
            data-testid="tab-chef-recipes"
          >
            <Utensils className="w-4 h-4" /> Recipes
          </button>
        </div>
      </div>

      {/* Content */}
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
                When {profile.displayName.split(" ")[0]} posts their first reel, it'll show up here.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {reels.map((reel) => (
                  <Link key={reel.id} href="/reels">
                    <div
                      className="aspect-[9/16] rounded-md overflow-hidden bg-black relative cursor-pointer"
                      data-testid={`thumb-reel-${reel.id}`}
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
                      <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded px-1 py-0.5 text-[9px] font-semibold text-white">
                        <Play className="w-2.5 h-2.5" fill="currentColor" />
                        {formatCount(reel.viewCount)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {reelsQuery.hasNextPage && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reelsQuery.fetchNextPage()}
                    disabled={reelsQuery.isFetchingNextPage}
                  >
                    {reelsQuery.isFetchingNextPage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </>
          )
        ) : recipesQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-12 px-6">
            <Utensils className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No recipes yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              When {profile.displayName.split(" ")[0]} publishes their first recipe, it'll show up here.
            </p>
          </div>
        ) : (
          // Reuse the For You feed's RecipeCard for visual consistency. Adapter maps the
          // chef_recipes shape onto the Recipe shape the card expects.
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
                  onToggleFavorite={() => { /* TODO: chef recipe favorites — out of scope for H.4 */ }}
                  onShare={(e, _id, title) => {
                    e.stopPropagation();
                    const url = `${window.location.origin}/chef-recipe/${recipe.id}`;
                    if (typeof navigator.share === "function") {
                      navigator.share({ title, url }).catch(() => {});
                    } else {
                      navigator.clipboard?.writeText(url).then(
                        () => toast({ title: "Link copied" }),
                        () => toast({ title: "Couldn't copy link", variant: "destructive" }),
                      );
                    }
                  }}
                  isFavorite={false}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
