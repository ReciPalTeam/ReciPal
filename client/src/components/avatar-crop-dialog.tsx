import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomOut, ZoomIn } from "lucide-react";

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  onCropped: (blob: Blob) => Promise<void> | void;
  isUploading?: boolean;
}

/**
 * Drag-and-zoom circular cropper for profile photos. Hands back a 512×512 JPEG Blob
 * via onCropped, which the parent uploads through the existing avatar endpoint.
 */
export function AvatarCropDialog({ open, onOpenChange, imageUrl, onCropped, isUploading }: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageUrl || !croppedAreaPixels) return;
    const blob = await getCroppedBlob(imageUrl, croppedAreaPixels);
    await onCropped(blob);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden gap-0"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        }}
      >
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Crop Photo</DialogTitle>
          <DialogDescription>Drag to position, pinch or use the slider to zoom.</DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-72 bg-black/90">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={(v) => setZoom(v[0] ?? 1)}
            className="flex-1"
            data-testid="slider-avatar-zoom"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex gap-2 p-4 pt-2 border-t">
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)} disabled={isUploading} data-testid="button-crop-cancel">
            Cancel
          </Button>
          <Button
            className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90 text-white"
            onClick={handleSave}
            disabled={isUploading || !croppedAreaPixels}
            data-testid="button-crop-save"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function getCroppedBlob(imageUrl: string, area: Area): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const out = 512;
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, out, out);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob returned null"))),
      "image/jpeg",
      0.92,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}
