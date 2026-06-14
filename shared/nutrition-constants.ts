/**
 * Shared nutrition constants — the ONE tolerance band used everywhere a value is
 * judged "on target": insights adherence (server/insights.ts), the For You
 * macro-goal feed ranking (server/lib/feedRanking.ts), and the planner macro
 * engine (WS-D). Do not fork this value; import it.
 */
export const MACRO_TOLERANCE_BAND = 0.05; // ±5%
