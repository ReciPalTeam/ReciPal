import { format, subDays, parseISO, getDay, isWeekend } from "date-fns";

export interface InsightItem {
  text: string;
  type: 'positive' | 'neutral' | 'warning';
}

export interface DailyChartEntry {
  date: string;
  dayLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  target: number;
  mealsLogged: number;
}

export interface WeeklyMacroSummary {
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
}

export interface InsightsResult {
  consistency: InsightItem[];
  patternDetection: InsightItem[];
  paceProjections: InsightItem[];
  nutritionalGaps: InsightItem[];
  behavioralNudges: InsightItem[];
  weeklySnapshot: {
    avgCalories: number;
    calorieTarget: number;
    calorieDelta: number;
    bestDay: { name: string; calories: number } | null;
    worstDay: { name: string; calories: number } | null;
    topFoods: { name: string; count: number }[];
    adherencePercent: number;
    daysTracked: number;
    totalDays: number;
    macros: WeeklyMacroSummary;
    dailyData: DailyChartEntry[];
  } | null;
}

interface LogEntry {
  id: number;
  userId: number;
  date: string;
  sourceType: "checkout_logged_recipe" | "cooknow_logged_recipe" | "manual_custom_entry";
  recipeId: number | null;
  name: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: Date | null;
}

interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Profile {
  goal: string;
  weight: number;
}

