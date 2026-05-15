import OpenAI from "openai";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createReadStream } from "node:fs";

// Existing OpenAI code in this repo reads AI_INTEGRATIONS_OPENAI_API_KEY; the .env only has
// OPENAI_API_KEY today. Falling back keeps both wirings working.
function getOpenAIKey(): string {
  const k = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!k) throw new Error("No OpenAI API key set (AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY).");
  return k;
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: getOpenAIKey() });
  return _client;
}

const RECIPE_EXTRACTION_SYSTEM_PROMPT = `You extract structured recipe data from a video transcript of a chef cooking.

Read the transcript and emit a JSON object with the chef's recipe:
- title: short, punchy (~5 words max)
- prepTimeMinutes / cookTimeMinutes / passiveTimeMinutes: best-guess minutes for prep work (chopping etc.), active cook time, and passive time (rising, marinating, cooling). Null if not mentioned.
- servings: integer if explicit, otherwise null.
- ingredients: array of { name, amount, unit }. amount is a string ("1", "1/2", "to taste"). unit is short ("oz", "cup", "tsp", "clove") or "" if dimensionless. Be generous — include every ingredient the chef mentions.
- steps: ordered array of objects { instruction, time, location }. instruction is one imperative sentence (no preamble or sign-off). time is the best-guess duration for that single step ("10 min", "1 hr") or null when not mentioned. location is the cooking surface, vessel, or appliance the step happens in ("stovetop", "oven at 350°F", "mixing bowl", "fridge") or null when not mentioned. Aim for 4-10 steps total.

If the transcript is too noisy / off-topic / too short to extract a recipe, return all fields null/empty.`;

export interface ExtractedRecipe {
  title: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  passiveTimeMinutes: number | null;
  servings: number | null;
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { instruction: string; time: string | null; location: string | null }[];
}

const RECIPE_JSON_SCHEMA = {
  name: "ExtractedRecipe",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: ["string", "null"] },
      prepTimeMinutes: { type: ["integer", "null"] },
      cookTimeMinutes: { type: ["integer", "null"] },
      passiveTimeMinutes: { type: ["integer", "null"] },
      servings: { type: ["integer", "null"] },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            amount: { type: "string" },
            unit: { type: "string" },
          },
          required: ["name", "amount", "unit"],
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            instruction: { type: "string" },
            time: { type: ["string", "null"] },
            location: { type: ["string", "null"] },
          },
          required: ["instruction", "time", "location"],
        },
      },
    },
    required: [
      "title",
      "prepTimeMinutes",
      "cookTimeMinutes",
      "passiveTimeMinutes",
      "servings",
      "ingredients",
      "steps",
    ],
  },
} as const;

/** Transcribe an audio buffer via OpenAI Whisper (whisper-1). */
export async function transcribeAudio(audio: Buffer, filenameHint = "audio.wav"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "recipal-whisper-"));
  const path = join(dir, filenameHint);
  await writeFile(path, audio);
  try {
    const resp = await client().audio.transcriptions.create({
      file: createReadStream(path) as any,
      model: "whisper-1",
      response_format: "text",
    });
    return typeof resp === "string" ? resp : (resp as any).text ?? "";
  } finally {
    await unlink(path).catch(() => {});
  }
}

/** Run GPT-4o-mini structured extraction over a transcript. */
export async function extractRecipeFromTranscript(transcript: string): Promise<ExtractedRecipe> {
  const completion = await client().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: RECIPE_EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: `Video transcript:\n\n${transcript || "(silent video — no transcript available)"}` },
    ],
    response_format: { type: "json_schema", json_schema: RECIPE_JSON_SCHEMA as any },
    temperature: 0,
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as ExtractedRecipe;
}
