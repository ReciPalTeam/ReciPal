import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "music-library";
const SOURCE_DIR = "/Users/Michael/Desktop/Claude_Latest_GitHub_Pull/Pixabay-Library";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type MusicVibe = "upbeat" | "chill" | "cozy" | "energetic" | "cinematic" | "acoustic";

interface Parsed {
  uploader: string;
  rawTitle: string;
  sourceId: string;
  durationS: number | null;
}

function parseFilename(name: string): Parsed | null {
  if (!name.endsWith(".mp3")) return null;
  const base = name.slice(0, -4);
  const parts = base.split("-");
  if (parts.length < 3) return null;
  const sourceId = parts[parts.length - 1];
  if (!/^\d+$/.test(sourceId)) return null;
  const uploader = parts[0];
  let titleParts = parts.slice(1, -1);
  // Pull a trailing _Nsec hint (e.g. "music_46sec") into durationS and drop it from title.
  let durationS: number | null = null;
  if (titleParts.length > 0) {
    const last = titleParts[titleParts.length - 1];
    const m = last.match(/^(.*?)_(\d+)sec$/i);
    if (m) {
      durationS = parseInt(m[2], 10);
      titleParts[titleParts.length - 1] = m[1];
      if (titleParts[titleParts.length - 1] === "") titleParts.pop();
    }
  }
  return { uploader, rawTitle: titleParts.join(" "), sourceId, durationS };
}

function titleCase(s: string): string {
  // Lowercase short connectors but capitalize everything else.
  const small = new Set(["a", "an", "the", "of", "in", "to", "for", "and", "or", "but", "on", "at", "by", "with"]);
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i !== 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function artistName(uploader: string): string {
  // Pixabay uploader handles are slugs (often with underscores). Render as a friendly name.
  const cleaned = uploader.replace(/_/g, " ").replace(/(\d+)$/, "").trim();
  if (cleaned.length === 0 || /^\d+$/.test(uploader)) return "Pixabay";
  return titleCase(cleaned);
}

function inferVibe(rawTitle: string): MusicVibe {
  const t = rawTitle.toLowerCase();
  if (/\b(lofi|lo-fi|chill|chilling|relax|relaxing|soft|calm|jazz|lounge|mellow|tranquil|peaceful|lightness|sleep|night)\b/.test(t)) return "chill";
  if (/\b(happy|joyful|cheerful|inspiring|inspirational|optimistic|cooking|comedy|funny|vlog|uplifting|motion|tiktok|kids)\b/.test(t)) return "upbeat";
  if (/\b(wedding|romantic|cute|sweet|gentle|ukulele|cozy)\b/.test(t)) return "cozy";
  if (/\b(acoustic)\b/.test(t)) return "acoustic";
  if (/\b(trap|drill|hype|phonk|rap|boom.bap|hip.hop|house|anthem|drop|parkour|underground|beat|beats|drum|drums)\b/.test(t)) return "energetic";
  return "cinematic";
}

function buildTags(rawTitle: string, vibe: MusicVibe): string[] {
  const tokens = rawTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !["music", "background", "type", "the", "and"].includes(w));
  const unique = Array.from(new Set([vibe, ...tokens])).slice(0, 8);
  return unique;
}

async function ensureBucket(): Promise<void> {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);
  const exists = data?.find((b) => b.name === BUCKET);
  if (!exists) {
    console.log(`Creating bucket ${BUCKET} (public)…`);
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createErr) throw new Error(`createBucket failed: ${createErr.message}`);
  } else {
    console.log(`Bucket ${BUCKET} already exists.`);
  }
}

async function ingestOne(filename: string, idx: number, total: number): Promise<void> {
  const parsed = parseFilename(filename);
  if (!parsed) {
    console.warn(`[${idx}/${total}] SKIP unparseable: ${filename}`);
    return;
  }
  const title = titleCase(parsed.rawTitle);
  const artist = artistName(parsed.uploader);
  const vibe = inferVibe(parsed.rawTitle);

  // Idempotency: skip if this Pixabay track is already in music_tracks.
  const { data: existing } = await supabase
    .from("music_tracks")
    .select("id")
    .eq("source_track_id", parsed.sourceId)
    .maybeSingle();
  if (existing) {
    console.log(`[${idx}/${total}] SKIP already-ingested: ${title} (source_id=${parsed.sourceId}, row=${existing.id})`);
    return;
  }

  const filePath = join(SOURCE_DIR, filename);
  const fileBuffer = readFileSync(filePath);
  const size = statSync(filePath).size;

  // Upload — keep the original filename so the public URL is human-readable.
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, fileBuffer, { contentType: "audio/mpeg", upsert: true });
  if (uploadErr) {
    console.error(`[${idx}/${total}] UPLOAD FAILED ${filename}: ${uploadErr.message}`);
    return;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  const fileUrl = urlData.publicUrl;

  const tags = buildTags(parsed.rawTitle, vibe);
  const { error: insertErr } = await supabase.from("music_tracks").insert({
    title,
    artist,
    vibe,
    file_url: fileUrl,
    file_size_bytes: size,
    duration_s: parsed.durationS,
    source: "pixabay",
    source_track_id: parsed.sourceId,
    tags,
  });
  if (insertErr) {
    console.error(`[${idx}/${total}] INSERT FAILED ${title}: ${insertErr.message}`);
    return;
  }
  console.log(`[${idx}/${total}] OK  ${title} — ${artist} [${vibe}] (${(size / 1024 / 1024).toFixed(1)}MB)`);
}

async function main(): Promise<void> {
  console.log(`Ingest Pixabay-Library → Supabase Storage bucket "${BUCKET}" + music_tracks table\n`);
  await ensureBucket();

  const files = readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".mp3"))
    .sort();
  console.log(`Found ${files.length} mp3 files.\n`);

  for (let i = 0; i < files.length; i++) {
    await ingestOne(files[i], i + 1, files.length);
  }

  const { count } = await supabase
    .from("music_tracks")
    .select("*", { count: "exact", head: true })
    .eq("source", "pixabay");
  console.log(`\nDone. music_tracks (source=pixabay): ${count ?? "?"} rows total.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
