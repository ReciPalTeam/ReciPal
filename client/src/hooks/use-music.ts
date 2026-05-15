import { useQuery } from "@tanstack/react-query";

export interface MusicTrack {
  id: number;
  title: string;
  artist: string | null;
  vibe: string | null;
  durationS: number | null;
  fileUrl: string;
  fileSizeBytes: number | null;
  source: string;
  sourceTrackId: string | null;
  tags: string[];
  createdAt: string;
}

export const MUSIC_VIBES = [
  "upbeat",
  "chill",
  "cozy",
  "energetic",
  "cinematic",
  "acoustic",
] as const;
export type MusicVibe = (typeof MUSIC_VIBES)[number];

export function useMusicSearch(params: { q?: string; vibe?: string }) {
  const q = (params.q ?? "").trim();
  const vibe = (params.vibe ?? "").trim();
  const queryKey = ["/api/music/search", { q, vibe }] as const;

  return useQuery({
    queryKey,
    queryFn: async () => {
      const search = new URLSearchParams();
      if (q) search.set("q", q);
      if (vibe) search.set("vibe", vibe);
      const url = `/api/music/search${search.toString() ? `?${search}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch music");
      const body = (await res.json()) as { tracks: MusicTrack[] };
      return body.tracks;
    },
    staleTime: 60 * 1000,
  });
}
