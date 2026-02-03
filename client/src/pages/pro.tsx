import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Check, LayoutDashboard, Target, PieChart, ArrowRight, Calculator, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import Dashboard from "./dashboard";

type ProTab = "overview" | "tracker" | "targets" | "onboarding";
type OnboardingPath = null | "fast" | "guided";
type GuidedStep = 0 | 1 | 2 | 3 | 4;

export default function ProPage() {
  const [activeTab, setActiveTab] = useState<ProTab>("overview");
  const [onboardingPath, setOnboardingPath] = useState<OnboardingPath>(null);
  const [guidedStep, setGuidedStep] = useState<GuidedStep>(0);
  const { data: profile } = useProfile();
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { toast } = useToast();

  // Fast track state
  const [calories, setCalories] = useState(String(profile?.targetCalories || 2000));
  const [macroMode, setMacroMode] = useState<"grams" | "percent">("grams");
  const [protein, setProtein] = useState(String(profile?.targetProtein || 150));
  const [carbs, setCarbs] = useState(String(profile?.targetCarbs || 200));
  const [fat, setFat] = useState(String(profile?.targetFat || 67));

  // Guided setup state
  const [goal, setGoal] = useState("maintain");
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("10");
  const [weight, setWeight] = useState("170");
  const [age, setAge] = useState("30");
  const [sex, setSex] = useState("male");
  const [activity, setActivity] = useState("moderate");

  // Validate numeric input
  const safeParseFloat = (val: string, fallback: number): number => {
    const num = parseFloat(val);
    return isNaN(num) || val.trim() === "" ? fallback : num;
  };

  // Mifflin-St Jeor calculation
  const calculateMacros = () => {
    const weightKg = safeParseFloat(weight, 170) * 0.453592;
    const heightCm = (safeParseFloat(heightFt, 5) * 12 + safeParseFloat(heightIn, 10)) * 2.54;
    const ageNum = safeParseFloat(age, 30);

    // BMR calculation
    let bmr: number;
    if (sex === "male") {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageNum + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageNum - 161;
    }

    // Activity multipliers
    const multipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725
    };

    const tdee = bmr * (multipliers[activity] || 1.55);

    // Goal adjustments
    let targetCal = tdee;
    if (goal === "lose") targetCal = tdee - 500;
    if (goal === "gain") targetCal = tdee + 300;
    // "energy", "healthy", "maintain" - use maintenance calories

    // Macro splits (balanced approach)
    const proteinG = Math.round((targetCal * 0.3) / 4);
    const carbsG = Math.round((targetCal * 0.4) / 4);
    const fatG = Math.round((targetCal * 0.3) / 9);

    return {
      calories: Math.round(targetCal),
      protein: proteinG,
      carbs: carbsG,
      fat: fatG,
      tdee: Math.round(tdee)
    };
  };

  // Validate percent totals
  const percentTotal = macroMode === "percent" 
    ? safeParseFloat(protein, 0) + safeParseFloat(carbs, 0) + safeParseFloat(fat, 0)
    : 100;

  const saveMacros = (cals: number, prot: number, carb: number, fatG: number) => {
    updateProfile({
      targetCalories: cals,
      targetProtein: prot,
      targetCarbs: carb,
      targetFat: fatG
    }, {
      onSuccess: () => {
        toast({ title: "Macro targets updated" });
        setActiveTab("overview");
        setOnboardingPath(null);
        setGuidedStep(0);
      }
    });
  };

  if (activeTab === "tracker") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setActiveTab("overview")} className="mb-4">
          &larr; Back to Pro Overview
        </Button>
        <Dashboard />
      </div>
    );
  }

  if (activeTab === "onboarding") {
    // Step 0: Choose path
    if (!onboardingPath) {
      return (
        <div className="max-w-2xl mx-auto space-y-8 py-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-display font-bold text-recipal-deep-green">Set Up Your Targets</h1>
            <p className="text-muted-foreground">Choose how you'd like to set your nutrition goals</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card 
              className="cursor-pointer hover-elevate border-2 hover:border-primary transition-colors"
              onClick={() => setOnboardingPath("fast")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-recipal-orange" />
                  I Know My Numbers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter your calorie and macro targets directly if you already have them calculated.
                </p>
                <Button className="w-full bg-recipal-orange hover:bg-recipal-orange/90">
                  Enter My Numbers <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover-elevate border-2 hover:border-primary transition-colors"
              onClick={() => { setOnboardingPath("guided"); setGuidedStep(1); }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-recipal-orange" />
                  Guide Me
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Answer a few questions and we'll calculate personalized targets for you.
                </p>
                <Button variant="outline" className="w-full">
                  Build My Plan <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Button variant="ghost" onClick={() => setActiveTab("overview")} className="mx-auto block">
            &larr; Back to Pro Overview
          </Button>
        </div>
      );
    }

    // Fast Track
    if (onboardingPath === "fast") {
      const calculatedCals = macroMode === "percent" 
        ? parseInt(calories)
        : parseInt(protein) * 4 + parseInt(carbs) * 4 + parseInt(fat) * 9;

      return (
        <div className="max-w-lg mx-auto space-y-6 py-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-display font-bold text-recipal-deep-green">Enter Your Targets</h1>
            <p className="text-muted-foreground text-sm">We'll keep everything balanced.</p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>Daily Calories</Label>
                <Input 
                  type="number" 
                  value={calories} 
                  onChange={(e) => setCalories(e.target.value)}
                  data-testid="input-calories"
                />
              </div>

              <div className="space-y-3">
                <Label>Macro Entry Mode</Label>
                <RadioGroup value={macroMode} onValueChange={(v) => setMacroMode(v as "grams" | "percent")}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="grams" id="grams" />
                      <Label htmlFor="grams" className="font-normal">Grams</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="percent" id="percent" />
                      <Label htmlFor="percent" className="font-normal">Percentages</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Protein {macroMode === "percent" ? "%" : "g"}</Label>
                  <Input 
                    type="number" 
                    value={protein} 
                    onChange={(e) => setProtein(e.target.value)}
                    data-testid="input-protein"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Carbs {macroMode === "percent" ? "%" : "g"}</Label>
                  <Input 
                    type="number" 
                    value={carbs} 
                    onChange={(e) => setCarbs(e.target.value)}
                    data-testid="input-carbs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fat {macroMode === "percent" ? "%" : "g"}</Label>
                  <Input 
                    type="number" 
                    value={fat} 
                    onChange={(e) => setFat(e.target.value)}
                    data-testid="input-fat"
                  />
                </div>
              </div>

              {macroMode === "grams" && (
                <p className="text-sm text-muted-foreground text-center">
                  Calculated: {calculatedCals} calories
                </p>
              )}

              {macroMode === "percent" && percentTotal !== 100 && (
                <p className="text-sm text-destructive text-center">
                  Percentages must total 100% (currently {percentTotal}%)
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOnboardingPath(null)}>
              Back
            </Button>
            <Button 
              className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90"
              onClick={() => {
                let finalCals = safeParseFloat(calories, 2000);
                let finalP = safeParseFloat(protein, 150);
                let finalC = safeParseFloat(carbs, 200);
                let finalF = safeParseFloat(fat, 67);

                if (macroMode === "percent") {
                  if (percentTotal !== 100) {
                    toast({ title: "Error", description: "Percentages must total 100%", variant: "destructive" });
                    return;
                  }
                  finalP = Math.round((finalCals * safeParseFloat(protein, 30) / 100) / 4);
                  finalC = Math.round((finalCals * safeParseFloat(carbs, 40) / 100) / 4);
                  finalF = Math.round((finalCals * safeParseFloat(fat, 30) / 100) / 9);
                }

                saveMacros(Math.round(finalCals), Math.round(finalP), Math.round(finalC), Math.round(finalF));
              }}
              disabled={isPending || (macroMode === "percent" && percentTotal !== 100)}
              data-testid="button-save-targets"
            >
              Save Targets
            </Button>
          </div>

          <button 
            className="text-sm text-muted-foreground mx-auto block hover:underline"
            onClick={() => { setOnboardingPath("guided"); setGuidedStep(1); }}
          >
            Or let us guide you &rarr;
          </button>
        </div>
      );
    }

    // Guided Setup
    if (onboardingPath === "guided") {
      return (
        <div className="max-w-lg mx-auto space-y-6 py-8">
          <button 
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => setOnboardingPath("fast")}
          >
            Enter numbers manually &rarr;
          </button>

          {guidedStep === 1 && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-display font-bold text-recipal-deep-green">What's your main goal?</h1>
                <p className="text-muted-foreground text-sm">This helps us set calories and macros correctly.</p>
              </div>
              <RadioGroup value={goal} onValueChange={setGoal} className="space-y-3">
                {[
                  { value: "lose", label: "Lose fat" },
                  { value: "maintain", label: "Maintain weight" },
                  { value: "gain", label: "Build muscle" },
                  { value: "energy", label: "Improve energy or performance" },
                  { value: "healthy", label: "Eat healthier without strict goals" },
                ].map((opt) => (
                  <div key={opt.value} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setGoal(opt.value)}>
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <Label htmlFor={opt.value} className="flex-1 cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              <Button className="w-full bg-recipal-orange hover:bg-recipal-orange/90" onClick={() => setGuidedStep(2)}>
                Continue
              </Button>
            </>
          )}

          {guidedStep === 2 && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-display font-bold text-recipal-deep-green">A few basics</h1>
                <p className="text-muted-foreground text-sm">Used to estimate your daily needs.</p>
              </div>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Height (ft)</Label>
                      <Input type="number" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Height (in)</Label>
                      <Input type="number" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (lbs)</Label>
                    <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Biological Sex</Label>
                    <RadioGroup value={sex} onValueChange={setSex} className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="male" id="male" />
                        <Label htmlFor="male">Male</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="female" id="female" />
                        <Label htmlFor="female">Female</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setGuidedStep(1)}>Back</Button>
                <Button className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90" onClick={() => setGuidedStep(3)}>Continue</Button>
              </div>
            </>
          )}

          {guidedStep === 3 && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-display font-bold text-recipal-deep-green">How active are you?</h1>
                <p className="text-muted-foreground text-sm">On most weeks</p>
              </div>
              <RadioGroup value={activity} onValueChange={setActivity} className="space-y-3">
                {[
                  { value: "sedentary", label: "Mostly sedentary" },
                  { value: "light", label: "Lightly active (walking, light workouts)" },
                  { value: "moderate", label: "Active (3-5 workouts/week)" },
                  { value: "active", label: "Very active (hard training or physical job)" },
                ].map((opt) => (
                  <div key={opt.value} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setActivity(opt.value)}>
                    <RadioGroupItem value={opt.value} id={`act-${opt.value}`} />
                    <Label htmlFor={`act-${opt.value}`} className="flex-1 cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setGuidedStep(2)}>Back</Button>
                <Button className="flex-1 bg-recipal-orange hover:bg-recipal-orange/90" onClick={() => setGuidedStep(4)}>Continue</Button>
              </div>
            </>
          )}

          {guidedStep === 4 && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-display font-bold text-recipal-deep-green">Your Personalized Targets</h1>
                <p className="text-muted-foreground text-sm">Based on the Mifflin-St Jeor formula</p>
              </div>
              {(() => {
                const macros = calculateMacros();
                return (
                  <Card className="border-2 border-primary">
                    <CardContent className="p-6 space-y-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Maintenance (TDEE)</p>
                        <p className="text-lg font-medium">{macros.tdee} cal/day</p>
                      </div>
                      <div className="text-center p-4 bg-primary/10 rounded-xl">
                        <p className="text-sm text-muted-foreground">Your Goal Calories</p>
                        <p className="text-3xl font-bold text-recipal-deep-green">{macros.calories}</p>
                        <p className="text-xs text-muted-foreground">calories per day</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-recipal-orange/10 rounded-lg">
                          <p className="text-xl font-bold text-recipal-orange">{macros.protein}g</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Protein</p>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <p className="text-xl font-bold text-primary">{macros.carbs}g</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Carbs</p>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <p className="text-xl font-bold text-blue-800 dark:text-blue-300">{macros.fat}g</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Fat</p>
                        </div>
                      </div>
                      <Button 
                        className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
                        onClick={() => saveMacros(macros.calories, macros.protein, macros.carbs, macros.fat)}
                        disabled={isPending}
                        data-testid="button-save-guided-targets"
                      >
                        Save Targets
                      </Button>
                    </CardContent>
                  </Card>
                );
              })()}
              <Button variant="outline" className="w-full" onClick={() => setGuidedStep(3)}>
                Back
              </Button>
            </>
          )}
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 space-y-2">
        <div className="p-4 bg-recipal-deep-green text-white rounded-xl mb-6">
          <h2 className="font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 fill-current text-recipal-orange" />
            Pro Features
          </h2>
        </div>
        <Button 
          variant={activeTab === "overview" ? "secondary" : "ghost"} 
          className="w-full justify-start gap-2"
          onClick={() => setActiveTab("overview")}
          data-testid="button-pro-overview"
        >
          <LayoutDashboard className="w-4 h-4" /> Overview
        </Button>
        <Button 
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => setActiveTab("tracker")}
          data-testid="button-pro-tracker"
        >
          <PieChart className="w-4 h-4" /> Macro Tracker
        </Button>
        <Button 
          variant={activeTab === "targets" ? "secondary" : "ghost"} 
          className="w-full justify-start gap-2"
          onClick={() => setActiveTab("onboarding")}
          data-testid="button-pro-targets"
        >
          <Target className="w-4 h-4" /> Macro Targets
        </Button>
      </aside>

      <main className="flex-1 space-y-8">
        <div className="text-left">
          <h1 className="text-3xl font-display font-bold text-recipal-deep-green">ReciPal Pro</h1>
          <p className="text-muted-foreground mt-2">Your complete nutrition and planning powerhouse.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="border-2 border-primary shadow-lg relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-recipal-orange fill-current" />
                Active Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">Pro Member &bull; $4.99/mo</p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  "Full Macronutrient Tracker",
                  "Micronutrient Breakdowns",
                  "Automated Macro-Balanced Planning",
                  "Weekly Nutrition Trends",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" /> {f}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {profile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Macro Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{profile.targetCalories}</p>
                    <p className="text-xs text-muted-foreground">Calories</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-recipal-orange">{profile.targetProtein}g</p>
                    <p className="text-xs text-muted-foreground">Protein</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{profile.targetCarbs}g</p>
                    <p className="text-xs text-muted-foreground">Carbs</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{profile.targetFat}g</p>
                    <p className="text-xs text-muted-foreground">Fat</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setActiveTab("onboarding")}
                >
                  Update Targets
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