interface DailyTotal {
  date: string;
  dayOfWeek: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logCount: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDailyTotals(logs: LogEntry[], numDays: number): DailyTotal[] {
  const today = new Date();
  const dailyMap = new Map<string, DailyTotal>();

  for (let i = 0; i < numDays; i++) {
    const d = subDays(today, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    dailyMap.set(dateStr, {
      date: dateStr,
      dayOfWeek: getDay(d),
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      logCount: 0,
    });
  }

  for (const log of logs) {
    const entry = dailyMap.get(log.date);
    if (entry) {
      entry.calories += log.calories;
      entry.protein += log.protein;
      entry.carbs += log.carbs;
      entry.fat += log.fat;
      entry.logCount += 1;
    }
  }

  return Array.from(dailyMap.values());
}

function withinPercent(actual: number, target: number, pct: number): boolean {
  if (target === 0) return actual === 0;
  return Math.abs(actual - target) / target <= pct;
}

export function computeInsights(
  logs: LogEntry[],
  targets: Targets,
  profile: Profile
): InsightsResult {
  const result: InsightsResult = {
    consistency: [],
    patternDetection: [],
    paceProjections: [],
    nutritionalGaps: [],
    behavioralNudges: [],
    weeklySnapshot: null,
  };

  const daily7 = getDailyTotals(logs, 7);
  const daily14 = getDailyTotals(logs, 14);
  const daily30 = getDailyTotals(logs, 30);

  const daysWithData7 = daily7.filter(d => d.logCount > 0);
  const daysWithData14 = daily14.filter(d => d.logCount > 0);
  const daysWithData30 = daily30.filter(d => d.logCount > 0);

  const hasAnyData = daysWithData7.length > 0 || daysWithData14.length > 0;
  if (!hasAnyData) {
    return result;
  }

  // === A) Consistency Insights (triggers with any cooked meal) ===

  const calHitDays7 = daysWithData7.filter(d => withinPercent(d.calories, targets.calories, 0.05)).length;
  const calHitType: InsightItem['type'] = calHitDays7 >= 5 ? 'positive' : calHitDays7 >= 3 ? 'neutral' : 'warning';
  result.consistency.push({
    text: `You hit your calorie target ${calHitDays7} of the last 7 days`,
    type: calHitType,
  });

  if (daysWithData7.length >= 1) {
    const macros: { name: string; key: 'protein' | 'carbs' | 'fat' }[] = [
      { name: 'protein', key: 'protein' },
      { name: 'carbs', key: 'carbs' },
      { name: 'fat', key: 'fat' },
    ];

    for (const macro of macros) {
      const hitCount = daysWithData7.filter(d => withinPercent(d[macro.key], targets[macro.key], 0.05)).length;
      const pct = daysWithData7.length > 0 ? Math.round((hitCount / daysWithData7.length) * 100) : 0;
      const avgVal = daysWithData7.length > 0
        ? Math.round(daysWithData7.reduce((s, d) => s + d[macro.key], 0) / daysWithData7.length)
        : 0;
      const targetVal = targets[macro.key];
      const diffPct = targetVal > 0 ? Math.round(((avgVal - targetVal) / targetVal) * 100) : 0;

      if (pct >= 70) {
        result.consistency.push({
          text: `${macro.name.charAt(0).toUpperCase() + macro.name.slice(1)}: on target ${pct}% of days (avg ${avgVal}g vs ${targetVal}g goal)`,
          type: 'positive',
        });
      } else if (Math.abs(diffPct) > 10) {
        const direction = diffPct > 0 ? 'over' : 'under';
        result.consistency.push({
          text: `${macro.name.charAt(0).toUpperCase() + macro.name.slice(1)}: averaging ${Math.abs(diffPct)}% ${direction} target (${avgVal}g vs ${targetVal}g goal)`,
          type: Math.abs(diffPct) > 20 ? 'warning' : 'neutral',
        });
      } else {
        result.consistency.push({
          text: `${macro.name.charAt(0).toUpperCase() + macro.name.slice(1)}: close to target (avg ${avgVal}g vs ${targetVal}g goal)`,
          type: 'neutral',
        });
      }
    }
  }

  if (daysWithData14.length > 0) {
    const dayOfWeekGroups = new Map<number, DailyTotal[]>();
    for (const d of daysWithData14) {
      if (d.logCount === 0) continue;
      const arr = dayOfWeekGroups.get(d.dayOfWeek) || [];
      arr.push(d);
      dayOfWeekGroups.set(d.dayOfWeek, arr);
    }

    let worstMacro = '';
    let worstDays: string[] = [];
    let worstOvershoot = 0;

    const macroKeys: { name: string; key: 'protein' | 'carbs' | 'fat' }[] = [
      { name: 'protein', key: 'protein' },
      { name: 'carbs', key: 'carbs' },
      { name: 'fat', key: 'fat' },
    ];

    for (const macro of macroKeys) {
      const overDays: string[] = [];
      let totalOvershoot = 0;
      for (const [dow, days] of Array.from(dayOfWeekGroups.entries())) {
        const avg = days.reduce((s, d) => s + d[macro.key], 0) / days.length;
        const overshootPct = targets[macro.key] > 0 ? ((avg - targets[macro.key]) / targets[macro.key]) * 100 : 0;
        if (overshootPct > 10) {
          overDays.push(DAY_NAMES[dow]);
          totalOvershoot += overshootPct;
        }
      }
      if (overDays.length > 0 && totalOvershoot > worstOvershoot) {
        worstOvershoot = totalOvershoot;
        worstMacro = macro.name;
        worstDays = overDays;
      }
    }

    if (worstMacro && worstDays.length > 0) {
      result.consistency.push({
        text: `You tend to go over on ${worstMacro} on ${worstDays.join(', ')}`,
        type: 'warning',
      });
    }
  }

  let streak = 0;
  for (let i = 0; i < daily30.length; i++) {
    const d = daily30.find(dd => dd.date === format(subDays(new Date(), i), 'yyyy-MM-dd'));
    if (!d || d.logCount === 0) break;
    const hitsAll =
      withinPercent(d.calories, targets.calories, 0.05) &&
      withinPercent(d.protein, targets.protein, 0.05) &&
      withinPercent(d.carbs, targets.carbs, 0.05) &&
      withinPercent(d.fat, targets.fat, 0.05);
    if (!hitsAll) break;
    streak++;
  }
  if (streak >= 1) {
    result.consistency.push({
      text: streak === 1
        ? `Current streak: 1 day hitting all macro targets`
        : `Current streak: ${streak} days hitting all macro targets`,
      type: streak >= 5 ? 'positive' : streak >= 2 ? 'neutral' : 'neutral',
    });
  }

  // === B) Pattern Detection ===

  const weekendDays14 = daysWithData14.filter(d => isWeekend(parseISO(d.date)));
  const weekdayDays14 = daysWithData14.filter(d => !isWeekend(parseISO(d.date)));

  if (weekendDays14.length > 0 && weekdayDays14.length > 0) {
    const avgWeekend = weekendDays14.reduce((s, d) => s + d.calories, 0) / weekendDays14.length;
    const avgWeekday = weekdayDays14.reduce((s, d) => s + d.calories, 0) / weekdayDays14.length;
    if (avgWeekday > 0) {
      const diffPct = Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100);
      if (Math.abs(diffPct) > 5) {
        const direction = diffPct > 0 ? 'higher' : 'lower';
        result.patternDetection.push({
          text: `Your average calories are ${Math.abs(diffPct)}% ${direction} on weekends vs. weekdays`,
          type: Math.abs(diffPct) >= 15 ? 'warning' : 'neutral',
        });
      }
    }
  }

  if (daysWithData14.length > 0) {
    const avgCal14 = daysWithData14.reduce((s, d) => s + d.calories, 0) / daysWithData14.length;
    const trendDiff = Math.round(avgCal14 - targets.calories);
    if (Math.abs(trendDiff) > 50) {
      const direction = trendDiff > 0 ? 'above' : 'below';
      result.patternDetection.push({
        text: `You've been trending ${Math.abs(trendDiff)} calories ${direction} your goal over the past 2 weeks`,
        type: trendDiff > 0 ? 'warning' : 'neutral',
      });
    }
  }

  const recent7Protein = daysWithData7.length > 0
    ? daysWithData7.reduce((s, d) => s + d.protein, 0) / daysWithData7.length
    : 0;
  const olderDays = daysWithData30.filter(d => {
    const dayDate = parseISO(d.date);
    const cutoff = subDays(new Date(), 7);
    return dayDate < cutoff;
  });
  if (olderDays.length >= 3 && daysWithData7.length >= 3) {
    const olderAvgProtein = olderDays.reduce((s, d) => s + d.protein, 0) / olderDays.length;
    if (olderAvgProtein > 0) {
      const changePct = Math.round(((recent7Protein - olderAvgProtein) / olderAvgProtein) * 100);
      if (Math.abs(changePct) > 10) {
        const direction = changePct > 0 ? 'increased' : 'decreased';
        result.patternDetection.push({
          text: `Your protein intake has ${direction} ${Math.abs(changePct)}% compared to last month`,
          type: changePct > 0 ? 'positive' : 'warning',
        });
      }
    }
  }

  // === C) Pace & Projections ===

  if (daysWithData7.length > 0) {
    const avgCal7 = daysWithData7.reduce((s, d) => s + d.calories, 0) / daysWithData7.length;
    const dailyDelta = Math.round(avgCal7 - targets.calories);
    const isDeficit = dailyDelta < 0;
    const isSurplus = dailyDelta > 0;

    const goalMap: Record<string, string> = {
      cut: 'deficit',
      bulk: 'surplus',
      maintain: 'balance',
    };
    const goalImplies = goalMap[profile.goal] || 'balance';

    const deltaLabel = isDeficit ? 'deficit' : isSurplus ? 'surplus' : 'balance';
    const aligned =
      (profile.goal === 'cut' && isDeficit) ||
      (profile.goal === 'bulk' && isSurplus) ||
      (profile.goal === 'maintain' && Math.abs(dailyDelta) <= targets.calories * 0.05);

    result.paceProjections.push({
      text: `You're averaging a ${Math.abs(dailyDelta)} calorie ${deltaLabel} — your goal implies ${goalImplies}`,
      type: aligned ? 'positive' : 'warning',
    });

    if (profile.goal === 'cut') {
      if (isDeficit) {
        const lbsPerDay = Math.abs(dailyDelta) / 3500;
        if (lbsPerDay > 0) {
          const goalWeight = profile.weight * 0.9;
          const lbsToLose = profile.weight - goalWeight;
          const daysToGoal = Math.ceil(lbsToLose / lbsPerDay);
          const targetDate = subDays(new Date(), -daysToGoal);
          result.paceProjections.push({
            text: `At this pace, you'll hit your goal weight by ${format(targetDate, 'MMM yyyy')}`,
            type: 'neutral',
          });
        }
      } else {
        result.paceProjections.push({
          text: "You're not currently in a deficit",
          type: 'warning',
        });
      }
    }
  }

  // === D) Nutritional Gaps ===

  if (daysWithData7.length > 0) {
    const avgFat7 = daysWithData7.reduce((s, d) => s + d.fat, 0) / daysWithData7.length;
    if (targets.fat > 0) {
      const fatOverPct = Math.round(((avgFat7 - targets.fat) / targets.fat) * 100);
      if (fatOverPct > 10) {
        result.nutritionalGaps.push({
          text: `Your fat intake is consistently ${fatOverPct}% over your target`,
          type: 'warning',
        });
      }
    }

    const avgProtein7 = daysWithData7.reduce((s, d) => s + d.protein, 0) / daysWithData7.length;
    if (avgProtein7 < targets.protein * 0.9) {
      result.nutritionalGaps.push({
        text: `You're averaging only ${Math.round(avgProtein7)}g protein — your goal is ${targets.protein}g`,
        type: 'warning',
      });
    }

    const avgCarbs7 = daysWithData7.reduce((s, d) => s + d.carbs, 0) / daysWithData7.length;
    if (targets.carbs > 0) {
      const carbDevPct = Math.round(((avgCarbs7 - targets.carbs) / targets.carbs) * 100);
      if (Math.abs(carbDevPct) > 15) {
        const direction = carbDevPct > 0 ? 'above' : 'below';
        result.nutritionalGaps.push({
          text: `Your carb intake is ${Math.abs(carbDevPct)}% ${direction} target`,
          type: Math.abs(carbDevPct) > 25 ? 'warning' : 'neutral',
        });
      }
    }
  }

  // === E) Behavioral Nudges (requires 2+ days) ===

  if (daysWithData7.length >= 2 || daysWithData14.length >= 2) {
    const daily5 = getDailyTotals(logs, 5);
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    for (const mealType of mealTypes) {
      let missingDays = 0;
      for (const day of daily5) {
        if (day.logCount === 0) {
          missingDays++;
          continue;
        }
        const dayLogs = logs.filter(l => l.date === day.date);
        const hasMealType = dayLogs.some(l =>
          l.sourceType.includes('recipe') ||
          (l.name && l.name.toLowerCase().includes(mealType))
        );
        if (!hasMealType) missingDays++;
      }
      if (missingDays > 2) {
        result.behavioralNudges.push({
          text: `You haven't logged ${mealType} in ${missingDays} of the last 5 days — missing data skews your insights`,
          type: 'warning',
        });
      }
    }
  }

  if (daysWithData14.length >= 7) {
    const dayOfWeekHits = new Map<number, { hits: number; total: number }>();
    for (const d of daily14) {
      if (d.logCount === 0) continue;
      const entry = dayOfWeekHits.get(d.dayOfWeek) || { hits: 0, total: 0 };
      entry.total++;
      if (withinPercent(d.calories, targets.calories, 0.05)) entry.hits++;
      dayOfWeekHits.set(d.dayOfWeek, entry);
    }

    let bestPct = 0;
    let bestDays: string[] = [];
    for (const [dow, stats] of Array.from(dayOfWeekHits.entries())) {
      if (stats.total === 0) continue;
      const pct = stats.hits / stats.total;
      if (pct > bestPct) {
        bestPct = pct;
        bestDays = [DAY_NAMES[dow]];
      } else if (pct === bestPct && pct > 0) {
        bestDays.push(DAY_NAMES[dow]);
      }
    }
    if (bestDays.length > 0 && bestPct > 0) {
      result.behavioralNudges.push({
        text: `Your best adherence days are ${bestDays.join(', ')}`,
        type: 'positive',
      });
    }
  }

  if (daysWithData14.length > 0) {
    const fullLogDays = daysWithData14.filter(d => d.logCount >= 3);
    const partialLogDays = daysWithData14.filter(d => d.logCount > 0 && d.logCount < 3);
    if (fullLogDays.length >= 2 && partialLogDays.length >= 2) {
      const avgFull = fullLogDays.reduce((s, d) => s + d.calories, 0) / fullLogDays.length;
      const avgPartial = partialLogDays.reduce((s, d) => s + d.calories, 0) / partialLogDays.length;
      const diff = Math.round(avgPartial - avgFull);
      if (diff > 50) {
        result.behavioralNudges.push({
          text: `Days you log all 3 meals, you average ${diff} fewer calories`,
          type: 'neutral',
        });
      }
    }
  }

  // === F) Weekly Snapshot (triggers with any cooked meal) ===

  if (daysWithData7.length >= 1) {
    const avgCalories = Math.round(daysWithData7.reduce((s, d) => s + d.calories, 0) / daysWithData7.length);
    const calorieDelta = avgCalories - targets.calories;

    const avgProtein = Math.round(daysWithData7.reduce((s, d) => s + d.protein, 0) / daysWithData7.length);
    const avgCarbs = Math.round(daysWithData7.reduce((s, d) => s + d.carbs, 0) / daysWithData7.length);
    const avgFat = Math.round(daysWithData7.reduce((s, d) => s + d.fat, 0) / daysWithData7.length);

    let bestDay: { name: string; calories: number } | null = null;
    let worstDay: { name: string; calories: number } | null = null;
    let bestDiff = Infinity;
    let worstDiff = -1;

    for (const d of daysWithData7) {
      const diff = Math.abs(d.calories - targets.calories);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestDay = { name: DAY_NAMES[d.dayOfWeek], calories: d.calories };
      }
      if (diff > worstDiff) {
        worstDiff = diff;
        worstDay = { name: DAY_NAMES[d.dayOfWeek], calories: d.calories };
      }
    }

    const foodCounts = new Map<string, number>();
    const last7Dates = new Set(daily7.map(d => d.date));
    for (const log of logs) {
      if (last7Dates.has(log.date) && log.name) {
        foodCounts.set(log.name, (foodCounts.get(log.name) || 0) + 1);
      }
    }
    const topFoods = Array.from(foodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const adherenceCount = daysWithData7.filter(d => withinPercent(d.calories, targets.calories, 0.05)).length;
    const adherencePercent = Math.round((adherenceCount / 7) * 100);

    const dailyData: DailyChartEntry[] = daily7
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date,
        dayLabel: DAY_NAMES[d.dayOfWeek].slice(0, 3),
        calories: d.calories,
        protein: d.protein,
        carbs: d.carbs,
        fat: d.fat,
        target: targets.calories,
        mealsLogged: d.logCount,
      }));

    result.weeklySnapshot = {
      avgCalories,
      calorieTarget: targets.calories,
      calorieDelta,
      bestDay,
      worstDay,
      topFoods,
      adherencePercent,
      daysTracked: daysWithData7.length,
      totalDays: 7,
      macros: {
        avgProtein,
        avgCarbs,
        avgFat,
        targetProtein: targets.protein,
        targetCarbs: targets.carbs,
        targetFat: targets.fat,
      },
      dailyData,
    };
  }

  return result;
}
