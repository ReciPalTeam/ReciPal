import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DeviceProfile {
  id: string;
  name: string;
  width: number;
  height: number;
  category: "phone" | "tablet" | "desktop";
}

export const DEVICE_PROFILES: DeviceProfile[] = [
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667, category: "phone" },
  { id: "iphone-14", name: "iPhone 14", width: 390, height: 844, category: "phone" },
  { id: "iphone-14-pro-max", name: "iPhone 14 Pro Max", width: 430, height: 932, category: "phone" },
  { id: "galaxy-s24", name: "Galaxy S24", width: 360, height: 780, category: "phone" },
  { id: "pixel-8", name: "Pixel 8", width: 412, height: 915, category: "phone" },
  { id: "ipad-mini", name: "iPad Mini", width: 768, height: 1024, category: "tablet" },
  { id: "ipad-pro", name: 'iPad Pro 12.9"', width: 1024, height: 1366, category: "tablet" },
];

interface DevicePreviewState {
  activeDeviceId: string | null;
  isLandscape: boolean;
  setDevice: (id: string | null) => void;
  toggleOrientation: () => void;
}

export const useDevicePreview = create<DevicePreviewState>()(
  persist(
    (set) => ({
      activeDeviceId: null,
      isLandscape: false,
      setDevice: (id) => set({ activeDeviceId: id }),
      toggleOrientation: () => set((s) => ({ isLandscape: !s.isLandscape })),
    }),
    { name: "recipal-device-preview" }
  )
);
