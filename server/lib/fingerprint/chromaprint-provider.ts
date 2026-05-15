import { spawn } from "node:child_process";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FingerprintProvider, FingerprintResult } from "./types";

interface FpcalcResult {
  duration: number;
  fingerprint: string;
}

interface AcoustIdRecording {
  id: string;
  title?: string;
  artists?: { name: string }[];
  releasegroups?: { title: string }[];
}

interface AcoustIdMatch {
  id: string;
  score: number;
  recordings?: AcoustIdRecording[];
}

interface AcoustIdResponse {
  status: string;
  results: AcoustIdMatch[];
  error?: { message: string };
}

const ACOUSTID_ENDPOINT = "https://api.acoustid.org/v2/lookup";

/**
 * Runs the Chromaprint `fpcalc` CLI against a temp WAV file, returns duration + fingerprint.
 * Requires the fpcalc binary on PATH or at FPCALC_PATH.
 */
function runFpcalc(wavPath: string): Promise<FpcalcResult> {
  const fpcalc = process.env.FPCALC_PATH || "fpcalc";
  return new Promise((resolve, reject) => {
    const proc = spawn(fpcalc, ["-json", wavPath]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    proc.on("error", (err) => reject(new Error(`fpcalc spawn failed: ${err.message}`)));
    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`fpcalc exited ${code}: ${stderr.trim()}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve({ duration: parsed.duration, fingerprint: parsed.fingerprint });
      } catch (err: any) {
        reject(new Error(`fpcalc returned invalid JSON: ${err.message}`));
      }
    });
  });
}

async function lookupAcoustId(fp: FpcalcResult, apiKey: string): Promise<AcoustIdResponse> {
  const params = new URLSearchParams({
    client: apiKey,
    meta: "recordings+releasegroups",
    duration: Math.round(fp.duration).toString(),
    fingerprint: fp.fingerprint,
  });
  const res = await fetch(ACOUSTID_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`AcoustID HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as AcoustIdResponse;
}

export class ChromaprintProvider implements FingerprintProvider {
  readonly name = "chromaprint" as const;

  async identify(audioBuffer: Buffer): Promise<FingerprintResult> {
    const apiKey = process.env.ACOUSTID_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ACOUSTID_API_KEY is not set. Register at https://acoustid.org/new-application."
      );
    }

    const dir = await mkdtemp(join(tmpdir(), "recipal-fp-"));
    const wavPath = join(dir, "audio.wav");

    try {
      await writeFile(wavPath, audioBuffer);
      const fp = await runFpcalc(wavPath);
      const acoust = await lookupAcoustId(fp, apiKey);

      if (acoust.status !== "ok") {
        throw new Error(`AcoustID error: ${acoust.error?.message ?? "unknown"}`);
      }

      const top = acoust.results?.[0];
      if (!top || !top.recordings || top.recordings.length === 0) {
        return { matched: false, confidence: top?.score ?? 0, provider: this.name, rawResponse: acoust };
      }

      const rec = top.recordings[0];
      return {
        matched: true,
        confidence: top.score,
        track: rec.title,
        artist: rec.artists?.[0]?.name,
        album: rec.releasegroups?.[0]?.title,
        provider: this.name,
        rawResponse: acoust,
      };
    } finally {
      await unlink(wavPath).catch(() => {});
    }
  }
}
