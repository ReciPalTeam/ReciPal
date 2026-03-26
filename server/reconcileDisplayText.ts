import OpenAI from "openai";
import { getSupabaseClient } from "./lib/supabaseServer";
import { batchProcess } from "./lib/batchProcess";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const NORMALIZED_DISH_TYPES = [
  "sandwich",
  "burger",
  "wrap",
  "taco",
  "bowl",
  "salad",
  "soup",
  "stew",
  "pasta",
  "stir-fry",
  "casserole",
  "pizza",
  "flatbread",
  "quesadilla",
  "burrito",
  "sushi",
  "poke",
  "curry",
  "chili",
  "risotto",
  "omelette",
  "frittata",
  "pancake",
  "waffle",
  "smoothie",
  "shake",
  "parfait",
  "toast",
  "bagel",
  "muffin",
  "cereal",
  "oatmeal",
  "yogurt",
  "snack",
  "bar",
  "dip",
  "hummus",
  "trail mix",
  "jerky",
  "nuts",
  "fruit",
  "cheese plate",
  "popcorn",
  "chips",
  "crackers",
  "energy ball",
  "protein ball",
  "cookie",
  "brownie",
  "cake",
  "pie",
  "pudding",
  "ice cream",
  "frozen yogurt",
  "sorbet",
  "popsicle",
  "flan",
  "mousse",
  "custard",
  "cheesecake",
  "tiramisu",
  "crepe",
  "donut",
  "pastry",
  "scone",
  "biscuit",
  "bread",
  "roll",
  "naan",
  "pita",
  "cornbread",
  "focaccia",
  "pretzel",
  "grilled cheese",
  "panini",
  "sub",
  "hoagie",
  "po'boy",
  "gyro",
  "shawarma",
  "falafel",
  "kebab",
  "skewer",
  "wing",
  "nugget",
  "tender",
  "fried chicken",
  "roast",
  "steak",
  "chop",
  "ribs",
  "meatball",
  "meatloaf",
  "sausage",
  "hot dog",
  "bratwurst",
  "fish",
  "shrimp",
  "crab",
  "lobster",
  "clam",
  "mussel",
  "oyster",
  "scallop",
  "calamari",
  "ceviche",
];

interface IngredientRow {
  id: number;
  recipe_id: string;
  amount: number | null;
  unit: string | null;
  display_text: string | null;
}

interface ReconcileResult {
  updated: number;
  skipped: number;
  errors: number;
}

export async function reconcileDisplayText(): Promise<ReconcileResult> {
  const supabase = getSupabaseClient();

  const { data: ingredients, error: fetchError } = await supabase
    .from("recipe_ingredients")
    .select("id, recipe_id, amount, unit, display_text, recipes!inner(servings, dish_type)")
    .eq("recipes.servings", 1)
    .in("recipes.dish_type", NORMALIZED_DISH_TYPES);

  if (fetchError) {
    throw new Error(`Failed to fetch ingredients: ${fetchError.message}`);
  }

  if (!ingredients || ingredients.length === 0) {
    return { updated: 0, skipped: 0, errors: 0 };
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const BATCH_SIZE = 100;
  for (let i = 0; i < ingredients.length; i += BATCH_SIZE) {
    const batch = ingredients.slice(i, i + BATCH_SIZE);

    const results = await batchProcess(
      batch,
      async (row: any) => {
        if (row.amount == null || !row.display_text) {
          return { action: "skip" as const, id: row.id };
        }

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "You are a recipe ingredient formatter. Given a numeric amount, a unit, and a raw ingredient string, return a single clean ingredient line exactly as it would appear in a printed recipe. Format the amount as a common fraction or practical measurement (e.g. 1/4, 1/2, 3/4, 1 1/2) rather than a decimal. Do not change the ingredient description. Return only the formatted ingredient string with no explanation.",
              },
              {
                role: "user",
                content: `Amount: ${row.amount}\nUnit: ${row.unit || "each"}\nOriginal ingredient text: ${row.display_text}`,
              },
            ],
            max_tokens: 150,
            temperature: 0.2,
          });

          const newText = response.choices[0]?.message?.content?.trim();
          if (!newText) {
            return { action: "error" as const, id: row.id };
          }

          const { error: updateError } = await supabase
            .from("recipe_ingredients")
            .update({ display_text: newText })
            .eq("id", row.id);

          if (updateError) {
            console.error(`[ReconcileDisplayText] Update failed for id=${row.id}:`, updateError.message);
            return { action: "error" as const, id: row.id };
          }

          return { action: "updated" as const, id: row.id };
        } catch (err: any) {
          console.error(`[ReconcileDisplayText] GPT error for id=${row.id}:`, err.message);
          throw err;
        }
      },
      { concurrency: 2, retries: 5 }
    );

    for (const r of results) {
      if (r.action === "updated") updated++;
      else if (r.action === "skip") skipped++;
      else errors++;
    }

    console.log(`[ReconcileDisplayText] Batch ${Math.floor(i / BATCH_SIZE) + 1}: updated=${updated}, skipped=${skipped}, errors=${errors}`);
  }

  return { updated, skipped, errors };
}
