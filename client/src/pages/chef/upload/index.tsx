import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { goBack } from "@/lib/back";
import { useToast } from "@/hooks/use-toast";
import { useChefMe } from "@/hooks/use-chef";
import { useCreateChefRecipe, type ChefRecipeInput } from "@/hooks/use-chef-recipes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, ChefHat, AlertTriangle, Music, X, BookOpen, ChevronLeft } from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
// Vite-bundled module-worker URL. This makes the relative imports inside @ffmpeg/ffmpeg's
// worker.js (./const.js, ./errors.js) resolve correctly — a CDN blob URL would break them.
import ffmpegWorkerUrl from "@ffmpeg/ffmpeg/worker?worker&url";
import { MusicPickerSheet } from "@/components/music-picker-sheet";
import { RecipeChoiceStep } from "@/components/recipe-choice-step";
import { RecipePickerSheet, type SelectedRecipe } from "@/components/recipe-picker-sheet";
import { RecipeExtractionView } from "@/components/recipe-extraction-view";
import { TimelineTrimEditor, type TimelineSegment } from "@/components/timeline-trim-editor";
import { Slider } from "@/components/ui/slider";
import type { MusicTrack } from "@/hooks/use-music";

const MAX_DURATION_S = 240;
// FFmpeg.wasm is invoked from a *module* worker, so the worker's `importScripts(core)` call fails
// and the runtime falls back to `await import(core)`. That dynamic import only succeeds for the
// ESM build of ffmpeg-core — pointing at /umd/ leaves the import failing silently.
const FFMPEG_CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

type Step =
  | "pick-video"
  | "choose-recipe"
  | "pick-recipe"
  | "extract-recipe"
  | "timeline-edit"
  | "processing"
  | "uploading"
  | "flagged"
  | "config-error";

interface AttachedRecipe {
  kind: "chef" | "public";
  id: number | string;
  title: string;
  thumb: string | null;
}

