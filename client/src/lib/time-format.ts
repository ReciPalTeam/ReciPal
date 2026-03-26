/**
 * Formats a duration in minutes to a human-readable string.
 * e.g., 90 → "1 hr 30 min", 45 → "45 min", 120 → "2 hrs"
 */
export function formatMinutesHumanReadable(minutes: number): string {
  if (!minutes || minutes <= 0) return "";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return hrs === 1 ? "1 hr" : `${hrs} hrs`;
  return `${hrs} hr ${mins} min`;
}
