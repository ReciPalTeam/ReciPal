import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegPath.path);

const EXTRACT_TIMEOUT_MS = 30_000;

/**
 * Extract audio from a video buffer and return a WAV buffer at mono 16kHz —
 * the format AcoustID's documentation recommends for Chromaprint fingerprinting.
 *
 * The input is held in a temp file (ffmpeg can't reliably stream binary input
 * across all environments). The temp file is unlinked even on error.
 */
export async function extractAudio(videoBuffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "recipal-extract-"));
  const videoPath = join(dir, "input");
  const audioPath = join(dir, "audio.wav");

  await writeFile(videoPath, videoBuffer);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Audio extraction timed out after ${EXTRACT_TIMEOUT_MS}ms`));
      }, EXTRACT_TIMEOUT_MS);

      ffmpeg(videoPath)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16_000)
        .audioCodec("pcm_s16le")
        .format("wav")
        .on("error", (err) => {
          clearTimeout(timer);
          reject(new Error(`ffmpeg extract failed: ${err.message}`));
        })
        .on("end", () => {
          clearTimeout(timer);
          resolve();
        })
        .save(audioPath);
    });

    return await readFile(audioPath);
  } finally {
    await Promise.all([
      unlink(videoPath).catch(() => {}),
      unlink(audioPath).catch(() => {}),
    ]);
  }
}
