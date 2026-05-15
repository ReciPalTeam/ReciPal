import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Scissors, Trash2, Loader2, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractFrameAsObjectUrl } from "@/lib/video-frame";

export interface TimelineSegment {
  start: number;
  end: number;
}

export interface TimelineEditorRef {
  /** The underlying <video> element — exposed so callers (e.g. RecipeForm) can grab a frame. */
  videoEl: HTMLVideoElement | null;
}

interface TimelineTrimEditorProps {
  videoFile: File;
  /** Max total duration of the kept segments (sum). Default 240s. */
  maxDuration?: number;
  /** Fired whenever the kept-segments derivation changes. */
  onChange: (segments: TimelineSegment[], duration: number) => void;
  /** Optional ref-style callback so the parent can access the <video> element. */
  onVideoElementReady?: (el: HTMLVideoElement | null) => void;
}

const THUMB_COUNT = 24;

/**
 * TikTok-style timeline trim editor.
 *
 * Top: a live <video> preview that auto-skips deleted segments via a timeupdate listener
 *      (no re-encoding needed for the preview — orchestration only).
 * Below: a filmstrip of ~24 frame thumbnails with two draggable trim handles, plus inline
 *        "split here" + per-segment delete affordances.
 *
 * The component emits the derived `kept segments` upward; the parent's FFmpeg pipeline reads
 * those segments and builds the concat filter at upload time.
 */
