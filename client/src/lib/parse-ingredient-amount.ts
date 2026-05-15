/**
 * Parse a chef-recipe ingredient amount string ("1", "1/2", "1 1/2", "0.5", "two")
 * into a number. Returns null when unparseable.
 */
export function parseIngredientAmount(raw: string): number | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;

  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const w = parseInt(mixed[1], 10);
    const n = parseInt(mixed[2], 10);
    const d = parseInt(mixed[3], 10);
    return d > 0 ? w + n / d : w;
  }
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const n = parseInt(frac[1], 10);
    const d = parseInt(frac[2], 10);
    return d > 0 ? n / d : null;
  }
  const n = parseFloat(s);
  if (Number.isFinite(n)) return n;

  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    half: 0.5, quarter: 0.25, third: 0.333,
  };
  return words[s] ?? null;
}

const FRACTIONS: Array<[number, string]> = [
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
];

/**
 * Reformat a number back into a recipe-friendly string. Prefers mixed fractions
 * for clean values (1.5 → "1 1/2"), falls back to 1-decimal otherwise.
 */
export function formatIngredientAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const whole = Math.floor(n);
  const remainder = n - whole;
  if (remainder === 0) return String(whole);

  // Snap to common fractions within a small tolerance.
  for (const [val, frac] of FRACTIONS) {
    if (Math.abs(remainder - val) < 0.04) {
      return whole === 0 ? frac : `${whole} ${frac}`;
    }
  }
  // Fall back to one-decimal rounding.
  return Math.round(n * 10) / 10 + "";
}

/**
 * Convenience: scale a raw amount string by `ratio` and return a recipe-friendly
 * string. If the original is unparseable, returns it unchanged.
 */
export function scaleIngredientAmount(raw: string, ratio: number): string {
  const n = parseIngredientAmount(raw);
  if (n == null) return raw;
  return formatIngredientAmount(n * ratio);
}
