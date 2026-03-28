export function formatMinutesHumanReadable(mins: number): string {
  if (mins <= 0) return "0m";
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function parseTimeStringToMinutes(timeStr: string | undefined | null): number {
  if (!timeStr || timeStr === "—") return 0;
  const hourMatch = timeStr.match(/(\d+)\s*h/i);
  const minMatch = timeStr.match(/(\d+)\s*m(?:in)?\b/i);
  let total = 0;
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) total += parseInt(minMatch[1], 10);
  return total;
}
