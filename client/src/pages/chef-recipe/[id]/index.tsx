import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { format, startOfWeek, addDays } from "date-fns";
import { useChefRecipe, useDeleteChefRecipe } from "@/hooks/use-chef-recipes";
import { useChefMe } from "@/hooks/use-chef";
import { useAddRecipeToPlan } from "@/hooks/use-plans";
import { useDemoStore } from "@/lib/demo-store";
import { useUserFavoriteIds, useToggleUserFavorite } from "@/hooks/use-favorites";
import { chefRecipeToRecipe } from "@/lib/chef-recipe-adapter";
import { scaleIngredientAmount } from "@/lib/parse-ingredient-amount";
import { useToast } from "@/hooks/use-toast";
import { CookCelebrationModal } from "@/components/cook-celebration-modal";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Heart, Share2, Clock, Users, Plus, ShoppingCart, ChefHat,
  Loader2, AlertCircle, Utensils, Pencil, Trash2, Minus, Repeat, ChevronDown, MapPin,
} from "lucide-react";
import { formatMinutesHumanReadable } from "@/lib/time-format";
import { SwapIngredientPopup } from "@/components/swap-ingredient-popup";
import { ChefRecipeEditSheet } from "@/components/chef-recipe-edit-sheet";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snackitizers", "Desserts"];

