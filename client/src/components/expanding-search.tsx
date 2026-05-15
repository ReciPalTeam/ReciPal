import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, X, Loader2, ChefHat, Hash, Play, Clapperboard } from "lucide-react";
import { useSearch } from "@/hooks/use-search";

interface ExpandingSearchProps {
  /** Tailwind className for outer positioning (e.g. fixed top-4 left-4). */
  className?: string;
  /** Optional placeholder. */
  placeholder?: string;
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`.replace(".0", "");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0", "");
}

/**
 * Magnifier button that smoothly expands into a search field with a results dropdown.
 * Designed for the Reels page (dark backdrop, glassy panel) — but reusable elsewhere.
 */
export function ExpandingSearch({
  className = "",
  placeholder = "Search chefs, hashtags, reels",
}: ExpandingSearchProps) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce the query going to the API.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Auto-focus when expanding.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200); // wait for the animation
    } else {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const { data, isLoading } = useSearch(debounced, 5);

  const navigate = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

  const hasResults =
    !!data && (data.chefs.length > 0 || data.hashtags.length > 0 || data.reels.length > 0);

  return (
    <div ref={containerRef} className={className} data-testid="expanding-search">
      <div
        className={`transition-all duration-300 ease-out ${
          open ? "w-[min(92vw,420px)]" : "w-10"
        }`}
      >
        <div
          className={`relative flex items-center bg-black/40 backdrop-blur-md rounded-full overflow-hidden ${
            open ? "h-10 pl-3 pr-2" : "h-10 w-10 justify-center"
          }`}
        >
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="w-full h-full flex items-center justify-center text-white"
              data-testid="button-open-search"
              aria-label="Open search"
            >
              <Search className="w-5 h-5" />
            </button>
          ) : (
            <>
              <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 outline-none px-2"
                data-testid="input-search-query"
              />
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white"
                data-testid="button-close-search"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Results dropdown */}
        {open && debounced.length > 0 && (
          <div className="mt-2 bg-black/70 backdrop-blur-md rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-white/60" />
              </div>
            ) : !hasResults ? (
              <div className="text-center py-6 text-white/60 text-xs">
                No matches for "{debounced}"
              </div>
            ) : (
              <div className="py-1">
                {/* Chefs */}
                {data && data.chefs.length > 0 && (
                  <div className="py-1">
                    <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      Chefs
                    </div>
                    {data.chefs.map((c) => (
                      <button
                        key={`chef-${c.id}`}
                        onClick={() => navigate(`/chef/${c.handle}`)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/10 transition-colors text-left"
                        data-testid={`search-chef-${c.id}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-recipal-orange/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <ChefHat className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{c.displayName}</p>
                          <p className="text-[11px] text-white/60 truncate">@{c.handle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Hashtags */}
                {data && data.hashtags.length > 0 && (
                  <div className="py-1">
                    <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      Hashtags
                    </div>
                    {data.hashtags.map((h) => (
                      <button
                        key={`tag-${h.tag}`}
                        onClick={() => navigate(`/hashtag/${h.tag}`)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/10 transition-colors text-left"
                        data-testid={`search-hashtag-${h.tag}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-recipal-orange/30 flex items-center justify-center flex-shrink-0">
                          <Hash className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">#{h.tag}</p>
                          <p className="text-[11px] text-white/60">
                            {formatCount(h.usageCount)} reel{h.usageCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Reels */}
                {data && data.reels.length > 0 && (
                  <div className="py-1">
                    <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      Reels
                    </div>
                    {data.reels.map((r) => (
                      <button
                        key={`reel-${r.id}`}
                        onClick={() => navigate(`/chef/${r.chefHandle}`)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/10 transition-colors text-left"
                        data-testid={`search-reel-${r.id}`}
                      >
                        <div className="w-10 h-14 rounded-md bg-recipal-deep-green/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {r.thumbnailUrl ? (
                            <img src={r.thumbnailUrl} alt={r.title ?? "Reel"} className="w-full h-full object-cover" />
                          ) : (
                            <Clapperboard className="w-4 h-4 text-white/60" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {r.title ?? "Untitled reel"}
                          </p>
                          <p className="text-[11px] text-white/60 truncate flex items-center gap-1.5">
                            <span>@{r.chefHandle}</span>
                            <span className="text-white/30">·</span>
                            <Play className="w-2.5 h-2.5" fill="currentColor" />
                            <span>{formatCount(r.viewCount)}</span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
