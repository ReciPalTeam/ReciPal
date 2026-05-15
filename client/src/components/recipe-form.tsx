import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Camera, Image as ImageIcon, Trash2, Plus, ChevronUp, ChevronDown, Loader2, Utensils, Film, Clock, MapPin } from "lucide-react";
import { useUploadRecipePhoto, type ChefRecipeInput, type ChefRecipeStep } from "@/hooks/use-chef-recipes";
import { extractFrameAsBlob, cropImageFileToAspect } from "@/lib/video-frame";

// Form state uses string fields (vs null) so empty inputs round-trip cleanly. Normalized to
// null in handleSubmit before sending to the server.
type FormStep = { instruction: string; time: string; location: string };

function normalizeInitialSteps(steps: ChefRecipeInput["steps"] | ChefRecipeStep[] | (string | ChefRecipeStep)[] | undefined): FormStep[] {
  if (!steps || steps.length === 0) return [{ instruction: "", time: "", location: "" }];
  return steps.map((s) => {
    if (typeof s === "string") return { instruction: s, time: "", location: "" };
    return {
      instruction: s.instruction ?? "",
      time: s.time ?? "",
      location: s.location ?? "",
    };
  });
}

// Recipe photos are stored as 1:1 squares to match the `aspect-square` recipe-card thumbnail.
// The chef-recipe detail page uses `aspect-[4/3]` with `object-cover` so a square source
// center-crops cleanly there too.
const RECIPE_PHOTO_ASPECT = 1;

interface RecipeFormProps {
  /** Optional reference to the loaded source video — enables "pick frame as photo". */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Initial values to seed the form (e.g. from GPT extraction). */
  initial?: Partial<ChefRecipeInput>;
  /** Source tag for the resulting recipe row. */
  source?: ChefRecipeInput["source"];
  /** Optional raw transcript persisted on save (for re-extraction / debugging). */
  sourceTranscript?: string | null;
  /** Submit handler — receives a ready-to-POST recipe payload. */
  onSubmit: (payload: ChefRecipeInput) => Promise<void> | void;
  /** Whether the submission is currently pending (parent owns the mutation state). */
  isSubmitting?: boolean;
  /** Submit button label override. */
  submitLabel?: string;
}

