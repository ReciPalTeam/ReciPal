/**
 * Canvas-based image utilities for the chef upload flow.
 *
 *  - extractFrameAsBlob:        capture one frame from a <video> at a timestamp.
 *  - extractFrameAsObjectUrl:   convenience wrapper that returns an object URL.
 *  - cropImageFileToAspect:     center-crop an uploaded image File to a target aspect.
 *
 * All three optionally center-crop their output to a target aspect ratio so the chef's
 * recipe photo lands square (1:1) regardless of whether it came from a video frame or a
 * file picker.
 */

/**
 * Compute the center-crop source rectangle that fits a target aspect inside a source
 * width×height, choosing the largest rectangle that doesn't upscale.
 */
function centerCropRect(srcW: number, srcH: number, targetAspect: number) {
  const srcAspect = srcW / srcH;
  let sw: number;
  let sh: number;
  if (srcAspect > targetAspect) {
    // Source is wider than target — crop sides.
    sh = srcH;
    sw = srcH * targetAspect;
  } else {
    // Source is taller — crop top/bottom.
    sw = srcW;
    sh = srcW / targetAspect;
  }
  const sx = (srcW - sw) / 2;
  const sy = (srcH - sh) / 2;
  return { sx, sy, sw, sh };
}

/**
 * Capture a single frame from a loaded <video> element at timestamp `t`.
 * Optionally center-crop to `targetAspect` (e.g. 1 for square).
 */
export async function extractFrameAsBlob(
  video: HTMLVideoElement,
  t: number,
  q = 0.7,
  targetAspect?: number,
): Promise<Blob> {
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      resolve();
    };
    const onErr = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
      reject(new Error("Video seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onErr);
    video.currentTime = Math.max(0, Math.min(t, video.duration || t));
  });

  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  if (srcW === 0 || srcH === 0) throw new Error("Video has no dimensions yet");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");

  if (targetAspect && Number.isFinite(targetAspect) && targetAspect > 0) {
    const { sx, sy, sw, sh } = centerCropRect(srcW, srcH, targetAspect);
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  } else {
    canvas.width = srcW;
    canvas.height = srcH;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob returned null"))),
      "image/jpeg",
      q,
    );
  });
}

/** Convenience: get an object URL instead of a Blob. Caller must revoke when done. */
export async function extractFrameAsObjectUrl(
  video: HTMLVideoElement,
  t: number,
  q = 0.7,
  targetAspect?: number,
): Promise<string> {
  const blob = await extractFrameAsBlob(video, t, q, targetAspect);
  return URL.createObjectURL(blob);
}

/**
 * Load an image File, center-crop it to the target aspect, and return a JPEG Blob.
 * No upscaling — output dimensions are the largest center-crop rectangle that fits.
 */
export async function cropImageFileToAspect(
  file: File,
  targetAspect = 1,
  q = 0.85,
): Promise<Blob> {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = objectUrl;
    });
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (srcW === 0 || srcH === 0) throw new Error("Image has no dimensions");

    const { sx, sy, sw, sh } = centerCropRect(srcW, srcH, targetAspect);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D canvas context");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob returned null"))),
        "image/jpeg",
        q,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
