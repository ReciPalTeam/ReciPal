import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DeviceProfile {
  id: string;
  name: string;
  width: number;
  height: number;
  category: "iphone" | "galaxy" | "other-phone" | "ipad" | "android-tablet";
}

export const DEVICE_PROFILES: DeviceProfile[] = [
  // iPhones
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667, category: "iphone" },
  { id: "iphone-13-mini", name: "iPhone 13 Mini", width: 375, height: 812, category: "iphone" },
  { id: "iphone-14", name: "iPhone 14", width: 390, height: 844, category: "iphone" },
  { id: "iphone-14-plus", name: "iPhone 14 Plus", width: 428, height: 926, category: "iphone" },
  { id: "iphone-14-pro", name: "iPhone 14 Pro", width: 393, height: 852, category: "iphone" },
  { id: "iphone-14-pro-max", name: "iPhone 14 Pro Max", width: 430, height: 932, category: "iphone" },
  { id: "iphone-15", name: "iPhone 15", width: 393, height: 852, category: "iphone" },
  { id: "iphone-15-plus", name: "iPhone 15 Plus", width: 430, height: 932, category: "iphone" },
  { id: "iphone-15-pro", name: "iPhone 15 Pro", width: 393, height: 852, category: "iphone" },
  { id: "iphone-15-pro-max", name: "iPhone 15 Pro Max", width: 430, height: 932, category: "iphone" },
  { id: "iphone-16", name: "iPhone 16", width: 393, height: 852, category: "iphone" },
  { id: "iphone-16-plus", name: "iPhone 16 Plus", width: 430, height: 932, category: "iphone" },
  { id: "iphone-16-pro", name: "iPhone 16 Pro", width: 402, height: 874, category: "iphone" },
  { id: "iphone-16-pro-max", name: "iPhone 16 Pro Max", width: 440, height: 956, category: "iphone" },
  { id: "iphone-17-pro-max", name: "iPhone 17 Pro Max", width: 440, height: 956, category: "iphone" },

  // Samsung Galaxy
  { id: "galaxy-s23", name: "Galaxy S23", width: 360, height: 780, category: "galaxy" },
  { id: "galaxy-s23-plus", name: "Galaxy S23+", width: 384, height: 824, category: "galaxy" },
  { id: "galaxy-s23-ultra", name: "Galaxy S23 Ultra", width: 384, height: 824, category: "galaxy" },
  { id: "galaxy-s24", name: "Galaxy S24", width: 360, height: 780, category: "galaxy" },
  { id: "galaxy-s24-plus", name: "Galaxy S24+", width: 384, height: 832, category: "galaxy" },
  { id: "galaxy-s24-ultra", name: "Galaxy S24 Ultra", width: 384, height: 832, category: "galaxy" },
  { id: "galaxy-z-flip5", name: "Galaxy Z Flip5", width: 412, height: 916, category: "galaxy" },
  { id: "galaxy-z-fold5", name: "Galaxy Z Fold5", width: 373, height: 839, category: "galaxy" },
  { id: "galaxy-a54", name: "Galaxy A54", width: 412, height: 915, category: "galaxy" },

  // Other phones
  { id: "pixel-8", name: "Pixel 8", width: 412, height: 915, category: "other-phone" },
  { id: "pixel-8-pro", name: "Pixel 8 Pro", width: 412, height: 915, category: "other-phone" },

  // iPads
  { id: "ipad-mini", name: "iPad Mini", width: 768, height: 1024, category: "ipad" },
  { id: "ipad-10th", name: 'iPad 10th Gen', width: 810, height: 1080, category: "ipad" },
  { id: "ipad-air", name: "iPad Air", width: 820, height: 1180, category: "ipad" },
  { id: "ipad-pro-11", name: 'iPad Pro 11"', width: 834, height: 1194, category: "ipad" },
  { id: "ipad-pro-13", name: 'iPad Pro 12.9"', width: 1024, height: 1366, category: "ipad" },

  // Android tablets
  { id: "galaxy-tab-s9", name: "Galaxy Tab S9", width: 753, height: 1205, category: "android-tablet" },
  { id: "galaxy-tab-s9-plus", name: "Galaxy Tab S9+", width: 930, height: 1488, category: "android-tablet" },
  { id: "galaxy-tab-s9-ultra", name: "Galaxy Tab S9 Ultra", width: 1080, height: 1720, category: "android-tablet" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  iphone: "iPhones",
  galaxy: "Samsung Galaxy",
  "other-phone": "Other Phones",
  ipad: "iPads",
  "android-tablet": "Android Tablets",
};

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
