import { create } from "zustand";
import type { ReelsFeedType } from "@/hooks/use-reels";

/**
 * Phase H.17 — which reels feed the user is viewing: "discover" (all chefs, default) or
 * "following" (only chefs they follow). Transient UI state, mirrors creator-mode-store.
 */
interface ReelsFeedState {
  feedType: ReelsFeedType;
  setFeedType: (t: ReelsFeedType) => void;
}

export const useReelsFeedStore = create<ReelsFeedState>((set) => ({
  feedType: "discover",
  setFeedType: (feedType) => set({ feedType }),
}));
