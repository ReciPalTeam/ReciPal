import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CreatorModeStore {
  isCreatorMode: boolean;
  setCreatorMode: (active: boolean) => void;
  toggle: () => void;
}

export const useCreatorMode = create<CreatorModeStore>()(
  persist(
    (set) => ({
      isCreatorMode: false,
      setCreatorMode: (active: boolean) => set({ isCreatorMode: active }),
      toggle: () => set((s) => ({ isCreatorMode: !s.isCreatorMode })),
    }),
    { name: "recipal-creator-mode" }
  )
);
