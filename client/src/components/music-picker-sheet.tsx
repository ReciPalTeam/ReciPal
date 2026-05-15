import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Music, Search, Play, Pause, Check, Loader2 } from "lucide-react";
import { useMusicSearch, MUSIC_VIBES, type MusicTrack } from "@/hooks/use-music";

interface MusicPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTrackId?: number | null;
  onSelect: (track: MusicTrack) => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicPickerSheet({ open, onOpenChange, selectedTrackId, onSelect }: MusicPickerSheetProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [vibe, setVibe] = useState<string>("");
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Stop preview on close
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPreviewingId(null);
    }
  }, [open]);

  const { data: tracks, isLoading, error } = useMusicSearch({ q: debouncedQuery, vibe });

  const handlePreview = (track: MusicTrack) => {
    if (previewingId === track.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPreviewingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(track.fileUrl);
    audio.addEventListener("ended", () => setPreviewingId(null));
    audio.play().catch(() => setPreviewingId(null));
    audioRef.current = audio;
    setPreviewingId(track.id);
  };

  const handleSelect = (track: MusicTrack) => {
    audioRef.current?.pause();
    setPreviewingId(null);
    onSelect(track);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden gap-0 max-h-[85vh] flex flex-col"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        }}
      >
        <div className="bg-gradient-to-br from-recipal-orange/10 to-recipal-orange/5 px-6 pt-5 pb-4 border-b">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-recipal-orange flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </div>
            <DialogTitle className="text-lg font-bold text-recipal-deep-green dark:text-foreground">
              Add Music
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground ml-12">
            Royalty-free tracks from our curated Pixabay Music library.
          </DialogDescription>
        </div>

        <div className="px-4 py-3 border-b space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or artist"
              className="pl-9"
              data-testid="input-music-search"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setVibe("")}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                vibe === ""
                  ? "bg-recipal-orange text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
              data-testid="vibe-chip-all"
            >
              All
            </button>
            {MUSIC_VIBES.map((v) => (
              <button
                key={v}
                onClick={() => setVibe(v === vibe ? "" : v)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all capitalize ${
                  vibe === v
                    ? "bg-recipal-orange text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
                data-testid={`vibe-chip-${v}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 px-6">
              <p className="text-sm text-destructive">Couldn't load music library.</p>
            </div>
          ) : !tracks || tracks.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Music className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground mb-1">
                Music library is being curated
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {debouncedQuery || vibe
                  ? "No matches. Try a different search or filter."
                  : "Royalty-free tracks from Pixabay Music are being added. Check back soon."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {tracks.map((track) => {
                const isSelected = selectedTrackId === track.id;
                const isPreviewing = previewingId === track.id;
                return (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isSelected ? "bg-recipal-orange/10" : "hover:bg-muted/50"
                    }`}
                    data-testid={`music-track-${track.id}`}
                  >
                    <button
                      onClick={() => handlePreview(track)}
                      className="flex-shrink-0 w-9 h-9 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                      data-testid={`button-preview-${track.id}`}
                      aria-label={isPreviewing ? "Pause preview" : "Play preview"}
                    >
                      {isPreviewing ? (
                        <Pause className="w-4 h-4 text-recipal-orange" />
                      ) : (
                        <Play className="w-4 h-4 text-recipal-deep-green dark:text-foreground ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.artist || "Unknown"}
                        {track.vibe && (
                          <span className="ml-1.5 capitalize">· {track.vibe}</span>
                        )}
                        <span className="ml-1.5">· {formatDuration(track.durationS)}</span>
                      </p>
                    </div>
                    {isSelected ? (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-recipal-orange flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-recipal-orange hover:text-recipal-orange hover:bg-recipal-orange/10 flex-shrink-0 text-xs"
                        onClick={() => handleSelect(track)}
                        data-testid={`button-select-${track.id}`}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
