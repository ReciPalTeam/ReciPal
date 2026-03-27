import { useDevicePreview, DEVICE_PROFILES } from "@/lib/device-preview-store";

export function DevicePreviewFrame({ children }: { children: React.ReactNode }) {
  const { activeDeviceId, isLandscape } = useDevicePreview();
  const device = DEVICE_PROFILES.find((d) => d.id === activeDeviceId);

  // No device selected — render normally, no offset needed
  if (!device) {
    return <>{children}</>;
  }

  const frameW = isLandscape ? device.height : device.width;
  const frameH = isLandscape ? device.width : device.height;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 flex items-start justify-center pt-10 pb-4">
      <div
        className="relative bg-background border border-zinc-300 dark:border-zinc-700 overflow-hidden flex-shrink-0"
        style={{
          width: frameW,
          height: frameH,
          transform: "translateZ(0)", // creates containing block for position:fixed children
        }}
      >
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
