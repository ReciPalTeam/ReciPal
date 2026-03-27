import { useDevicePreview, DEVICE_PROFILES } from "@/lib/device-preview-store";

export function DevicePreviewFrame({ children }: { children: React.ReactNode }) {
  const { activeDeviceId, isLandscape } = useDevicePreview();
  const device = DEVICE_PROFILES.find((d) => d.id === activeDeviceId);

  // No device selected — render normally with toolbar offset
  if (!device) {
    return <div className="pt-10">{children}</div>;
  }

  const frameW = isLandscape ? device.height : device.width;
  const frameH = isLandscape ? device.width : device.height;

  return (
    <div className="pt-10 min-h-screen bg-zinc-200 dark:bg-zinc-800 flex items-start justify-center p-6">
      {/* Device bezel */}
      <div
        className="relative bg-zinc-900 rounded-[40px] shadow-2xl p-3 flex-shrink-0"
        style={{
          width: frameW + 24,
          height: frameH + 24,
        }}
      >
        {/* Notch / dynamic island */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-zinc-900 rounded-b-xl z-10" />

        {/* Screen */}
        <div
          className="relative bg-background rounded-[28px] overflow-hidden"
          style={{ width: frameW, height: frameH }}
        >
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-zinc-600 rounded-full" />
      </div>
    </div>
  );
}
