import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Settings2 } from "lucide-react";

interface CalorieRingProps {
  remaining: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}

export function CalorieRing({ remaining, total, size = 75, strokeWidth = 8 }: CalorieRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const eaten = total - remaining;
  const progress = total > 0 ? Math.min(eaten / total, 1) : 0;
  const dashOffset = circumference * (1 - progress);

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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold font-display leading-none" data-testid="text-remaining-cal">
            {Math.max(eaten, 0).toLocaleString()}
          </span>
          <span className="text-[7px] text-muted-foreground font-medium mt-0.5">of {total.toLocaleString()} cal</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground font-medium mt-1">Calories</span>
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

function MacroWheel({ label, consumed, target, gradientId, gradientColors, size = 75, strokeWidth = 8 }: MacroWheelProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(consumed / target, 1) : 0;
  const dashOffset = circumference * (1 - progress);
  const remaining = Math.max(target - consumed, 0);
  const testId = label.toLowerCase();
  const isBlank = target === 0;

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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isBlank ? (
            <span className="text-sm font-bold font-display leading-none text-muted-foreground" data-testid={`text-macro-remaining-${testId}`}>—</span>
          ) : (
            <>
              <span className="text-sm font-bold font-display leading-none" data-testid={`text-macro-remaining-${testId}`}>{consumed}g</span>
              <span className="text-[7px] text-muted-foreground font-medium mt-0.5">of {target}g</span>
            </>
          )}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground font-medium mt-1" data-testid={`text-macro-label-${testId}`}>{label}</span>
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
  onUpdateGoals?: () => void;
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
        {isPro && macrosSet ? (
          <div className="flex justify-around items-start">
            <CalorieRing remaining={remaining} total={goalCalories} />
            <MacroWheel label="Protein" consumed={consumed.protein} target={goalProtein} gradientId="proteinGradient" gradientColors={["#FDBA74", "#C2410C"]} />
            <MacroWheel label="Carbs" consumed={consumed.carbs} target={goalCarbs} gradientId="carbsGradient" gradientColors={["#4ADE80", "#16A34A"]} />
            <MacroWheel label="Fat" consumed={consumed.fat} target={goalFat} gradientId="fatGradient" gradientColors={["#3B82F6", "#1E40AF"]} />
          </div>
        ) : isPro && !macrosSet ? (
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
        ) : (
          <div className="flex items-start gap-0">
            <div className="flex-shrink-0">
              <CalorieRing remaining={remaining} total={goalCalories} />
            </div>
            <div className="relative flex-1 flex justify-around items-start">
              <div className="blur-md opacity-50 pointer-events-none select-none">
                <MacroWheel label="Protein" consumed={85} target={150} gradientId="proteinGradientDemo" gradientColors={["#FDBA74", "#C2410C"]} />
              </div>
              <div className="blur-md opacity-50 pointer-events-none select-none">
                <MacroWheel label="Carbs" consumed={120} target={250} gradientId="carbsGradientDemo" gradientColors={["#4ADE80", "#16A34A"]} />
              </div>
              <div className="blur-md opacity-50 pointer-events-none select-none">
                <MacroWheel label="Fat" consumed={30} target={65} gradientId="fatGradientDemo" gradientColors={["#3B82F6", "#1E40AF"]} />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={onUpgrade}
                  className="bg-recipal-orange text-xs pointer-events-auto z-10 w-[200px]"
                  data-testid="button-upgrade-macros"
                >
                  <Lock className="w-3 h-3 mr-1" />
                  Join Pro To See Macros
                </Button>
                {onUpdateGoals && (
                  <Button
                    size="sm"
                    onClick={onUpdateGoals}
                    className="w-[200px] text-xs font-bold bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20 pointer-events-auto z-10"
                    data-testid="button-update-goals"
                  >
                    <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                    Update Goals
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {isPro && onUpdateGoals && (
          <div className="flex justify-center mt-4">
            <Button
              size="sm"
              onClick={onUpdateGoals}
              className="w-1/2 text-xs font-bold bg-[#22c55e] hover:bg-[#22c55e]/90 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.2)] border-t border-white/20"
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