export default function ChefRecipePage() {
  const [, params] = useRoute<{ id: string }>("/chef-recipe/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data, isLoading, error } = useChefRecipe(params?.id);
  const { data: chefMeData } = useChefMe();

  const addToPlan = useAddRecipeToPlan();
  const deleteRecipe = useDeleteChefRecipe();
  const addRecipeIngredientsToCart = useDemoStore((s) => s.addRecipeIngredientsToCart);
  const getPantryOverlap = useDemoStore((s) => s.getPantryOverlap);
  const { data: favIds } = useUserFavoriteIds();
  const toggleFav = useToggleUserFavorite();

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState("0");
  const [selectedMealType, setSelectedMealType] = useState("Lunch");
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps">("ingredients");
  const [openNutritionSections, setOpenNutritionSections] = useState<Record<string, boolean>>({});
  const [swapPopupOpen, setSwapPopupOpen] = useState(false);
  const [swapIngredientName, setSwapIngredientName] = useState("");
  const [cookFlowActive, setCookFlowActive] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const r = data?.recipe;
  const baseServings = r?.servings ?? 1;
  const [displayedServings, setDisplayedServings] = useState<number>(0);
  // Initialise displayedServings once the recipe loads.
  useMemo(() => {
    if (r && displayedServings === 0) setDisplayedServings(r.servings ?? 1);
  }, [r, displayedServings]);

  // Current week (for the cook-completion leftover assignment), mirrors the public recipe page.
  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return { date: format(d, "yyyy-MM-dd"), label: format(d, "EEEE, MMM d") };
    });
  }, []);

  // Average rating for this chef recipe — reuses recipe_ratings keyed by "chef:<id>".
  const ratingsId = params?.id ? `chef:${params.id}` : "";
  const { data: ratingsData } = useQuery({
    queryKey: ["/api/recipes/ratings", ratingsId] as const,
    queryFn: async () => {
      const res = await fetch(`/api/recipes/ratings?ids=${encodeURIComponent(ratingsId)}`, { credentials: "include" });
      if (!res.ok) return {} as Record<string, { average: number; count: number }>;
      return (await res.json()) as Record<string, { average: number; count: number }>;
    },
    enabled: !!ratingsId,
  });
  const ratingInfo = ratingsId ? ratingsData?.[ratingsId] : undefined;

  if (isLoading || displayedServings === 0) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !r) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-semibold">Recipe not found</p>
        <Link href="/reels">
          <Button variant="ghost" className="mt-3 text-recipal-orange">Back to Reels</Button>
        </Link>
      </div>
    );
  }

  const isOwnProfile = !!chefMeData?.profile && chefMeData.profile.handle === r.chef.handle;
  const recipeAsRecipe = chefRecipeToRecipe(r);
  const isFavorite = favIds?.ids.includes(recipeAsRecipe.id) ?? false;

  // Macros scale linearly with displayed servings. stored values are per-serving.
  const macroScale = displayedServings;
  const n = r.nutrition;
  const scaledMacros = n
    ? {
        calories: Math.round(n.calories * macroScale),
        protein: Math.round(n.protein * macroScale * 10) / 10,
        carbs: Math.round(n.carbs * macroScale * 10) / 10,
        fat: Math.round(n.fat * macroScale * 10) / 10,
        saturatedFat: Math.round(n.saturatedFat * macroScale * 10) / 10,
        polyunsaturatedFat: Math.round(n.polyunsaturatedFat * macroScale * 10) / 10,
        monounsaturatedFat: Math.round(n.monounsaturatedFat * macroScale * 10) / 10,
        transFat: Math.round(n.transFat * macroScale * 10) / 10,
        fiber: Math.round(n.fiber * macroScale * 10) / 10,
        sugar: Math.round(n.sugar * macroScale * 10) / 10,
        addedSugars: Math.round(n.addedSugars * macroScale * 10) / 10,
        cholesterol: Math.round(n.cholesterol * macroScale * 10) / 10,
        sodium: Math.round(n.sodium * macroScale * 10) / 10,
        potassium: Math.round(n.potassium * macroScale * 10) / 10,
        calcium: Math.round(n.calcium * macroScale * 10) / 10,
        iron: Math.round(n.iron * macroScale * 10) / 10,
        vitaminA: Math.round(n.vitaminA * macroScale * 10) / 10,
        vitaminC: Math.round(n.vitaminC * macroScale * 10) / 10,
        vitaminD: Math.round(n.vitaminD * macroScale * 10) / 10,
      }
    : null;

  // Scale ingredient amounts proportionally too (display only).
  const scaleRatio = baseServings > 0 ? displayedServings / baseServings : 1;
  const displayIngredients = r.ingredients.map((ing) => ({
    ...ing,
    amount: scaleIngredientAmount(ing.amount, scaleRatio),
  }));

  // Pantry overlap for "Have / Maybe / Need" badges. Uses the adapter so the
  // existing demo-store logic recognises chef-recipe ingredients the same way as
  // public-recipe ones.
  const adaptedRecipeWithCurrentIngredients = {
    ...recipeAsRecipe,
    ingredients: displayIngredients,
  };
  const pantryOverlap = getPantryOverlap(adaptedRecipeWithCurrentIngredients);
  const getIngredientStatus = (name: string): "have" | "might" | "need" => {
    if (pantryOverlap.have.includes(name)) return "have";
    if (pantryOverlap.might.includes(name)) return "might";
    return "need";
  };
  const missingCount = displayIngredients.filter((ing) => getIngredientStatus(ing.name) === "need").length;

  const handleCookNow = () => {
    setCookFlowActive(true);
    setActiveTab("steps");
  };

  const prep = r.prepTimeMinutes ?? 0;
  const cook = r.cookTimeMinutes ?? 0;
  const passive = r.passiveTimeMinutes ?? 0;
  const total = r.totalTimeMinutes ?? (prep + cook + passive);
  const timeParts: { label: string; value: number }[] = [];
  if (prep > 0) timeParts.push({ label: "Prep", value: prep });
  if (cook > 0) timeParts.push({ label: "Cook", value: cook });
  if (passive > 0) timeParts.push({ label: "Passive", value: passive });
  if (total > 0) timeParts.push({ label: "Total", value: total });

  const toggleNutritionSection = (key: string) =>
    setOpenNutritionSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleShare = async () => {
    const url = `${window.location.origin}/chef-recipe/${r.id}`;
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: r.title, url }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  const handleAddToPlan = async () => {
    try {
      await addToPlan.mutateAsync({
        chefRecipeId: r.id,
        dayIndex: Number(selectedDay),
        mealType: selectedMealType,
      });
      setPlanDialogOpen(false);
      toast({ title: "Added to plan", description: `${r.title} → ${DAY_NAMES[Number(selectedDay)]} ${selectedMealType}` });
    } catch (err: any) {
      toast({ title: "Couldn't add to plan", description: err?.message, variant: "destructive" });
    }
  };

  const handleAddToCart = () => {
    addRecipeIngredientsToCart(adaptedRecipeWithCurrentIngredients);
    setCartDialogOpen(false);
    toast({ title: "Added to cart", description: `${r.ingredients.length} ingredients` });
  };

  const handleDelete = async () => {
    try {
      await deleteRecipe.mutateAsync(r.id);
      toast({ title: "Recipe deleted" });
      setLocation("/chef/me");
    } catch (err: any) {
      toast({ title: "Couldn't delete", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="pb-32">
      {/* Hero — mirrors the public recipe page exactly */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-recipal-orange/20 to-recipal-orange/5">
        {r.photoUrl ? (
          <img src={r.photoUrl} alt={r.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils className="w-16 h-16 text-recipal-orange/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
            onClick={() => setLocation("/reels")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-green-600" />
          </Button>
          <div className="flex gap-2">
            {/* Edit + Delete are owner-only. */}
            {isOwnProfile && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
                  onClick={() => setEditSheetOpen(true)}
                  data-testid="button-edit-recipe"
                  aria-label="Edit recipe"
                >
                  <Pencil className="w-5 h-5 text-blue-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
                  onClick={() => setDeleteDialogOpen(true)}
                  data-testid="button-delete-recipe"
                  aria-label="Delete recipe"
                >
                  <Trash2 className="w-5 h-5 text-destructive" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
              onClick={() => toggleFav.mutate({ recipe: recipeAsRecipe, favorite: !isFavorite })}
              data-testid="button-favorite"
            >
              <Heart className={`w-5 h-5 text-pink-500 ${isFavorite ? "fill-current" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="bg-gradient-to-b from-white/95 to-white/80 backdrop-blur-2xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(0,0,0,0.04)] border border-white/70"
              onClick={handleShare}
              data-testid="button-share"
            >
              <Share2 className="w-5 h-5 text-orange-500" />
            </Button>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h1
            className="font-bold mb-1 text-[#ff6300]"
            style={{ WebkitTextStroke: "4px white", paintOrder: "stroke fill", fontSize: "clamp(0.6rem, 4.5vw, 18px)" }}
            data-testid="text-recipe-title"
          >
            {r.title}
          </h1>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {displayedServings} servings
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Chef byline — unified card styling to match surrounding sections */}
        <Link href={`/chef/${r.chef.handle}`}>
          <div className="rounded-2xl border bg-white/70 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="w-10 h-10 rounded-full bg-recipal-orange/15 flex items-center justify-center overflow-hidden flex-shrink-0">
              {r.chef.avatarUrl ? (
                <img src={r.chef.avatarUrl} alt={r.chef.displayName} className="w-full h-full object-cover" />
              ) : (
                <ChefHat className="w-5 h-5 text-recipal-orange" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recipe by</p>
              <p className="text-sm font-bold">{r.chef.displayName}</p>
            </div>
            <p className="text-xs text-recipal-orange font-semibold">@{r.chef.handle} →</p>
          </div>
        </Link>

        {/* Time pill row */}
        {timeParts.length > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {timeParts.map((p) => (
              <div
                key={p.label}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm shadow-sm border ${
                  p.label === "Total"
                    ? "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200"
                    : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${p.label === "Total" ? "text-[#ff6300]" : "text-gray-400"}`} />
                <span className={`font-medium ${p.label === "Total" ? "text-[#ff6300]/70" : "text-gray-500"}`}>{p.label}</span>
                <span className={`font-bold ${p.label === "Total" ? "text-[#ff6300]" : "text-gray-800"}`}>
                  {formatMinutesHumanReadable(p.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Macro chips */}
        <div className="grid grid-cols-4 gap-2.5">
          <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-3 text-center">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#ff6300] to-[#ff8533]" />
            <p className="text-xl font-extrabold text-[#ff6300] mt-1">{scaledMacros?.protein ?? 0}g</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Protein</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-3 text-center">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#2ecc71] to-[#27ae60]" />
            <p className="text-xl font-extrabold text-[#2ecc71] mt-1">{scaledMacros?.carbs ?? 0}g</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Carbs</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-3 text-center">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#3498db] to-[#2980b9]" />
            <p className="text-xl font-extrabold text-[#3498db] mt-1">{scaledMacros?.fat ?? 0}g</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fat</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-3 text-center">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#f1c40f] to-[#e67e22]" />
            <p className="text-xl font-extrabold text-[#e67e22] mt-1">{scaledMacros?.calories ?? 0}</p>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Calories</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          {scaledMacros?.calories ?? 0} cal for {displayedServings} servings
        </p>

        {/* Detailed Nutrition accordion — mirrors /recipe/:id */}
        {scaledMacros && (
          <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-800">Detailed Nutrition</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Per serving</p>
            </div>

            {/* Fats */}
            <div className="border-b border-gray-200">
              <button
                onClick={() => toggleNutritionSection("fats")}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 hover:from-blue-50 hover:to-indigo-50 transition-colors"
                data-testid="nutrition-toggle-fats"
              >
                <span className="text-[13px] font-bold text-gray-700">Fats</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#3498db] to-[#2980b9] px-2.5 py-0.5 rounded-full">{scaledMacros.fat}g</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openNutritionSections.fats ? "rotate-180" : ""}`} />
                </div>
              </button>
              {openNutritionSections.fats && (
                <div className="px-4 py-2 bg-white space-y-0">
                  {[
                    { name: "Saturated Fat", val: scaledMacros.saturatedFat, unit: "g" },
                    { name: "Polyunsaturated Fat", val: scaledMacros.polyunsaturatedFat, unit: "g" },
                    { name: "Monounsaturated Fat", val: scaledMacros.monounsaturatedFat, unit: "g" },
                    { name: "Trans Fat", val: scaledMacros.transFat, unit: "g" },
                  ].map((item) => (
                    <div key={item.name} className="flex justify-between py-1.5 border-b border-gray-50 last:border-b-0">
                      <span className="text-xs text-gray-500">{item.name}</span>
                      <span className="text-xs font-semibold text-gray-700">{item.val}{item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sugars & Fiber */}
            <div className="border-b border-gray-200">
              <button
                onClick={() => toggleNutritionSection("sugars")}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-50/60 to-emerald-50/40 hover:from-green-50 hover:to-emerald-50 transition-colors"
                data-testid="nutrition-toggle-sugars"
              >
                <span className="text-[13px] font-bold text-gray-700">Sugars & Fiber</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#2ecc71] to-[#27ae60] px-2.5 py-0.5 rounded-full">
                    {Math.round((scaledMacros.fiber + scaledMacros.sugar + scaledMacros.addedSugars) * 10) / 10}g
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openNutritionSections.sugars ? "rotate-180" : ""}`} />
                </div>
              </button>
              {openNutritionSections.sugars && (
                <div className="px-4 py-2 bg-white space-y-0">
                  {[
                    { name: "Dietary Fiber", val: scaledMacros.fiber, unit: "g" },
                    { name: "Total Sugars", val: scaledMacros.sugar, unit: "g" },
                    { name: "Added Sugars", val: scaledMacros.addedSugars, unit: "g" },
                  ].map((item) => (
                    <div key={item.name} className="flex justify-between py-1.5 border-b border-gray-50 last:border-b-0">
                      <span className="text-xs text-gray-500">{item.name}</span>
                      <span className="text-xs font-semibold text-gray-700">{item.val}{item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Minerals */}
            <div className="border-b border-gray-200">
              <button
                onClick={() => toggleNutritionSection("minerals")}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50/60 to-amber-50/40 hover:from-orange-50 hover:to-amber-50 transition-colors"
                data-testid="nutrition-toggle-minerals"
              >
                <span className="text-[13px] font-bold text-gray-700">Minerals</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#e67e22] to-[#d35400] px-2.5 py-0.5 rounded-full">
                    {Math.round(scaledMacros.cholesterol + scaledMacros.sodium + scaledMacros.potassium + scaledMacros.calcium + scaledMacros.iron)}mg
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openNutritionSections.minerals ? "rotate-180" : ""}`} />
                </div>
              </button>
              {openNutritionSections.minerals && (
                <div className="px-4 py-2 bg-white space-y-0">
                  {[
                    { name: "Cholesterol", val: scaledMacros.cholesterol, unit: "mg" },
                    { name: "Sodium", val: scaledMacros.sodium, unit: "mg" },
                    { name: "Potassium", val: scaledMacros.potassium, unit: "mg" },
                    { name: "Calcium", val: scaledMacros.calcium, unit: "mg" },
                    { name: "Iron", val: scaledMacros.iron, unit: "mg" },
                  ].map((item) => (
                    <div key={item.name} className="flex justify-between py-1.5 border-b border-gray-50 last:border-b-0">
                      <span className="text-xs text-gray-500">{item.name}</span>
                      <span className="text-xs font-semibold text-gray-700">{item.val}{item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vitamins */}
            <div>
              <button
                onClick={() => toggleNutritionSection("vitamins")}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50/60 to-pink-50/40 hover:from-purple-50 hover:to-pink-50 transition-colors"
                data-testid="nutrition-toggle-vitamins"
              >
                <span className="text-[13px] font-bold text-gray-700">Vitamins</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white bg-gradient-to-r from-[#9b59b6] to-[#8e44ad] px-2.5 py-0.5 rounded-full">
                    {Math.round((scaledMacros.vitaminA + scaledMacros.vitaminD) * 10) / 10}mcg · {scaledMacros.vitaminC}mg
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openNutritionSections.vitamins ? "rotate-180" : ""}`} />
                </div>
              </button>
              {openNutritionSections.vitamins && (
                <div className="px-4 py-2 bg-white space-y-0">
                  {[
                    { name: "Vitamin A", val: scaledMacros.vitaminA, unit: "mcg" },
                    { name: "Vitamin C", val: scaledMacros.vitaminC, unit: "mg" },
                    { name: "Vitamin D", val: scaledMacros.vitaminD, unit: "mcg" },
                  ].map((item) => (
                    <div key={item.name} className="flex justify-between py-1.5 border-b border-gray-50 last:border-b-0">
                      <span className="text-xs text-gray-500">{item.name}</span>
                      <span className="text-xs font-semibold text-gray-700">{item.val}{item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
              <p className="text-[9px] text-gray-400">* Percent Daily Values are based on a 2,000 calorie diet. Nutritional data is estimated.</p>
            </div>
          </div>
        )}

        {/* Description (if present) */}
        {r.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{r.description}</p>
        )}

        {/* Servings stepper */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5" data-testid="serving-adjuster">
          <span className="text-sm font-medium">Servings</span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 ${displayedServings <= baseServings ? "opacity-30 cursor-not-allowed" : ""}`}
              onClick={() => setDisplayedServings((s) => Math.max(baseServings, s - 1))}
              disabled={displayedServings <= baseServings}
              data-testid="button-servings-minus"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-8 text-center font-bold text-base" data-testid="text-servings">{displayedServings}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDisplayedServings((s) => Math.min(48, s + 1))}
              disabled={displayedServings >= 48}
              data-testid="button-servings-plus"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Ingredients / Steps tabs */}
        {ratingInfo && ratingInfo.count > 0 && (
          <div className="flex items-center gap-2 mb-3" data-testid="chef-recipe-rating">
            <StarRating rating={ratingInfo.average} />
            <span className="text-sm text-muted-foreground">
              {ratingInfo.average} ({ratingInfo.count} rating{ratingInfo.count !== 1 ? "s" : ""})
            </span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ingredients" | "steps")} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="ingredients" data-testid="tab-ingredients">Ingredients</TabsTrigger>
            <TabsTrigger value="steps" data-testid="tab-steps">Steps</TabsTrigger>
          </TabsList>

          <TabsContent value="ingredients" className="mt-4">
            {displayIngredients.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No ingredients listed.</p>
            ) : (
              <div className="space-y-2">
                {displayIngredients
                  .map((ing, idx) => ({ ing, idx, status: getIngredientStatus(ing.name) }))
                  .sort((a, b) => {
                    const order: Record<string, number> = { have: 0, might: 1, need: 2 };
                    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
                  })
                  .map(({ ing, idx, status }) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-2 rounded-lg border-transparent border-b last:border-0"
                      data-testid={`ingredient-${idx}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        {status === "have" && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-[9px] px-1.5 flex-shrink-0">Have</Badge>
                        )}
                        {status === "might" && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800 text-[9px] px-1.5 flex-shrink-0">Maybe</Badge>
                        )}
                        {status === "need" && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-[9px] px-1.5 flex-shrink-0">Need</Badge>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm truncate">{ing.name}</span>
                          <span className="text-xs text-muted-foreground">{ing.amount} {ing.unit}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="h-6 px-[9px] py-[5px] gap-0 border-0 bg-gradient-to-b from-[#60a5fa] via-[#3b82f6] to-[#2563eb] hover:opacity-90 text-white text-[10px] font-medium rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)] flex-shrink-0"
                        onClick={() => { setSwapIngredientName(ing.name); setSwapPopupOpen(true); }}
                        data-testid={`button-swap-${idx}`}
                      >
                        <Repeat className="h-3 w-3 text-white" /><span className="ml-1">Swap</span>
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="steps" className="mt-4">
            {r.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No steps listed.</p>
            ) : (
              <div className="space-y-4">
                {r.steps.map((step, i) => {
                  const isObj = typeof step === "object" && step !== null;
                  const instruction = isObj ? (step as any).instruction ?? "" : (step as string);
                  const time = isObj ? (step as any).time ?? "" : "";
                  const location = isObj ? (step as any).location ?? "" : "";
                  return (
                    <div key={i} className="flex gap-3" data-testid={`step-${i}`}>
                      <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{instruction}</p>
                        {(time || location) && (
                          <div className="flex gap-3 mt-1.5 flex-wrap">
                            {time && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full" data-testid={`step-time-${i}`}>
                                <Clock className="w-3 h-3" />
                                {time}
                              </span>
                            )}
                            {location && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full" data-testid={`step-location-${i}`}>
                                <MapPin className="w-3 h-3" />
                                {location}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div className="max-w-md mx-auto flex gap-3">
          {cookFlowActive ? (
            // In cook mode → completion button (mirrors the public recipe flow).
            <Button
              className="flex-1 h-12 border-0 bg-gradient-to-b from-[#4ade80] via-[#22c55e] to-[#16a34a] hover:opacity-90 text-white font-bold rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)]"
              onClick={() => setShowCelebration(true)}
              data-testid="button-i-cooked-this"
            >
              <ChefHat className="w-5 h-5 mr-2" /> I Cooked This!
            </Button>
          ) : missingCount === 0 ? (
            // All ingredients on hand → offer Cook Now (mirrors public; replaces Plan/Cart).
            <Button
              className="flex-1 h-12 border-0 bg-gradient-to-b from-[#4ade80] via-[#22c55e] to-[#16a34a] hover:opacity-90 text-white font-bold rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)]"
              onClick={handleCookNow}
              data-testid="button-cook-now"
            >
              <ChefHat className="w-5 h-5 mr-2" /> Cook Now
            </Button>
          ) : (
            <>
              <Button
                className="flex-1 h-12 border-0 bg-gradient-to-b from-[#ff8533] via-[#ff6300] to-[#e85500] hover:opacity-90 text-white font-bold rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)]"
                onClick={() => setPlanDialogOpen(true)}
                data-testid="button-add-to-plan"
              >
                <Plus className="w-5 h-5 mr-2" /> Add to Plan
              </Button>
              <Button
                className="flex-1 h-12 border-0 bg-gradient-to-b from-[#4ade80] via-[#22c55e] to-[#16a34a] hover:opacity-90 text-white font-bold rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)]"
                onClick={() => setCartDialogOpen(true)}
                data-testid="button-add-to-cart"
              >
                <ShoppingCart className="w-5 h-5 mr-2" /> Add to Cart
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cook completion celebration (rating + leftovers + share) — modal is chef-aware. */}
      <CookCelebrationModal
        open={showCelebration}
        onClose={() => { setShowCelebration(false); setCookFlowActive(false); }}
        recipe={recipeAsRecipe}
        weekDates={weekDates}
        totalServings={displayedServings}
      />

      {/* Swap dialog */}
      <SwapIngredientPopup
        open={swapPopupOpen}
        onOpenChange={setSwapPopupOpen}
        ingredientName={swapIngredientName}
      />

      {/* Add to Plan dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: "white" }}>
          <DialogHeader>
            <DialogTitle>Add to Plan</DialogTitle>
            <DialogDescription>Choose when you want to make this.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Day</label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Meal</label>
              <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-b from-[#ff8533] to-[#ff6300] text-white"
              onClick={handleAddToPlan}
              disabled={addToPlan.isPending}
            >
              {addToPlan.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding…</>) : (<><Plus className="w-4 h-4 mr-2" /> Add to Plan</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Cart dialog */}
      <Dialog open={cartDialogOpen} onOpenChange={setCartDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: "white" }}>
          <DialogHeader>
            <DialogTitle>Add to Cart</DialogTitle>
            <DialogDescription>
              Add all {r.ingredients.length} ingredients from {r.title} to your shopping list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-b from-[#4ade80] to-[#22c55e] text-white"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm" style={{ background: "white" }}>
          <DialogHeader>
            <DialogTitle>Delete this recipe?</DialogTitle>
            <DialogDescription>
              This can't be undone. Any reels linked to this recipe stay published but lose the recipe link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRecipe.isPending}
              data-testid="button-confirm-delete-recipe"
            >
              {deleteRecipe.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit sheet */}
      <ChefRecipeEditSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        recipe={r}
      />
    </div>
  );
}
