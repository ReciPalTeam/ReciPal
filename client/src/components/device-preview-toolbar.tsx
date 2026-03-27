import { useDevicePreview, DEVICE_PROFILES } from "@/lib/device-preview-store";
import { Monitor, Smartphone, Tablet, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DevicePreviewToolbar() {
  const { activeDeviceId, isLandscape, setDevice, toggleOrientation } =
    useDevicePreview();

  const activeDevice = DEVICE_PROFILES.find((d) => d.id === activeDeviceId);
  const phones = DEVICE_PROFILES.filter((d) => d.category === "phone");
  const tablets = DEVICE_PROFILES.filter((d) => d.category === "tablet");

  const displayWidth = activeDevice
    ? isLandscape
      ? activeDevice.height
      : activeDevice.width
    : null;
  const displayHeight = activeDevice
    ? isLandscape
      ? activeDevice.width
      : activeDevice.height
    : null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-zinc-900 text-white h-10 flex items-center px-3 gap-2 text-sm select-none">
      <span className="font-semibold text-xs tracking-wide uppercase text-zinc-400 mr-2">
        Preview
      </span>

      {/* Desktop / Responsive (no frame) */}
      <Button
        variant={activeDeviceId === null ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs gap-1.5"
        onClick={() => setDevice(null)}
      >
        <Monitor className="w-3.5 h-3.5" />
        Desktop
      </Button>

      {/* Phone dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={
              activeDevice?.category === "phone" ? "secondary" : "ghost"
            }
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" />
            {activeDevice?.category === "phone"
              ? activeDevice.name
              : "Phone"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[10000]">
          <DropdownMenuLabel>Phones</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {phones.map((d) => (
            <DropdownMenuItem
              key={d.id}
              onClick={() => setDevice(d.id)}
              className={activeDeviceId === d.id ? "bg-accent" : ""}
            >
              <span className="flex-1">{d.name}</span>
              <span className="text-muted-foreground text-xs ml-3">
                {d.width}&times;{d.height}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tablet dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={
              activeDevice?.category === "tablet" ? "secondary" : "ghost"
            }
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
          >
            <Tablet className="w-3.5 h-3.5" />
            {activeDevice?.category === "tablet"
              ? activeDevice.name
              : "Tablet"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[10000]">
          <DropdownMenuLabel>Tablets</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tablets.map((d) => (
            <DropdownMenuItem
              key={d.id}
              onClick={() => setDevice(d.id)}
              className={activeDeviceId === d.id ? "bg-accent" : ""}
            >
              <span className="flex-1">{d.name}</span>
              <span className="text-muted-foreground text-xs ml-3">
                {d.width}&times;{d.height}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Orientation toggle + dimensions */}
      {activeDevice && (
        <>
          <div className="h-4 w-px bg-zinc-700 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={toggleOrientation}
            title="Toggle orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isLandscape ? "Landscape" : "Portrait"}
          </Button>
          <span className="text-zinc-500 text-xs">
            {displayWidth}&times;{displayHeight}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 ml-auto"
            onClick={() => setDevice(null)}
            title="Close preview"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
