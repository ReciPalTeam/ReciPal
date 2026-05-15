// Cloudflare Stream server-side uploader.
// Uses the simple "POST a file" endpoint, which supports up to 200MB per upload —
// well beyond our 50MB multer cap. For larger uploads we'd need the TUS endpoint instead.

interface CFStreamUploadResult {
  uid: string;
  playbackHls: string;
  playbackDash: string;
  thumbnail: string;
  duration: number | null;
  status: string;
}

interface CFStreamApiResponse {
  success: boolean;
  result?: {
    uid: string;
    duration?: number;
    status?: { state?: string };
    thumbnail?: string;
    playback?: { hls?: string; dash?: string };
  };
  errors?: { code: number; message: string }[];
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Configure Cloudflare Stream credentials in .env.`
    );
  }
  return v;
}

/**
 * Upload an MP4 (or other CF-Stream-accepted) video buffer to Cloudflare Stream.
 * Returns the new video's identifier + playback URL on success.
 *
 * The returned playback URL is an HLS .m3u8 manifest. Use the dash URL or
 * direct download via Stream's API if you need other formats.
 */
export async function uploadToCloudflareStream(
  videoBuffer: Buffer,
  options: {
    fileName?: string;
    metadata?: Record<string, string>;
  } = {}
): Promise<CFStreamUploadResult> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requireEnv("CLOUDFLARE_STREAM_API_TOKEN");

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(videoBuffer)], { type: "video/mp4" });
  formData.append("file", blob, options.fileName ?? "reel.mp4");
  if (options.metadata) {
    formData.append("meta", JSON.stringify(options.metadata));
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    }
  );

  const json = (await res.json()) as CFStreamApiResponse;

  if (!res.ok || !json.success || !json.result?.uid) {
    const errMsg = json.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ?? `HTTP ${res.status}`;
    throw new Error(`Cloudflare Stream upload failed: ${errMsg}`);
  }

  const r = json.result;
  return {
    uid: r.uid,
    playbackHls: r.playback?.hls ?? "",
    playbackDash: r.playback?.dash ?? "",
    thumbnail: r.thumbnail ?? "",
    duration: r.duration ?? null,
    status: r.status?.state ?? "uploading",
  };
}
