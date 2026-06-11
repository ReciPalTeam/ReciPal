import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

/**
 * Phase M / WS-A3 — upload hardening.
 *
 * multer's `file.mimetype` is the CLIENT-claimed content type — trivially spoofable
 * (an .exe renamed to .jpg sails through a `startsWith("image/")` check). Every
 * uploaded buffer is therefore validated by MAGIC BYTES, and images are re-encoded
 * through sharp, which (a) proves the bytes really decode as an image, (b) strips
 * EXIF/GPS metadata, and (c) destroys polyglot payloads (e.g. image+script hybrids).
 * The returned buffer — never the user's original bytes — is what gets stored/served,
 * always as image/jpeg.
 */

const IMAGE_TYPES = new Set(["jpg", "png", "webp", "heic", "heif", "avif", "gif"]);
const VIDEO_TYPES = new Set(["mp4", "mov", "webm", "avi", "mkv", "3gp", "m4v"]);

export class UploadValidationError extends Error {}

/** Validate magic bytes + re-encode to a clean JPEG. Throws UploadValidationError. */
export async function sanitizeImageUpload(
  buffer: Buffer,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<{ buffer: Buffer; contentType: "image/jpeg"; ext: "jpg" }> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !IMAGE_TYPES.has(detected.ext)) {
    throw new UploadValidationError("File content is not a supported image.");
  }
  try {
    const clean = await sharp(buffer, { failOn: "error" })
      .rotate() // honor EXIF orientation BEFORE metadata is stripped
      .resize({ width: opts.maxDim ?? 2048, height: opts.maxDim ?? 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: opts.quality ?? 85 })
      .toBuffer();
    return { buffer: clean, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    throw new UploadValidationError("Image could not be decoded.");
  }
}

/** Magic-byte check for video uploads (no re-encode — FFmpeg pipeline handles transforms). */
export async function assertVideoUpload(buffer: Buffer): Promise<void> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !VIDEO_TYPES.has(detected.ext)) {
    throw new UploadValidationError("File content is not a supported video.");
  }
}
