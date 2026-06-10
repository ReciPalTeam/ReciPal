import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

interface CalorieRingProps {
  remaining: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}

export function CalorieRing({ remaining, total, size = 90, strokeWidth = 8 }: CalorieRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const eaten = total - remaining;
  const progress = total > 0 ? Math.min(eaten / total, 1) : 0;
  const dashOffset = circumference * (1 - progress);
  const eatenStr = Math.max(eaten, 0).toLocaleString();
  const numFontSize = eatenStr.length >= 4 ? 14 : 17;

  return (
    <div className="flex flex-col items-center">
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
            <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(202, 138, 4)" />
              <stop offset="100%" stopColor="rgb(253, 224, 71)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-extrabold font-display leading-none" style={{ fontSize: numFontSize, color: '#ca8a04' }} data-testid="text-remaining-cal">
            {eatenStr}
          </span>
          <span className="text-[9px] font-medium leading-none ml-0.5" style={{ color: 'rgba(202, 138, 4, 0.45)' }}>/ {total.toLocaleString()}</span>
        </div>
      </div>
      <span className="text-[10px] font-semibold mt-1" style={{ color: '#ca8a04' }}>Calories</span>
    </div>
  );
}

interface MacroWheelProps {
  label: string;
  consumed: number;
  target: number;
  gradientId: string;
  gradientColors: [string, string];
  size?: number;
  strokeWidth?: number;
}

function MacroWheel({ label, consumed, target, gradientId, gradientColors, size = 90, strokeWidth = 8 }: MacroWheelProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(consumed / target, 1) : 0;
  const dashOffset = circumference * (1 - progress);
  const remaining = Math.max(target - consumed, 0);
  const testId = label.toLowerCase();
  const isBlank = target === 0;
  // Use the darker gradient color for text
  const textColor = gradientColors[1];
  const consumedStr = String(consumed);
  const numFontSize = consumedStr.length >= 4 ? 14 : 17;

  return (
    <div className="flex flex-col items-center" data-testid={`macro-wheel-${testId}`}>
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
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColors[0]} />
              <stop offset="100%" stopColor={gradientColors[1]} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {isBlank ? (
            <span className="text-sm font-bold font-display leading-none text-muted-foreground" data-testid={`text-macro-remaining-${testId}`}>—</span>
          ) : (
            <>
              <span className="font-extrabold font-display leading-none" style={{ fontSize: numFontSize, color: textColor }} data-testid={`text-macro-remaining-${testId}`}>{consumed}</span>
              <span className="text-[9px] font-medium leading-none ml-0.5" style={{ color: textColor, opacity: 0.45 }}>/ {target}g</span>
            </>
          )}
        </div>
      </div>
      <span className="text-[10px] font-semibold mt-1" style={{ color: textColor }} data-testid={`text-macro-label-${testId}`}>{label}</span>
    </div>
  );
}

interface CalorieCounterCardProps {
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
  onFinishSetup?: () => void;
  onUpdateGoals?: () => void;
}

// Macro visibility is free for everyone — the card no longer carries a Pro
// lock. Pro gating lives only on the auto calculator (macro wizard Guide Me).
export function CalorieCounterCard({
  macrosSet,
  goalCalories,
  goalProtein,
  goalCarbs,
  goalFat,
  consumed,
  onFinishSetup,
  onUpdateGoals,
}: CalorieCounterCardProps) {
  const remaining = goalCalories - consumed.calories;

  return (
    <Card
      className="border-0 overflow-visible"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.1)' }}
      data-testid="card-calorie-counter"
    >
      <CardContent className="p-4 sm:p-5">
        {macrosSet ? (
          <div className="flex justify-around items-start">
            <CalorieRing remaining={remaining} total={goalCalories} />
            <MacroWheel label="Protein" consumed={consumed.protein} target={goalProtein} gradientId="proteinGradient" gradientColors={["#FDBA74", "#C2410C"]} />
            <MacroWheel label="Carbs" consumed={consumed.carbs} target={goalCarbs} gradientId="carbsGradient" gradientColors={["#4ADE80", "#16A34A"]} />
            <MacroWheel label="Fat" consumed={consumed.fat} target={goalFat} gradientId="fatGradient" gradientColors={["#3B82F6", "#1E40AF"]} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex justify-around items-start">
              <CalorieRing remaining={remaining} total={goalCalories} />
              <div className="opacity-30 pointer-events-none select-none">
                <MacroWheel label="Protein" consumed={0} target={0} gradientId="proteinGradientSetup" gradientColors={["#FDBA74", "#C2410C"]} />
              </div>
              <div className="opacity-30 pointer-events-none select-none">
                <MacroWheel label="Carbs" consumed={0} target={0} gradientId="carbsGradientSetup" gradientColors={["#4ADE80", "#16A34A"]} />
              </div>
              <div className="opacity-30 pointer-events-none select-none">
                <MacroWheel label="Fat" consumed={0} target={0} gradientId="fatGradientSetup" gradientColors={["#3B82F6", "#1E40AF"]} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground flex-1">Set up your macro goals to see detailed tracking</p>
              {onFinishSetup && (
                <Button
                  size="sm"
                  onClick={onFinishSetup}
                  className="bg-recipal-orange shrink-0"
                  data-testid="button-finish-setup"
                >
                  Finish setting up macros
                </Button>
              )}
            </div>
          </div>
        )}

        {onUpdateGoals && (
          <div className="flex justify-center mt-4">
            <Button
              size="sm"
              onClick={onUpdateGoals}
              className="w-1/2 text-xs font-bold bg-[#22c55e] hover:bg-[#22c55e]/90 text-white"
              data-testid="button-update-goals"
            >
              <Settings2 className="w-3.5 h-3.5 mr-1.5" />
              Update Goals
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
