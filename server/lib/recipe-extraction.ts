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

const RECIPE_EXTRACTION_SYSTEM_PROMPT = `You extract structured recipe data from a video transcript of a chef cooking. The output feeds downstream systems (cart aggregation, Instacart shopping-list link, macro calculation) that require strict, numeric, canonical values. Vague output breaks downstream — be precise.

Emit a JSON object with these fields:

- title: short, punchy (~5 words max).

- prepTimeMinutes / cookTimeMinutes / passiveTimeMinutes: best-guess integer minutes for prep work (chopping, mixing), active cook time, and passive time (rising, marinating, cooling, fridge time). Null when not mentioned.

- servings: integer if explicit. If the chef doesn't say, estimate from quantities (e.g. "1 lb chicken" → 4 servings).

- ingredients: array of { name, amount, unit } objects. STRICT RULES:
    * name: the food's common English name. STRIP brand names, qualifiers, and "chef talk":
        "Busy People™ minced garlic" → "garlic"
        "Beat-Up Farm garlic sauce" → "garlic sauce"
        "ground black pepper" → "black pepper"
        "extra virgin olive oil" → "olive oil"
        Use singular form for produce ("potato", not "potatoes"). If the chef mentions a non-food (a tool, a step, water for boiling), skip it.
    * amount: ALWAYS a numeric string like "1", "0.5", "1.5", "2", "0.25". NEVER emit "to taste", "a few", "a pinch", "some", "a handful", or an empty string. When the chef is vague, estimate a sensible amount from common-recipe averages:
        pinch/dash → "0.25" (use teaspoon as the unit)
        "to taste" for salt/pepper/spices → "1" (teaspoon)
        "a few" or "several" for produce → "3" (each)
        "a handful" → "0.25" (cup)
        default oil for sautéing → "2" (tablespoon)
        default butter for cooking → "1" (tablespoon)
    * unit: choose EXACTLY ONE value from this list. Use "" (empty string) ONLY for ingredients counted as whole items (e.g. "1 egg" → unit="", "2 onions" → unit="each").
        Allowed units: cup, tablespoon, teaspoon, milliliter, liter, pint, quart, gallon, gram, kilogram, ounce, pound, bunch, can, each, ears, head, large, medium, small, package, packet, ""
        Map idiomatic units down:
            "lbs" / "lb" → "pound"
            "oz" → "ounce"
            "tsp" → "teaspoon"
            "tbsp" / "tbs" → "tablespoon"
            "cloves" (of garlic) → "each"
            "slice" / "slices" → "each"
            "ml" → "milliliter"
            "g" / "grams" → "gram"
    * Be generous — include every food ingredient the chef mentions, even briefly.

- steps: ordered array of { instruction, time, location } objects. instruction is one imperative sentence (no preamble/sign-off). time is the best-guess duration for that single step ("10 min", "1 hr") or null when not mentioned. location is the cooking surface, vessel, or appliance the step happens in ("stovetop", "oven at 350°F", "mixing bowl", "fridge") or null when not mentioned. Aim for 4-10 steps total.

If the transcript is too noisy / off-topic / too short to extract a recipe, return all fields null/empty arrays.`;

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
            name: { type: "string", minLength: 1, maxLength: 80 },
            // Numeric string only — no "to taste" / "a few" / empty allowed. The post-extraction
            // normalizer (server/lib/normalize-ingredients.ts) handles any slips with vague-phrase
            // fallbacks; this schema constraint stops the model at the source.
            amount: { type: "string", pattern: "^[0-9]+(\\.[0-9]+)?$" },
            // Closed enum aligned with InstacartUnit + "" for count-only items. Keeps the
            // cart aggregator and Instacart payload builder downstream from receiving alien units.
            unit: {
              type: "string",
              enum: [
                "cup", "tablespoon", "teaspoon", "milliliter", "liter", "pint", "quart", "gallon",
                "gram", "kilogram", "ounce", "pound",
                "bunch", "can", "each", "ears", "head",
                "large", "medium", "small", "package", "packet",
                "",
              ],
            },
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

/**
 * Run GPT-4o structured extraction over a transcript.
 *
 * gpt-4o handles the "estimate a sensible numeric default when the transcript is vague"
 * rule materially better than gpt-4o-mini, which tends to either copy verbatim or refuse.
 * The cost is ~$0.013/extraction vs ~$0.001 — both rounding-error per upload, well worth
 * the quality jump for a one-shot endpoint.
 */
export async function extractRecipeFromTranscript(transcript: string): Promise<ExtractedRecipe> {
  const completion = await client().chat.completions.create({
    model: "gpt-4o",
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
