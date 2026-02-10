import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface CalorieRingProps {
  remaining: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}

export function CalorieRing({ remaining, total, size = 140, strokeWidth = 10 }: CalorieRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const eaten = total - remaining;
  const progress = total > 0 ? Math.min(eaten / total, 1) : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#calorieGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(245, 158, 11)" />
            <stop offset="100%" stopColor="rgb(217, 119, 6)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-display leading-none" data-testid="text-remaining-cal">{Math.max(remaining, 0).toLocaleString()}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Remaining</span>
      </div>
    </div>
  );
}

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number;
  color: string;
  trackColor: string;
}

export function MacroBar({ label, consumed, target, color, trackColor }: MacroBarProps) {
  const left = Math.max(target - consumed, 0);
  const progress = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const testId = label.toLowerCase();
  return (
    <div className="flex-1 min-w-0" data-testid={`macro-bar-${testId}`}>
      <div className="flex items-baseline justify-between gap-1 mb-1">
        <span className="text-xs font-medium" data-testid={`text-macro-label-${testId}`}>{label}</span>
        <span className="text-xs text-muted-foreground" data-testid={`text-macro-left-${testId}`}><span className="font-bold">{left}g</span> left</span>
      </div>
      <div className={`h-2 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface CalorieCounterCardProps {
  isPro: boolean;
  macrosSet: boolean;
  goalCalories: number;
  goalProtein: number;
  goalCarbs: number;
  goalFat: number;
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  onUpgrade?: () => void;
  onFinishSetup?: () => void;
}

export function CalorieCounterCard({
  isPro,
  macrosSet,
  goalCalories,
  goalProtein,
  goalCarbs,
  goalFat,
  consumed,
  onUpgrade,
  onFinishSetup,
}: CalorieCounterCardProps) {
  const remaining = goalCalories - consumed.calories;

  return (
    <Card
      className="border-0 overflow-visible"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)' }}
      data-testid="card-calorie-counter"
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-4 sm:gap-6">
          <CalorieRing remaining={remaining} total={goalCalories} />
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-baseline gap-2">
              <p className="text-xs text-muted-foreground font-medium" data-testid="text-daily-goal-label">
                {isPro ? 'Daily Goal' : "Today's Plan"}
              </p>
              <p className="text-lg font-bold font-display leading-none" data-testid="text-daily-goal-value">
                {goalCalories.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">cal</span>
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2 text-center">
                <p className="text-base sm:text-lg font-bold font-display text-green-700 dark:text-green-400" data-testid="text-eaten-cal">{consumed.calories.toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-wider text-green-600/70 dark:text-green-400/70 font-medium">Eaten</p>
              </div>
              <div className="flex-1 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg px-3 py-2 text-center">
                <p className="text-base sm:text-lg font-bold font-display text-amber-700 dark:text-amber-400" data-testid="text-left-cal">{Math.max(remaining, 0).toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 font-medium">Left</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t mt-4 pt-3 relative">
          {isPro && macrosSet ? (
            <div className="flex gap-4">
              <MacroBar label="Protein" consumed={consumed.protein} target={goalProtein} color="bg-orange-500" trackColor="bg-orange-100 dark:bg-orange-950/30" />
              <MacroBar label="Carbs" consumed={consumed.carbs} target={goalCarbs} color="bg-green-400" trackColor="bg-green-100 dark:bg-green-950/30" />
              <MacroBar label="Fat" consumed={consumed.fat} target={goalFat} color="bg-blue-800 dark:bg-blue-400" trackColor="bg-blue-100 dark:bg-blue-950/30" />
            </div>
          ) : isPro && !macrosSet && onFinishSetup ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground flex-1">Set up your macro goals to see detailed tracking</p>
              <Button
                size="sm"
                onClick={onFinishSetup}
                className="bg-recipal-orange shrink-0"
                data-testid="button-finish-setup"
              >
                Finish setting up macros
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-4 blur-[3px] opacity-50 pointer-events-none select-none">
                <MacroBar label="Protein" consumed={30} target={100} color="bg-orange-500" trackColor="bg-orange-100 dark:bg-orange-950/30" />
                <MacroBar label="Carbs" consumed={45} target={150} color="bg-green-400" trackColor="bg-green-100 dark:bg-green-950/30" />
                <MacroBar label="Fat" consumed={20} target={60} color="bg-blue-800 dark:bg-blue-400" trackColor="bg-blue-100 dark:bg-blue-950/30" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  size="sm"
                  onClick={onUpgrade}
                  className="bg-recipal-orange text-xs"
                  data-testid="button-upgrade-macros"
                >
                  <Lock className="w-3 h-3 mr-1" />
                  Join Pro
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
