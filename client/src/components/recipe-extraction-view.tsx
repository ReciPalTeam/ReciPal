import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, AlertTriangle, FileAudio, Brain } from "lucide-react";
import { useExtractRecipe, type ExtractStage } from "@/hooks/use-extract-recipe";
import { RecipeForm } from "@/components/recipe-form";
import type { ChefRecipeInput } from "@/hooks/use-chef-recipes";
import { Button } from "@/components/ui/button";

interface RecipeExtractionViewProps {
  /** The video file the chef just picked. */
  videoFile: File;
  /** Called when the chef has finished editing + submits. Parent persists the recipe. */
  onSubmit: (payload: ChefRecipeInput) => Promise<void> | void;
  /** Whether the parent's "save recipe" mutation is pending. */
  isSubmitting?: boolean;
  /** Called if the chef aborts extraction or hits the error fallback. */
  onCancel?: () => void;
}

const STAGE_META: Record<ExtractStage, { Icon: typeof Loader2; label: string }> = {
  idle:         { Icon: Loader2,    label: "" },
  transcribing: { Icon: FileAudio,  label: "Transcribing audio…" },
  analyzing:    { Icon: Brain,      label: "Extracting recipe…" },
  complete:     { Icon: Sparkles,   label: "Recipe ready — review and edit" },
  error:        { Icon: AlertTriangle, label: "Couldn't extract recipe" },
};

export function RecipeExtractionView({ videoFile, onSubmit, isSubmitting, onCancel }: RecipeExtractionViewProps) {
  const { stage, message, recipe, transcript, errorText, configError, start, reset } = useExtractRecipe();
  const [hasStarted, setHasStarted] = useState(false);

  // We render our own <video> so the chef can scrub and pick a frame for the recipe photo
  // during the AI extraction step (before the timeline editor opens).
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  // Kick off extraction once on mount.
  useEffect(() => {
    if (!hasStarted) {
      setHasStarted(true);
      start(videoFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const VideoPreview = videoUrl ? (
    <div className="rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[40vh] mx-auto">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        className="w-full h-full object-contain"
        data-testid="extraction-video-preview"
      />
    </div>
  ) : null;

  // Progress strip (shown above the form while extraction runs).
  const ProgressStrip = () => {
    const stages: { key: ExtractStage; label: string }[] = [
      { key: "transcribing", label: "Transcribing" },
      { key: "analyzing", label: "Extracting" },
      { key: "complete", label: "Done" },
    ];
    const currentIdx = stages.findIndex((s) => s.key === stage);
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          {stage === "complete" ? (
            <Sparkles className="w-5 h-5 text-recipal-orange" />
          ) : stage === "error" ? (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-recipal-orange" />
          )}
          <p className="text-sm font-semibold">{STAGE_META[stage].label || "Starting…"}</p>
        </div>
        {message && stage !== "complete" && stage !== "error" && (
          <p className="text-xs text-muted-foreground ml-7">{message}</p>
        )}
        <div className="flex items-center gap-1.5 ml-7">
          {stages.map((s, i) => {
            const done = currentIdx > i || stage === "complete";
            const active = currentIdx === i && stage !== "complete";
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    done ? "bg-recipal-orange" : active ? "bg-recipal-orange animate-pulse" : "bg-muted"
                  }`}
                />
                <span className={`text-[11px] ${done || active ? "text-recipal-deep-green dark:text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {i < stages.length - 1 && <span className="text-muted-foreground/40 mx-1">·</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Error fallback: extraction service unavailable. Offer manual entry.
  if (stage === "error" && configError) {
    return (
      <div className="space-y-3">
        {VideoPreview}
        <div className="rounded-2xl border border-amber-300/50 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Recipe extraction unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">{errorText}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Recipe extraction isn't configured on this server yet. You can still build the recipe manually below.
          </p>
        </div>
        <RecipeForm
          videoRef={videoRef}
          source="manual"
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          submitLabel="Save recipe & continue"
        />
        {onCancel && (
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="space-y-3">
        {VideoPreview}
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-destructive">Extraction failed</p>
              <p className="text-xs text-muted-foreground mt-1">{errorText}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { reset(); setHasStarted(false); }}
          >
            Try again
          </Button>
          {onCancel && (
            <Button variant="ghost" className="flex-1" onClick={onCancel}>
              Build manually
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {VideoPreview}
      <ProgressStrip />
      {/* The form renders even mid-extraction — fields populate as they arrive. */}
      <RecipeForm
        videoRef={videoRef}
        initial={{
          title: recipe.title ?? undefined,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          passiveTimeMinutes: recipe.passiveTimeMinutes,
          servings: recipe.servings,
          ingredients: recipe.ingredients ?? undefined,
          steps: recipe.steps ?? undefined,
        }}
        source="gpt_extracted"
        sourceTranscript={transcript || null}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Save recipe & continue"
      />
    </div>
  );
}
