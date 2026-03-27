import {
  useDevicePreview,
  DEVICE_PROFILES,
  CATEGORY_LABELS,
} from "@/lib/device-preview-store";
import { Monitor, RotateCcw, ChevronDown } from "lucide-react";
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

  const displayWidth = activeDevice
    ? isLandscape ? activeDevice.height : activeDevice.width
    : null;
  const displayHeight = activeDevice
    ? isLandscape ? activeDevice.width : activeDevice.height
    : null;

  const categories = Object.keys(CATEGORY_LABELS);

  return (
    <div className="fixed top-0 left-0 z-[9999] flex items-center gap-1 p-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm border-zinc-200 dark:border-zinc-700"
          >
            {activeDevice ? (
              <>
                <span className="max-w-[120px] truncate">{activeDevice.name}</span>
                <span className="text-muted-foreground">
                  {displayWidth}&times;{displayHeight}
                </span>
              </>
            ) : (
              <>
                <Monitor className="w-3 h-3" />
                <span>Responsive</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="z-[10000] max-h-[70vh] overflow-y-auto w-56"
        >
          <DropdownMenuItem
            onClick={() => setDevice(null)}
            className={!activeDeviceId ? "bg-accent" : ""}
          >
            <Monitor className="w-3.5 h-3.5 mr-2" />
            Desktop / Responsive
          </DropdownMenuItem>
          {categories.map((cat) => {
            const devices = DEVICE_PROFILES.filter((d) => d.category === cat);
            if (devices.length === 0) return null;
            return (
              <div key={cat}>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </DropdownMenuLabel>
                {devices.map((d) => (
                  <DropdownMenuItem
                    key={d.id}
                    onClick={() => setDevice(d.id)}
                    className={activeDeviceId === d.id ? "bg-accent" : ""}
                  >
                    <span className="flex-1 text-xs">{d.name}</span>
                    <span className="text-muted-foreground text-[10px] ml-2 tabular-nums">
                      {d.width}&times;{d.height}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeDevice && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm border-zinc-200 dark:border-zinc-700"
          onClick={toggleOrientation}
          title={isLandscape ? "Switch to portrait" : "Switch to landscape"}
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