export function RecipeForm({ videoRef, initial, source = "manual", sourceTranscript, onSubmit, isSubmitting, submitLabel = "Continue" }: RecipeFormProps) {
  const { toast } = useToast();
  const uploadPhoto = useUploadRecipePhoto();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);
  const [prepTime, setPrepTime] = useState<string>(initial?.prepTimeMinutes != null ? String(initial.prepTimeMinutes) : "");
  const [cookTime, setCookTime] = useState<string>(initial?.cookTimeMinutes != null ? String(initial.cookTimeMinutes) : "");
  const [passiveTime, setPassiveTime] = useState<string>(initial?.passiveTimeMinutes != null ? String(initial.passiveTimeMinutes) : "");
  const [servings, setServings] = useState<string>(initial?.servings != null ? String(initial.servings) : "");
  const [ingredients, setIngredients] = useState<{ name: string; amount: string; unit: string }[]>(
    initial?.ingredients ?? [{ name: "", amount: "", unit: "" }],
  );
  const [steps, setSteps] = useState<FormStep[]>(normalizeInitialSteps(initial?.steps as any));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Re-seed fields when `initial` changes (GPT field-by-field arrival).
  useEffect(() => {
    if (initial == null) return;
    if (initial.title != null) setTitle(initial.title);
    if (initial.description != null) setDescription(initial.description ?? "");
    if (initial.photoUrl != null) setPhotoUrl(initial.photoUrl);
    if (initial.prepTimeMinutes != null) setPrepTime(String(initial.prepTimeMinutes));
    if (initial.cookTimeMinutes != null) setCookTime(String(initial.cookTimeMinutes));
    if (initial.passiveTimeMinutes != null) setPassiveTime(String(initial.passiveTimeMinutes));
    if (initial.servings != null) setServings(String(initial.servings));
    if (initial.ingredients && initial.ingredients.length > 0) setIngredients(initial.ingredients);
    if (initial.steps && initial.steps.length > 0) setSteps(normalizeInitialSteps(initial.steps as any));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.title, initial?.prepTimeMinutes, initial?.cookTimeMinutes, initial?.passiveTimeMinutes, initial?.servings, initial?.ingredients?.length, initial?.steps?.length]);

  // ── Photo handling ──────────────────────────────────────────────────────────

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Pick an image", variant: "destructive" });
      return;
    }
    try {
      // Center-crop to a 1:1 square before upload so the saved photo matches the recipe-card
      // feed aspect. Detail page (4:3) uses object-cover, so further cropping there is safe.
      const cropped = await cropImageFileToAspect(f, RECIPE_PHOTO_ASPECT, 0.85);
      const croppedFile = new File(
        [cropped],
        f.name.replace(/\.[^.]+$/, "") + "-square.jpg",
        { type: "image/jpeg" },
      );
      const { photoUrl: url } = await uploadPhoto.mutateAsync(croppedFile);
      setPhotoUrl(url);
    } catch (err: any) {
      toast({ title: "Photo upload failed", description: err?.message ?? "", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePickFrame = async () => {
    const v = videoRef?.current;
    if (!v) {
      toast({ title: "No video loaded", description: "Pick a frame is only available with a video selected.", variant: "destructive" });
      return;
    }
    const t = v.currentTime || (v.duration ? v.duration / 4 : 1);
    try {
      // Square-crop the captured frame to match recipe-card aspect.
      const blob = await extractFrameAsBlob(v, t, 0.85, RECIPE_PHOTO_ASPECT);
      const file = new File([blob], `frame-${Date.now()}.jpg`, { type: "image/jpeg" });
      const { photoUrl: url } = await uploadPhoto.mutateAsync(file);
      setPhotoUrl(url);
      toast({ title: "Frame captured", description: `${t.toFixed(1)}s` });
    } catch (err: any) {
      toast({ title: "Frame capture failed", description: err?.message ?? "", variant: "destructive" });
    }
  };

  // ── Ingredient list editing ─────────────────────────────────────────────────

  const updateIngredient = (idx: number, patch: Partial<typeof ingredients[number]>) => {
    setIngredients((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addIngredient = () => setIngredients((p) => [...p, { name: "", amount: "", unit: "" }]);
  const removeIngredient = (idx: number) => setIngredients((p) => p.filter((_, i) => i !== idx));

  // ── Step list editing ───────────────────────────────────────────────────────

  const updateStep = (idx: number, patch: Partial<FormStep>) =>
    setSteps((p) => p.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const addStep = () => setSteps((p) => [...p, { instruction: "", time: "", location: "" }]);
  const removeStep = (idx: number) => setSteps((p) => p.filter((_, i) => i !== idx));
  const moveStep = (idx: number, dir: -1 | 1) =>
    setSteps((p) => {
      const j = idx + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (title.trim().length === 0) {
      toast({ title: "Recipe needs a title", variant: "destructive" });
      return;
    }
    const cleanedIngredients = ingredients.filter((it) => it.name.trim().length > 0);
    const cleanedSteps: ChefRecipeStep[] = steps
      .map((s) => ({
        instruction: s.instruction.trim(),
        time: s.time.trim(),
        location: s.location.trim(),
      }))
      .filter((s) => s.instruction.length > 0)
      .map((s) => ({
        instruction: s.instruction,
        time: s.time.length > 0 ? s.time : null,
        location: s.location.length > 0 ? s.location : null,
      }));
    const num = (s: string): number | null => {
      const n = Number(s);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const prep = num(prepTime);
    const cook = num(cookTime);
    const passive = num(passiveTime);
    const total = (prep ?? 0) + (cook ?? 0) + (passive ?? 0);
    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      photoUrl,
      prepTimeMinutes: prep,
      cookTimeMinutes: cook,
      passiveTimeMinutes: passive,
      totalTimeMinutes: total > 0 ? total : null,
      servings: num(servings),
      ingredients: cleanedIngredients,
      steps: cleanedSteps,
      source,
      sourceTranscript: sourceTranscript ?? null,
    });
  };

  return (
    <div className="space-y-5">
      {/* Photo */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Photo
        </label>
        <div className="flex items-center gap-3">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="Recipe" className="w-full h-full object-cover" />
            ) : (
              <Utensils className="w-7 h-7 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPhoto.isPending}
              className="justify-start gap-2"
              data-testid="button-upload-recipe-photo"
            >
              {uploadPhoto.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
              Upload image
            </Button>
            {videoRef !== undefined && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePickFrame}
                disabled={uploadPhoto.isPending}
                className="justify-start gap-2"
                data-testid="button-pick-frame"
              >
                <Film className="w-3.5 h-3.5" /> Use current video frame
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="e.g., 30-second carbonara"
          data-testid="input-recipe-title"
        />
      </div>

      {/* Times + servings */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Prep", value: prepTime, setter: setPrepTime, testid: "input-prep-min" },
          { label: "Cook", value: cookTime, setter: setCookTime, testid: "input-cook-min" },
          { label: "Passive", value: passiveTime, setter: setPassiveTime, testid: "input-passive-min" },
          { label: "Serves", value: servings, setter: setServings, testid: "input-servings" },
        ].map(({ label, value, setter, testid }) => (
          <div key={label}>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">{label}</label>
            <Input
              type="number"
              inputMode="numeric"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="text-center"
              min={0}
              data-testid={testid}
            />
          </div>
        ))}
      </div>

      {/* Ingredients */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Ingredients
        </label>
        <div className="space-y-1.5">
          {ingredients.map((it, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <Input
                value={it.amount}
                onChange={(e) => updateIngredient(idx, { amount: e.target.value })}
                placeholder="1"
                className="w-14 text-center text-sm"
                data-testid={`input-ing-amount-${idx}`}
              />
              <Input
                value={it.unit}
                onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                placeholder="cup"
                className="w-16 text-center text-sm"
                data-testid={`input-ing-unit-${idx}`}
              />
              <Input
                value={it.name}
                onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                placeholder="ingredient name"
                className="flex-1 text-sm"
                data-testid={`input-ing-name-${idx}`}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeIngredient(idx)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                data-testid={`button-remove-ing-${idx}`}
                aria-label="Remove ingredient"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={addIngredient}
          className="mt-2 gap-1.5 text-recipal-orange hover:text-recipal-orange hover:bg-recipal-orange/10"
          data-testid="button-add-ing"
        >
          <Plus className="w-3.5 h-3.5" /> Add ingredient
        </Button>
      </div>

      {/* Steps */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Steps
        </label>
        <div className="space-y-3">
          {steps.map((s, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center mt-0.5">
                  <span className="text-xs font-bold text-primary">{idx + 1}</span>
                </div>
                <Textarea
                  value={s.instruction}
                  onChange={(e) => updateStep(idx, { instruction: e.target.value })}
                  placeholder="Describe this step…"
                  rows={2}
                  className="flex-1 text-sm resize-none"
                  data-testid={`input-step-${idx}`}
                />
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-recipal-orange disabled:opacity-30 p-1"
                    data-testid={`button-step-up-${idx}`}
                    aria-label="Move step up"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === steps.length - 1}
                    className="text-muted-foreground hover:text-recipal-orange disabled:opacity-30 p-1"
                    data-testid={`button-step-down-${idx}`}
                    aria-label="Move step down"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeStep(idx)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    data-testid={`button-remove-step-${idx}`}
                    aria-label="Remove step"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-9">
                <div className="relative flex-1">
                  <Clock className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  <Input
                    value={s.time}
                    onChange={(e) => updateStep(idx, { time: e.target.value })}
                    placeholder="Time (e.g. 10 min)"
                    className="h-8 pl-7 text-xs"
                    data-testid={`input-step-time-${idx}`}
                  />
                </div>
                <div className="relative flex-1">
                  <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  <Input
                    value={s.location}
                    onChange={(e) => updateStep(idx, { location: e.target.value })}
                    placeholder="Location (e.g. stovetop)"
                    className="h-8 pl-7 text-xs"
                    data-testid={`input-step-location-${idx}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={addStep}
          className="mt-2 gap-1.5 text-recipal-orange hover:text-recipal-orange hover:bg-recipal-orange/10"
          data-testid="button-add-step"
        >
          <Plus className="w-3.5 h-3.5" /> Add step
        </Button>
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white gap-2"
        data-testid="button-submit-recipe"
      >
        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : submitLabel}
      </Button>
    </div>
  );
}