export default function ChefUploadPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: chefData, isLoading: chefLoading } = useChefMe();
  const createRecipe = useCreateChefRecipe();

  // ── State machine ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("pick-video");
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [attachedRecipe, setAttachedRecipe] = useState<AttachedRecipe | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Trim + segments
  const [keptSegments, setKeptSegments] = useState<TimelineSegment[]>([]);
  const [videoDuration, setVideoDuration] = useState(0);
  const timelineVideoRef = useRef<HTMLVideoElement | null>(null);

  // Reel metadata (filled in on the timeline-edit step)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Music
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [originalVolume, setOriginalVolume] = useState(100);
  const [musicVolume, setMusicVolume] = useState(50);

  // Error states
  const [flaggedTrack, setFlaggedTrack] = useState<{ track?: string; artist?: string } | null>(null);
  const [configErrorMessage, setConfigErrorMessage] = useState<string>("");
  const [processingMessage, setProcessingMessage] = useState<string>("");

  // FFmpeg lazy load
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ensureFfmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    setProcessingMessage("Loading editor (one-time, ~10s)…");
    const ff = new FFmpeg();
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    await ff.load({ coreURL, wasmURL, classWorkerURL: ffmpegWorkerUrl });
    ffmpegRef.current = ff;
    return ff;
  }, []);

  // Clean up object URL on unmount / file swap.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // ── File pick ──────────────────────────────────────────────────────────────
  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast({ title: "Pick a video file", variant: "destructive" });
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setAttachedRecipe(null);
    setStep("choose-recipe");
  };

  const handleResetUpload = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(null);
    setVideoUrl(null);
    setAttachedRecipe(null);
    setKeptSegments([]);
    setTitle("");
    setDescription("");
    setSelectedMusic(null);
    setStep("pick-video");
  };

  // ── Recipe choice handlers ────────────────────────────────────────────────
  const handlePickExisting = () => setPickerOpen(true);
  const handleGenerate = () => setStep("extract-recipe");

  const handleRecipeSelected = (r: SelectedRecipe) => {
    if (r.kind === "chef") {
      setAttachedRecipe({ kind: "chef", id: r.chefRecipeId, title: r.title, thumb: r.photoUrl });
    } else {
      setAttachedRecipe({ kind: "public", id: r.recipeId, title: r.title, thumb: r.image ?? null });
    }
    if (!title) setTitle(r.title);
    setStep("timeline-edit");
  };

  const handleExtractedRecipeSubmit = async (payload: ChefRecipeInput) => {
    try {
      const { recipe } = await createRecipe.mutateAsync(payload);
      setAttachedRecipe({
        kind: "chef",
        id: recipe.id,
        title: recipe.title,
        thumb: recipe.photoUrl,
      });
      if (!title) setTitle(recipe.title);
      setStep("timeline-edit");
    } catch (err: any) {
      toast({
        title: "Couldn't save recipe",
        description: err?.message ?? "Try again",
        variant: "destructive",
      });
    }
  };

  // ── Timeline → parent: stable callback so the editor's propagation useEffect
  // doesn't re-fire on every parent render (inline arrow recreates each render
  // and caused the editor's deps to churn, which kept keptSegments stale).
  const handleTimelineChange = useCallback((segs: TimelineSegment[], dur: number) => {
    setKeptSegments(segs);
    setVideoDuration(dur);
  }, []);

  // ── FFmpeg processing + upload ────────────────────────────────────────────
  const totalKeptDuration = keptSegments.reduce((acc, s) => acc + (s.end - s.start), 0);

  const handleUpload = async () => {
    if (!file) {
      toast({ title: "No video selected", description: "Pick a video to start.", variant: "destructive" });
      return;
    }
    // videoDuration === 0 means metadata hasn't loaded yet (true loading state).
    if (videoDuration === 0) {
      toast({
        title: "Video still loading",
        description: "Wait for the timeline thumbnails to appear, then try again.",
        variant: "destructive",
      });
      return;
    }
    // videoDuration > 0 but no kept segments → user deleted every section.
    if (keptSegments.length === 0) {
      toast({
        title: "No clip to upload",
        description: "Every section is marked deleted. Hit Undo on the timeline to bring one back.",
        variant: "destructive",
      });
      return;
    }
    if (totalKeptDuration < 1) {
      toast({
        title: "Clip too short",
        description: "Need at least 1 second of kept video. Hit Undo on the timeline or widen the trim.",
        variant: "destructive",
      });
      return;
    }
    if (totalKeptDuration > MAX_DURATION_S) {
      toast({
        title: "Clip too long",
        description: `Max ${MAX_DURATION_S / 60} minutes. Currently ${totalKeptDuration.toFixed(1)}s.`,
        variant: "destructive",
      });
      return;
    }

    // Switch to the processing screen IMMEDIATELY so the chef has visual feedback while
    // FFmpeg loads (first-time WASM fetch is ~10s). Otherwise the click looks like a no-op.
    setStep("processing");
    setProcessingMessage("Loading editor (one-time, ~10s)…");

    try {
      const ff = await ensureFfmpeg();
      setProcessingMessage(
        selectedMusic
          ? `Trimming ${keptSegments.length} segment${keptSegments.length === 1 ? "" : "s"}, looping music, compressing…`
          : `Trimming ${keptSegments.length} segment${keptSegments.length === 1 ? "" : "s"}, compressing…`,
      );

      const inputName = "input." + (file.name.split(".").pop() || "mp4");
      const musicName = "music.mp3";
      const outputName = "output.mp4";

      await ff.writeFile(inputName, await fetchFile(file));
      if (selectedMusic) await ff.writeFile(musicName, await fetchFile(selectedMusic.fileUrl));

      const args: string[] = [];
      // Music input first (with infinite loop) so video remains the deterministic [0:*] when no music.
      const musicIdx = 0;
      const videoIdx = selectedMusic ? 1 : 0;
      if (selectedMusic) {
        args.push("-stream_loop", "-1", "-i", musicName);
      }
      args.push("-i", inputName);

      // Build filter_complex.
      const segCount = keptSegments.length;
      const filters: string[] = [];

      keptSegments.forEach((s, i) => {
        filters.push(`[${videoIdx}:v]trim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
        filters.push(`[${videoIdx}:a]atrim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
      });

      // Concat (or pass-through if single segment)
      if (segCount > 1) {
        const vRefs = keptSegments.map((_, i) => `[v${i}]`).join("");
        const aRefs = keptSegments.map((_, i) => `[a${i}]`).join("");
        filters.push(`${vRefs}concat=n=${segCount}:v=1:a=0[catv]`);
        filters.push(`${aRefs}concat=n=${segCount}:v=0:a=1[cata]`);
      } else {
        filters.push(`[v0]null[catv]`);
        filters.push(`[a0]anull[cata]`);
      }

      let audioOutputLabel = "[cata]";
      if (selectedMusic) {
        const vOrig = (originalVolume / 100).toFixed(2);
        const vMusic = (musicVolume / 100).toFixed(2);
        filters.push(`[cata]volume=${vOrig}[mainA]`);
        filters.push(`[${musicIdx}:a]volume=${vMusic}[musicA]`);
        // duration=first ensures the mixed audio ends with the (already-trimmed) main audio,
        // so the looped music doesn't extend past the video.
        filters.push(`[mainA][musicA]amix=inputs=2:duration=first:dropout_transition=0[outa]`);
        audioOutputLabel = "[outa]";
      }

      args.push("-filter_complex", filters.join(";"));
      args.push("-map", "[catv]");
      args.push("-map", audioOutputLabel);
      args.push(
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-b:v", "3000k",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-shortest",
        "-y",
        outputName,
      );

      await ff.exec(args);

      const data = await ff.readFile(outputName);
      const processedBlob = new Blob(
        [data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))],
        { type: "video/mp4" },
      );

      // Cleanup FFmpeg FS.
      await ff.deleteFile(inputName).catch(() => {});
      if (selectedMusic) await ff.deleteFile(musicName).catch(() => {});
      await ff.deleteFile(outputName).catch(() => {});

      if (processedBlob.size > 50 * 1024 * 1024) {
        toast({
          title: "Processed file too large",
          description: `${(processedBlob.size / 1024 / 1024).toFixed(1)}MB exceeds the 50MB cap. Trim more aggressively.`,
          variant: "destructive",
        });
        setStep("timeline-edit");
        return;
      }

      setStep("uploading");

      const formData = new FormData();
      formData.append("video", processedBlob, "reel.mp4");
      if (title) formData.append("title", title);
      if (description) formData.append("description", description);
      if (attachedRecipe) {
        if (attachedRecipe.kind === "chef") formData.append("chefRecipeId", String(attachedRecipe.id));
        else formData.append("recipeId", String(attachedRecipe.id));
      }

      const res = await fetch("/api/reels/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 422 && body.status === "flagged") {
        setFlaggedTrack({ track: body.track, artist: body.artist });
        setStep("flagged");
        return;
      }
      if (res.status === 503 && body.configError) {
        setConfigErrorMessage(body.error || "Server is missing credentials.");
        setStep("config-error");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? `Upload failed (HTTP ${res.status})`);

      toast({
        title: "Reel uploaded",
        description: "Cloudflare is finishing processing — your reel will appear shortly.",
      });
      setLocation("/chef/me");
    } catch (err: any) {
      console.error("[chef-upload] Processing/upload failed:", err);
      toast({
        title: "Upload failed",
        description: err?.message ? String(err.message) : "Something went wrong.",
        variant: "destructive",
      });
      setStep("timeline-edit");
    }
  };

  // ── Gates ──────────────────────────────────────────────────────────────────
  if (chefLoading) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!chefData?.profile?.isApproved) {
    return (
      <div className="min-h-[calc(100vh-9rem)] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-recipal-orange/10 flex items-center justify-center mb-4">
          <ChefHat className="w-10 h-10 text-recipal-orange" />
        </div>
        <h1 className="text-xl font-bold mb-2">Chef Creators only</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Only approved Chef Creators can upload reels. Apply from the hamburger menu.
        </p>
        <Button
          variant="ghost"
          onClick={() => goBack(setLocation, "/reels")}
          className="mt-5"
          data-testid="button-upload-gate-back"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
    );
  }

  // ── Header (shared across steps) ───────────────────────────────────────────
  const headerTitle = ({
    "pick-video":     "Upload Reel",
    "choose-recipe":  "Choose Recipe",
    "pick-recipe":    "Choose Recipe",
    "extract-recipe": "Generate Recipe",
    "timeline-edit":  "Trim & Finalize",
    "processing":     "Processing…",
    "uploading":      "Uploading…",
    "flagged":        "Audio flagged",
    "config-error":   "Setup incomplete",
  } as Record<Step, string>)[step];

  const canGoBack = step !== "pick-video" && step !== "processing" && step !== "uploading";
  const handleBack = () => {
    if (step === "choose-recipe") handleResetUpload();
    else if (step === "extract-recipe") setStep("choose-recipe");
    else if (step === "timeline-edit") setStep("choose-recipe");
    else if (step === "flagged" || step === "config-error") setStep("timeline-edit");
  };

  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-5 pb-24">
      <header className="flex items-center gap-3">
        {canGoBack ? (
          <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-step-back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        ) : step === "pick-video" ? (
          /* Route-level exit on the landing step — the stepper back never leaves
             the route, and processing/uploading deliberately block exits. */
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goBack(setLocation, "/reels")}
            data-testid="button-upload-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-recipal-orange flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-recipal-deep-green dark:text-foreground">{headerTitle}</h1>
          <p className="text-xs text-muted-foreground">
            {step === "pick-video" && "Pick a video, choose a recipe, then trim & publish."}
            {step === "choose-recipe" && "Attach an existing recipe or generate a new one from the video."}
            {step === "timeline-edit" && "Trim, split, add music, then publish."}
            {step === "extract-recipe" && "Reading your video and pulling out the recipe."}
          </p>
        </div>
      </header>

      {/* STEP: pick-video */}
      {step === "pick-video" && (
        <div className="border-2 border-dashed border-recipal-orange/30 rounded-2xl p-8 text-center bg-recipal-orange/5">
          <Upload className="w-10 h-10 text-recipal-orange/60 mx-auto mb-3" />
          <p className="text-sm font-medium mb-3">Pick a video to upload</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-recipal-orange hover:bg-recipal-orange/90 text-white"
            data-testid="button-pick-video"
          >
            Select video
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFilePick}
            data-testid="input-video-file"
          />
        </div>
      )}

      {/* STEP: choose-recipe */}
      {step === "choose-recipe" && (
        <>
          <RecipeChoiceStep onPickExisting={handlePickExisting} onGenerate={handleGenerate} />
          <RecipePickerSheet
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={handleRecipeSelected}
          />
        </>
      )}

      {/* STEP: extract-recipe */}
      {step === "extract-recipe" && file && (
        <RecipeExtractionView
          videoFile={file}
          onSubmit={handleExtractedRecipeSubmit}
          isSubmitting={createRecipe.isPending}
          onCancel={() => setStep("choose-recipe")}
        />
      )}

      {/* STEP: timeline-edit */}
      {step === "timeline-edit" && file && (
        <>
          {/* Attached recipe pill */}
          {attachedRecipe && (
            <div className="flex items-center gap-3 rounded-xl border bg-card p-2.5">
              <div className="w-10 h-10 rounded-lg bg-recipal-orange/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                {attachedRecipe.thumb ? (
                  <img src={attachedRecipe.thumb} alt={attachedRecipe.title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-4 h-4 text-recipal-orange" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Attached recipe ({attachedRecipe.kind === "chef" ? "your library" : "ReciPal"})
                </p>
                <p className="text-sm font-bold truncate">{attachedRecipe.title}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStep("choose-recipe")}
                className="text-xs text-recipal-orange"
              >
                Change
              </Button>
            </div>
          )}

          <TimelineTrimEditor
            videoFile={file}
            maxDuration={MAX_DURATION_S}
            onChange={handleTimelineChange}
            onVideoElementReady={(el) => { timelineVideoRef.current = el; }}
          />

          {/* Title + description */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., 30-second carbonara" maxLength={200} className="mt-1" data-testid="input-reel-title" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell viewers what's cooking. Use #hashtags." maxLength={2000} className="mt-1 min-h-[60px] resize-none" data-testid="textarea-reel-description" />
            </div>
          </div>

          {/* Music — optional. Process & upload is gated only on trimValid, not music. */}
          {!selectedMusic ? (
            <button
              onClick={() => setMusicPickerOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-recipal-orange/30 bg-recipal-orange/5 hover:bg-recipal-orange/10 transition-colors"
              data-testid="button-add-music"
            >
              <div className="w-9 h-9 rounded-full bg-recipal-orange/15 flex items-center justify-center flex-shrink-0">
                <Music className="w-4 h-4 text-recipal-orange" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold">Add Music</p>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    Optional
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Loops automatically if shorter than your video</p>
              </div>
            </button>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <div className="w-9 h-9 rounded-full bg-recipal-orange/15 flex items-center justify-center flex-shrink-0">
                  <Music className="w-4 h-4 text-recipal-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedMusic.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedMusic.artist || "Unknown"}
                    {selectedMusic.vibe && <span className="capitalize"> · {selectedMusic.vibe}</span>}
                    <span> · loops</span>
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setMusicPickerOpen(true)} className="text-recipal-orange text-xs">Change</Button>
                <button onClick={() => setSelectedMusic(null)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Original audio</label>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{originalVolume}%</span>
                  </div>
                  <Slider value={[originalVolume]} min={0} max={100} step={5} onValueChange={([v]) => setOriginalVolume(v)} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Music</label>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{musicVolume}%</span>
                  </div>
                  <Slider value={[musicVolume]} min={0} max={100} step={5} onValueChange={([v]) => setMusicVolume(v)} />
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white gap-2"
            data-testid="button-process-upload"
          >
            Process & upload
          </Button>
        </>
      )}

      {/* STEP: processing / uploading */}
      {(step === "processing" || step === "uploading") && (
        <div className="rounded-2xl border bg-card p-6 flex flex-col items-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-recipal-orange mb-3" />
          <p className="text-sm font-semibold">
            {step === "processing" ? processingMessage || "Processing video…" : "Fingerprinting and uploading…"}
          </p>
        </div>
      )}

      {/* STEP: flagged */}
      {step === "flagged" && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-destructive">Copyrighted audio detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                {flaggedTrack?.track && flaggedTrack?.artist
                  ? `"${flaggedTrack.track}" by ${flaggedTrack.artist} was matched.`
                  : "A copyrighted track was detected in this video."}
                {" "}Replace with the original audio or add a royalty-free music track instead.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP: config-error */}
      {step === "config-error" && (
        <div className="rounded-2xl border border-amber-300/50 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="font-bold text-amber-700 dark:text-amber-400">Setup incomplete</p>
          <p className="text-xs text-muted-foreground mt-1">{configErrorMessage}</p>
        </div>
      )}

      <MusicPickerSheet
        open={musicPickerOpen}
        onOpenChange={setMusicPickerOpen}
        selectedTrackId={selectedMusic?.id ?? null}
        onSelect={(t) => setSelectedMusic(t)}
      />
    </div>
  );
}