export function TimelineTrimEditor({ videoFile, maxDuration = 240, onChange, onVideoElementReady }: TimelineTrimEditorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [cuts, setCuts] = useState<number[]>([]);
  // Deleted regions stored as time-ranges (not segment indices) so they survive
  // splits and trim-handle adjustments without reshuffling.
  const [deletedRanges, setDeletedRanges] = useState<{ start: number; end: number }[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [playheadT, setPlayheadT] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [splitErrorMsg, setSplitErrorMsg] = useState<string | null>(null);

  // ── Undo history (snapshot before every destructive change) ───────────────
  type Snapshot = { trimStart: number; trimEnd: number; cuts: number[]; deletedRanges: { start: number; end: number }[] };
  const [history, setHistory] = useState<Snapshot[]>([]);
  const currentSnapshot = (): Snapshot => ({
    trimStart,
    trimEnd,
    cuts: [...cuts],
    deletedRanges: deletedRanges.map((r) => ({ ...r })),
  });
  const snapshotsEqual = (a: Snapshot, b: Snapshot) =>
    a.trimStart === b.trimStart &&
    a.trimEnd === b.trimEnd &&
    a.cuts.length === b.cuts.length &&
    a.cuts.every((c, i) => c === b.cuts[i]) &&
    a.deletedRanges.length === b.deletedRanges.length &&
    a.deletedRanges.every((r, i) => r.start === b.deletedRanges[i].start && r.end === b.deletedRanges[i].end);
  const pushHistory = () => setHistory((h) => [...h, currentSnapshot()]);
  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setTrimStart(prev.trimStart);
      setTrimEnd(prev.trimEnd);
      setCuts(prev.cuts);
      setDeletedRanges(prev.deletedRanges);
      return h.slice(0, -1);
    });
  };

  // ── Load video file → object URL ───────────────────────────────────────────
  useEffect(() => {
    const url = URL.createObjectURL(videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  // ── On metadata loaded: capture duration, init trim bounds ────────────────
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    setDuration(d);
    setTrimStart(0);
    setTrimEnd(Math.min(d, maxDuration));
    onVideoElementReady?.(v);
  };

  // ── Extract thumbnail filmstrip (one frame every duration/THUMB_COUNT) ────
  useEffect(() => {
    if (!videoRef.current || duration <= 0) return;
    const v = videoRef.current;
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      // Pause for frame extraction.
      const wasPlaying = !v.paused;
      v.pause();
      for (let i = 0; i < THUMB_COUNT; i++) {
        if (cancelled) break;
        const t = (i / (THUMB_COUNT - 1)) * Math.max(0, duration - 0.1);
        try {
          const url = await extractFrameAsObjectUrl(v, t, 0.4);
          urls.push(url);
          if (!cancelled) setThumbnails([...urls]);
        } catch {
          /* ignore individual frame failures */
        }
      }
      if (!cancelled && wasPlaying) v.play().catch(() => {});
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // Only re-run when the video duration first becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  // ── Derived: kept segments (between consecutive cut boundaries) ───────────
  // A segment is "deleted" if it sits fully inside any deletedRange. Time-based check
  // (with a small epsilon) so splits don't accidentally un-delete sub-pieces.
  const segments = useMemo(() => {
    if (duration <= 0) return [];
    const internalCuts = cuts.filter((c) => c > trimStart && c < trimEnd).sort((a, b) => a - b);
    const boundaries = [trimStart, ...internalCuts, trimEnd];
    return boundaries.slice(0, -1).map((start, i) => {
      const end = boundaries[i + 1];
      const deleted = deletedRanges.some((r) => start >= r.start - 0.01 && end <= r.end + 0.01);
      return { start, end, deleted };
    });
  }, [trimStart, trimEnd, cuts, deletedRanges, duration]);

  const keptSegments: TimelineSegment[] = useMemo(
    () => segments.filter((s) => !s.deleted).map((s) => ({ start: s.start, end: s.end })),
    [segments],
  );

  const keptDuration = useMemo(
    () => keptSegments.reduce((acc, s) => acc + (s.end - s.start), 0),
    [keptSegments],
  );

  useEffect(() => {
    onChange(keptSegments, duration);
  }, [keptSegments, duration, onChange]);

  // ── Playback orchestration ────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      const t = v.currentTime;
      setPlayheadT(t);
      // If we're in a deleted segment, jump to the next kept one (or loop).
      const inKept = keptSegments.find((s) => t >= s.start && t < s.end);
      if (!inKept && keptSegments.length > 0) {
        const next = keptSegments.find((s) => s.start > t);
        v.currentTime = next ? next.start : keptSegments[0].start;
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [keptSegments]);

  // ── Drag handles + click/drag-to-seek on the timeline strip ───────────────
  const dragRef = useRef<"left" | "right" | null>(null);
  const preDragSnapshotRef = useRef<Snapshot | null>(null);
  const isScrubbingRef = useRef<boolean>(false);

  const seekFromPointer = (e: React.PointerEvent) => {
    if (!timelineRef.current || duration <= 0 || !videoRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
  };

  const onHandlePointerDown = (which: "left" | "right") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = which;
    preDragSnapshotRef.current = currentSnapshot();
  };

  // Click anywhere on the timeline body (not on a handle/button) seeks the video.
  // Continues to scrub if the user drags.
  const onTimelinePointerDown = (e: React.PointerEvent) => {
    if (dragRef.current) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) return;
    if (duration <= 0) return;
    isScrubbingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekFromPointer(e);
  };

  const onTimelinePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current && timelineRef.current && duration > 0) {
      const rect = timelineRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = pct * duration;
      if (dragRef.current === "left") {
        const v = Math.min(t, trimEnd - 0.5);
        setTrimStart(v);
        if (videoRef.current) videoRef.current.currentTime = v;
      } else {
        const v = Math.max(t, trimStart + 0.5);
        setTrimEnd(v);
        if (videoRef.current) videoRef.current.currentTime = v;
      }
      return;
    }
    if (isScrubbingRef.current) seekFromPointer(e);
  };

  const onTimelinePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
      if (preDragSnapshotRef.current && !snapshotsEqual(preDragSnapshotRef.current, currentSnapshot())) {
        setHistory((h) => [...h, preDragSnapshotRef.current!]);
      }
      preDragSnapshotRef.current = null;
    }
    if (isScrubbingRef.current) {
      isScrubbingRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  // ── Split + delete actions ─────────────────────────────────────────────────
  const showSplitError = (msg: string) => {
    setSplitErrorMsg(msg);
    window.setTimeout(() => setSplitErrorMsg((cur) => (cur === msg ? null : cur)), 2500);
  };

  const handleSplit = () => {
    const v = videoRef.current;
    if (!v || duration === 0) return;
    const t = v.currentTime;
    if (t <= trimStart + 0.5 || t >= trimEnd - 0.5) {
      showSplitError("Tap the timeline to move the playhead inside the trim window first.");
      return;
    }
    if (cuts.some((c) => Math.abs(c - t) < 0.4)) {
      showSplitError("Too close to an existing split.");
      return;
    }
    pushHistory();
    setCuts((c) => [...c, t].sort((a, b) => a - b));
    // deletedRanges are time-based, so a new cut doesn't reshuffle anything.
  };

  const deleteSegment = (segIdx: number) => {
    const seg = segments[segIdx];
    if (!seg || seg.deleted) return;
    pushHistory();

    // Find the first/last currently-kept segments so we know if this delete is at an edge.
    const keptIndices = segments
      .map((s, i) => (s.deleted ? -1 : i))
      .filter((i) => i >= 0);
    const isLeftmostKept = keptIndices[0] === segIdx;
    const isRightmostKept = keptIndices[keptIndices.length - 1] === segIdx;

    if (isLeftmostKept) {
      // Collapse from the left: move trimStart forward to seg.end and drop the cut at that point.
      setTrimStart(seg.end);
      setCuts((cs) => cs.filter((c) => Math.abs(c - seg.end) >= 0.05));
    } else if (isRightmostKept) {
      // Collapse from the right: pull trimEnd back to seg.start and drop the cut at that point.
      setTrimEnd(seg.start);
      setCuts((cs) => cs.filter((c) => Math.abs(c - seg.start) >= 0.05));
    } else {
      // Middle segment — record the deletion as a time-range; the rendered strip will hide it.
      setDeletedRanges((prev) => [...prev, { start: seg.start, end: seg.end }]);
    }
  };

  // ── Layout helpers ─────────────────────────────────────────────────────────
  const pctOf = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);

  const exceedsMax = keptDuration > maxDuration;
  const tooShort = keptDuration < 1;

  return (
    <div className="space-y-3">
      {/* Video preview */}
      <div className="rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[55vh] mx-auto relative">
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          onLoadedMetadata={handleLoadedMetadata}
          playsInline
          className="w-full h-full object-contain"
          data-testid="timeline-video-preview"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) v.play().catch(() => {});
            else v.pause();
          }}
        />
        {/* Center play/pause indicator */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-7 h-7 text-white" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

      {/* Stats line */}
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>
          {keptDuration.toFixed(1)}s of {duration.toFixed(1)}s
          {segments.length > 1 && <span> · {keptSegments.length} segments</span>}
        </span>
        <span className={exceedsMax ? "text-destructive" : tooShort ? "text-amber-600" : "text-recipal-orange"}>
          {exceedsMax ? `Trim to ≤ ${(maxDuration / 60).toFixed(0)} min` : tooShort ? "Trim is < 1s" : "Looks good"}
        </span>
      </div>

      {/* Action row: split / undo */}
      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSplit}
          disabled={duration === 0}
          className="gap-1.5"
          data-testid="button-split-here"
        >
          <Scissors className="w-3.5 h-3.5" /> Split at playhead
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={undo}
          disabled={history.length === 0}
          className="gap-1.5 text-muted-foreground"
          data-testid="button-undo-timeline"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Undo
        </Button>
      </div>

      {/* Filmstrip timeline */}
      <div
        ref={timelineRef}
        onPointerDown={onTimelinePointerDown}
        onPointerMove={onTimelinePointerMove}
        onPointerUp={onTimelinePointerUp}
        onPointerCancel={onTimelinePointerUp}
        className="relative h-[78px] rounded-xl overflow-hidden bg-muted select-none cursor-pointer touch-none"
        data-testid="timeline-track"
      >
        {/* Frame thumbnails (background) */}
        <div className="absolute inset-0 flex">
          {thumbnails.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="ml-2 text-[11px]">Generating thumbnails…</span>
            </div>
          ) : (
            thumbnails.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="h-full flex-1 object-cover min-w-0"
                draggable={false}
              />
            ))
          )}
        </div>

        {/* Pre-trim grey overlays (outside the trim window) */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-black/55"
          style={{ width: `${pctOf(trimStart)}%` }}
        />
        <div
          className="absolute top-0 bottom-0 right-0 bg-black/55"
          style={{ width: `${100 - pctOf(trimEnd)}%` }}
        />

        {/* Deleted-range overlays — read as visibly removed (opaque + striped + ✕) */}
        {deletedRanges.map((r, i) => {
          const width = pctOf(r.end) - pctOf(r.start);
          return (
            <div
              key={`del-${i}`}
              className="absolute top-0 bottom-0 bg-background/85 border-x-2 border-destructive flex items-center justify-center pointer-events-none"
              style={{
                left: `${pctOf(r.start)}%`,
                width: `${width}%`,
                backgroundImage:
                  "repeating-linear-gradient(135deg, hsl(var(--destructive) / 0.22) 0 6px, transparent 6px 14px)",
              }}
            >
              {width >= 8 && <Trash2 className="w-3.5 h-3.5 text-destructive/80" />}
            </div>
          );
        })}

        {/* Cut markers */}
        {cuts
          .filter((c) => c > trimStart && c < trimEnd)
          .map((c, i) => (
            <div
              key={`cut-${i}`}
              className="absolute top-0 bottom-0 w-[2px] bg-recipal-orange shadow-[0_0_4px_rgba(255,99,0,0.8)]"
              style={{ left: `${pctOf(c)}%` }}
            />
          ))}

        {/* Per-segment delete buttons — only when 2+ kept segments exist (i.e. after a Split).
            A single-segment timeline doesn't need a delete button; the orange handles handle
            edge-trimming directly. */}
        {keptSegments.length >= 2 && segments.map((seg, i) => {
          if (seg.deleted) return null;
          const center = (seg.start + seg.end) / 2;
          const width = pctOf(seg.end) - pctOf(seg.start);
          if (width < 6) return null;
          return (
            <button
              key={`segbtn-${i}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); deleteSegment(i); }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all z-20 bg-destructive text-white hover:bg-destructive/90 shadow-[0_2px_10px_rgba(220,38,38,0.55)]"
              style={{ left: `${pctOf(center)}%` }}
              data-testid={`button-delete-segment-${i}`}
              aria-label="Delete segment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          );
        })}

        {/* Playhead indicator */}
        {duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-white pointer-events-none"
            style={{ left: `${pctOf(playheadT)}%` }}
          />
        )}

        {/* Left trim handle */}
        <div
          onPointerDown={onHandlePointerDown("left")}
          className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-recipal-orange rounded-l-md cursor-ew-resize touch-none flex items-center justify-center shadow-[2px_0_8px_rgba(0,0,0,0.3)] z-10"
          style={{ left: `${pctOf(trimStart)}%` }}
          data-testid="trim-handle-left"
        >
          <div className="w-0.5 h-6 bg-white rounded" />
        </div>

        {/* Right trim handle */}
        <div
          onPointerDown={onHandlePointerDown("right")}
          className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-recipal-orange rounded-r-md cursor-ew-resize touch-none flex items-center justify-center shadow-[-2px_0_8px_rgba(0,0,0,0.3)] z-10"
          style={{ left: `${pctOf(trimEnd)}%` }}
          data-testid="trim-handle-right"
        >
          <div className="w-0.5 h-6 bg-white rounded" />
        </div>
      </div>

      {splitErrorMsg ? (
        <p className="text-[11px] text-destructive text-center font-semibold" data-testid="split-error-msg">
          {splitErrorMsg}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center">
          Tap the timeline to seek. Drag the orange handles to trim. <strong>Split</strong> at the playhead, then tap the red <Trash2 className="w-3 h-3 inline-block -mt-0.5" /> to remove a section. <strong>Undo</strong> reverts the most recent change.
        </p>
      )}
    </div>
  );
}
