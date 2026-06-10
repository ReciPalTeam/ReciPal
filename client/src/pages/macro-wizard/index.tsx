import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowRight, Target, Zap, Check, Calculator, Flame, Dumbbell, Scale, Activity, Ruler, AlertTriangle } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useProfile } from "@/hooks/use-profile";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDemoStore } from "@/lib/demo-store";
import { calculateMacros as calcMacrosShared, wizardGoalToMacroGoal, wizardActivityToMacroActivity } from "@shared/macros";

type WizardPath = "start" | "guide-me" | "know-numbers" | "summary";
type GoalType = "lose_fat" | "maintain" | "build_muscle" | "performance";
type SexType = "male" | "female";
type ActivityLevel = "light" | "moderate" | "very_active";
type MacroInputMode = "percentages" | "grams";
type TrainingStyle = "strength" | "mixed" | "endurance";
type Priority = "lean_gain" | "balanced" | "performance";

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}


export default function MacroWizardPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const referrer = new URLSearchParams(searchString).get('from') || '/profile';
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setMacrosSet } = useDemoStore();

  const [path, setPath] = useState<WizardPath>("start");
  const [prevPath, setPrevPath] = useState<"guide-me" | "know-numbers">("guide-me");
  const [guideStep, setGuideStep] = useState(0);
  
  const [goal, setGoal] = useState<GoalType>("maintain");
  const [sex, setSex] = useState<SexType>("male");
  const [heightFeet, setHeightFeet] = useState(5);
  const [heightInches, setHeightInches] = useState(10);
  const [weightLbs, setWeightLbs] = useState(170);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>("strength");
  const [priority, setPriority] = useState<Priority>("lean_gain");
  
  const [macroMode, setMacroMode] = useState<MacroInputMode>("percentages");
  const [manualCalories, setManualCalories] = useState(2000);
  const [proteinPercent, setProteinPercent] = useState(30);
  const [carbsPercent, setCarbsPercent] = useState(40);
  const [fatPercent, setFatPercent] = useState(30);
  const [proteinGrams, setProteinGrams] = useState(150);
  const [carbsGrams, setCarbsGrams] = useState(200);
  const [fatGrams, setFatGrams] = useState(67);

  const [calculatedTargets, setCalculatedTargets] = useState<MacroTargets | null>(null);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);


  const age = profile?.age || 30;

  const calculateGuideMeMacros = useMemo((): MacroTargets => {
    const heightCm = (heightFeet * 12 + heightInches) * 2.54;

    const result = calcMacrosShared({
      sex,
      weightLbs,
      heightCm,
      age,
      activityLevel: wizardActivityToMacroActivity(activityLevel),
      goal: wizardGoalToMacroGoal(goal),
      trainingStyle,
      priority,
    });

    return {
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
    };
  }, [sex, heightFeet, heightInches, weightLbs, activityLevel, goal, age]);

  const calculateKnowNumbersMacros = useMemo((): MacroTargets => {
    if (macroMode === "percentages") {
      const protein = Math.round((manualCalories * proteinPercent / 100) / 4);
      const carbs = Math.round((manualCalories * carbsPercent / 100) / 4);
      const fat = Math.round((manualCalories * fatPercent / 100) / 9);
      return { calories: manualCalories, protein, carbs, fat };
    } else {
      const calories = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
      return { calories, protein: proteinGrams, carbs: carbsGrams, fat: fatGrams };
    }
  }, [macroMode, manualCalories, proteinPercent, carbsPercent, fatPercent, proteinGrams, carbsGrams, fatGrams]);

  const handlePercentChange = (type: "protein" | "carbs" | "fat", value: number) => {
    const current = { protein: proteinPercent, carbs: carbsPercent, fat: fatPercent };
    const oldValue = current[type];
    const diff = value - oldValue;
    
    const others = (["protein", "carbs", "fat"] as const).filter(t => t !== type);
    const othersTotal = others.reduce((sum, t) => sum + current[t], 0);
    
    if (othersTotal > 0) {
      const remaining = 100 - value;
      const ratio1 = current[others[0]] / othersTotal;
      const ratio2 = current[others[1]] / othersTotal;
      
      const new1 = Math.max(0, Math.min(100 - value, Math.round(remaining * ratio1)));
      const new2 = remaining - new1;
      
      if (type === "protein") {
        setProteinPercent(value);
        setCarbsPercent(new1);
        setFatPercent(new2);
      } else if (type === "carbs") {
        setCarbsPercent(value);
        setProteinPercent(new1);
        setFatPercent(new2);
      } else {
        setFatPercent(value);
        setProteinPercent(new1);
        setCarbsPercent(new2);
      }
    } else {
      if (type === "protein") setProteinPercent(value);
      else if (type === "carbs") setCarbsPercent(value);
      else setFatPercent(value);
    }
  };

  const saveMacrosMutation = useMutation({
    mutationFn: async (targets: MacroTargets) => {
      return apiRequest("POST", "/api/macro-targets", targets);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/macro-targets"] });
      setMacrosSet(true);
    },
  });

  const hasMacrosSaved = !!(profile?.targetCalories && profile?.targetProtein);

  const handleApplyMacros = () => {
    if (!calculatedTargets) return;
    if (hasMacrosSaved) {
      setShowOverrideConfirm(true);
      return;
    }
    confirmApplyMacros();
  };

  const confirmApplyMacros = () => {
    if (!calculatedTargets) return;
    setShowOverrideConfirm(false);
    saveMacrosMutation.mutate(calculatedTargets, {
      onSuccess: () => {
        toast({
          title: "Macros saved!",
          description: "Your daily macro targets have been updated.",
        });
        setLocation(referrer);
      },
    });
  };

  const handleGoToSummary = () => {
    const targets = path === "guide-me" ? calculateGuideMeMacros : calculateKnowNumbersMacros;
    setCalculatedTargets(targets);
    setPrevPath(path as "guide-me" | "know-numbers");
    setPath("summary");
  };

  const guideSteps = [
    { title: "Goal", icon: Target },
    { title: "Sex", icon: Scale },
    { title: "Height", icon: Activity },
    { title: "Weight", icon: Dumbbell },
    { title: "Activity", icon: Flame },
    ...(goal === "build_muscle" ? [
      { title: "Training", icon: Dumbbell },
      { title: "Priority", icon: Target },
    ] : []),
  ];

  // Dynamic step count: 5 base steps + 2 extra for build_muscle
  const totalSteps = path === "guide-me" ? (goal === "build_muscle" ? 7 : 5) : path === "know-numbers" ? 1 : 0;
  const currentStep = path === "guide-me" ? guideStep + 1 : 1;
  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  
  // Helper to get macro explanation text for build_muscle
  const getMacroExplanation = (): string | null => {
    if (goal !== "build_muscle" || prevPath !== "guide-me") return null;
    
    if (trainingStyle === "endurance") {
      return "Your macros prioritize carbs to support training output and recovery.";
    }
    if (trainingStyle === "strength" && priority === "lean_gain") {
      return "Your macros are protein-forward to support lean muscle gain with minimal fat gain.";
    }
    if (priority === "performance") {
      return "Your macros balance protein and carbs to support both muscle and training performance.";
    }
    return "Your macros are balanced to support muscle building and overall performance.";
  };

  return (
    <>
    <div className="fixed inset-0 flex justify-center" style={{ background: '#f2f2f7' }}>
    <div className="h-full w-full md:max-w-[430px] flex flex-col relative overflow-hidden overflow-y-auto md:shadow-xl" style={{ background: '#f2f2f7' }}>
      <header className="flex items-center p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (path === "start") setLocation(referrer);
            else if (path === "summary") {
              if (prevPath === "guide-me") {
                setPath("guide-me");
                setGuideStep(goal === "build_muscle" ? 6 : 4);
              } else {
                setPath("know-numbers");
              }
            }
            else if (path === "guide-me" && guideStep > 0) setGuideStep(guideStep - 1);
            else setPath("start");
          }}
          data-testid="button-back"
          className="text-[#ff6300] hover:bg-transparent"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </header>

      {path !== "start" && path !== "summary" && (
        <div className="px-6 py-2">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: '#e5e5ea' }}>
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #ff6300, #ff9500)' }}
            />
          </div>
          <p className="text-[12px] text-muted-foreground mt-1.5 text-center">
            Step {currentStep} of {totalSteps}
          </p>
        </div>
      )}

      <div className="flex-1 p-4 pb-24 overflow-auto">
        {path === "start" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <Target className="w-12 h-12 text-[#ff6300] mb-4" />
            <h2 className="text-[26px] font-extrabold text-foreground text-center mb-1.5">Set Your Macros</h2>
            <p className="text-[14px] text-muted-foreground text-center mb-8 leading-relaxed">
              How would you like to set your<br />daily nutrition targets?
            </p>

            <Button
              onClick={() => setPath("guide-me")}
              className="w-full max-w-[320px] h-14 rounded-full bg-[#ff6300] text-white text-[16px] font-semibold gap-2.5 mb-2 border-0"
              data-testid="card-guide-me"
            >
              <Zap className="w-5 h-5" fill="currentColor" />
              Guide Me
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mb-5">
              We'll calculate macros based on your body & goals
            </p>

            <Button
              onClick={() => setPath("know-numbers")}
              className="w-full max-w-[320px] h-14 rounded-full bg-green-600 text-white text-[16px] font-semibold gap-2.5 border-0 mb-2"
              data-testid="card-know-numbers"
            >
              <Calculator className="w-5 h-5" />
              I Know My Numbers
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Enter your own calorie and macro targets directly
            </p>
          </div>
        )}

        {path === "guide-me" && guideStep === 0 && (
          <div className="space-y-5">
            <div className="text-center">
              <Target className="w-12 h-12 text-[#ff6300] mx-auto mb-2" />
              <h2 className="text-[22px] font-extrabold text-foreground">What's your primary goal?</h2>
            </div>

            <RadioGroup value={goal} onValueChange={(v) => setGoal(v as GoalType)} className="space-y-2.5">
              {[
                { value: "lose_fat", label: "Lose fat", desc: "Create a calorie deficit to shed body fat" },
                { value: "maintain", label: "Maintain weight", desc: "Stay at your current weight" },
                { value: "build_muscle", label: "Build muscle", desc: "Gain lean muscle with a calorie surplus" },
                { value: "performance", label: "Improve performance", desc: "Optimize energy for training" },
              ].map((option) => {
                const selected = goal === option.value;
                return (
                <div
                  key={option.value}
                  className={`rounded-[16px] p-[18px] flex items-center gap-3.5 cursor-pointer transition-all ${
                    selected ? "bg-[#ff6300] text-white" : "bg-white dark:bg-card"
                  }`}
                  onClick={() => setGoal(option.value as GoalType)}
                >
                  <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selected ? "bg-white/30" : "border-2 border-[#d1d1d6]"
                  }`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <Label htmlFor={option.value} className={`font-bold text-[15px] cursor-pointer ${selected ? "text-white" : "text-foreground"}`}>{option.label}</Label>
                    <p className={`text-[12px] mt-0.5 ${selected ? "text-white/80" : "text-muted-foreground"}`}>{option.desc}</p>
                  </div>
                </div>
                );
              })}
            </RadioGroup>

            <Button
              onClick={() => setGuideStep(1)}
              className="w-full h-[52px] text-[16px] font-bold text-white rounded-full border-0 bg-[#ff6300]"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 1 && (
          <div className="space-y-5">
            <div className="text-center">
              <Scale className="w-12 h-12 text-[#ff6300] mx-auto mb-2" />
              <h2 className="text-[22px] font-extrabold text-foreground">What's your biological sex?</h2>
              <p className="text-[13px] text-muted-foreground mt-1">This helps us calculate your base metabolic rate</p>
            </div>

            <RadioGroup value={sex} onValueChange={(v) => setSex(v as SexType)} className="grid grid-cols-2 gap-3">
              {[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ].map((option) => {
                const selected = sex === option.value;
                return (
                <div
                  key={option.value}
                  className={`rounded-[16px] p-6 text-center cursor-pointer transition-all ${
                    selected ? "bg-[#ff6300] text-white" : "bg-white dark:bg-card"
                  }`}
                  onClick={() => setSex(option.value as SexType)}
                >
                  <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                  <Label htmlFor={option.value} className={`font-bold text-lg cursor-pointer ${selected ? "text-white" : "text-foreground"}`}>{option.label}</Label>
                </div>
                );
              })}
            </RadioGroup>

            <Button
              onClick={() => setGuideStep(2)}
              className="w-full h-[52px] text-[16px] font-bold text-white rounded-full border-0 bg-[#ff6300]"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 2 && (
          <div className="space-y-5">
            <div className="text-center">
              <Ruler className="w-12 h-12 text-[#ff6300] mx-auto mb-2" />
              <h2 className="text-[22px] font-extrabold text-foreground">What's your height?</h2>
            </div>

            <div className="flex gap-4 justify-center">
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold text-muted-foreground">Feet</Label>
                <NumericInput
                  value={heightFeet}
                  onChange={setHeightFeet}
                  min={4} max={7} fallback={5}
                  className="w-24 text-center text-2xl h-14 rounded-[14px]"
                  data-testid="input-height-feet"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold text-muted-foreground">Inches</Label>
                <NumericInput
                  value={heightInches}
                  onChange={setHeightInches}
                  min={0} max={11} fallback={0}
                  className="w-24 text-center text-2xl h-14 rounded-[14px]"
                  data-testid="input-height-inches"
                />
              </div>
            </div>

            <p className="text-center text-[13px] text-muted-foreground">
              {heightFeet}' {heightInches}" = {Math.round((heightFeet * 12 + heightInches) * 2.54)} cm
            </p>

            <Button
              onClick={() => setGuideStep(3)}
              className="w-full h-[52px] text-[16px] font-bold text-white rounded-full border-0 bg-[#ff6300]"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 3 && (
          <div className="space-y-5">
            <div className="text-center">
              <Dumbbell className="w-12 h-12 text-[#ff6300] mx-auto mb-2" />
              <h2 className="text-[22px] font-extrabold text-foreground">What's your weight?</h2>
            </div>

            <div className="flex justify-center">
              <div className="space-y-2">
                <Label className="text-center block text-[13px] font-semibold text-muted-foreground">Pounds</Label>
                <NumericInput
                  value={weightLbs}
                  onChange={setWeightLbs}
                  min={80}
                  max={500}
                  fallback={150}
                  className="w-32 text-center text-2xl h-14 rounded-[14px]"
                  data-testid="input-weight"
                />
              </div>
            </div>

            <p className="text-center text-[13px] text-muted-foreground">
              {weightLbs} lbs = {Math.round(weightLbs * 0.453592)} kg
            </p>

            <Button
              onClick={() => setGuideStep(4)}
              className="w-full h-[52px] text-[16px] font-bold text-white rounded-full border-0 bg-[#ff6300]"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 4 && (
          <div className="space-y-5">
            <div className="text-center">
              <Flame className="w-12 h-12 text-[#ff6300] mx-auto mb-2" />
              <h2 className="text-[22px] font-extrabold text-foreground">How active are you?</h2>
            </div>

            <RadioGroup value={activityLevel} onValueChange={(v) => setActivityLevel(v as ActivityLevel)} className="space-y-2.5">
              {[
                { value: "light", label: "Light", desc: "Works out or participates in physical activities casually 1-2 times per week" },
                { value: "moderate", label: "Moderate", desc: "Works out or participates in physical activities 3-4 times per week" },
                { value: "very_active", label: "Very Active", desc: "Works out or participates in physical activities 5+ times per week" },
              ].map((option) => {
                const selected = activityLevel === option.value;
                return (
                <div
                  key={option.value}
                  className={`rounded-[16px] p-[18px] flex items-start gap-3.5 cursor-pointer transition-all ${
                    selected ? "bg-[#ff6300] text-white" : "bg-white dark:bg-card"
                  }`}
                  onClick={() => setActivityLevel(option.value as ActivityLevel)}
                >
                  <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    selected ? "bg-white/30" : "border-2 border-[#d1d1d6]"
                  }`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <Label htmlFor={option.value} className={`font-bold text-[15px] cursor-pointer ${selected ? "text-white" : "text-foreground"}`}>{option.label}</Label>
                    <p className={`text-[12px] mt-0.5 ${selected ? "text-white/80" : "text-muted-foreground"}`}>{option.desc}</p>
                  </div>
                </div>
                );
              })}
            </RadioGroup>

            <Button
              onClick={() => goal === "build_muscle" ? setGuideStep(5) : handleGoToSummary()}
              className="w-full h-[52px] text-[16px] font-bold text-white rounded-full border-0 bg-[#ff6300]"
              data-testid="button-next-step"
            >
              {goal === "build_muscle" ? (
                <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>
              ) : (
                <>Calculate My Macros <Check className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 5 && goal === "build_muscle" && (
          <div className="space-y-5">
            <div className="text-center">
              <Dumbbell className="w-12 h-12 text-[#ff6300] mx-auto mb-2" />
              <h2 className="text-[22px] font-extrabold text-foreground">What best describes your training?</h2>
            </div>

            <RadioGroup value={trainingStyle} onValueChange={(v) => setTrainingStyle(v as TrainingStyle)} className="space-y-2.5">
              {[
                { value: "strength", label: "Strength/Hypertrophy focused", desc: "Heavy lifting, moderate volume, longer rests" },
                { value: "mixed", label: "Mixed training", desc: "Lifting + conditioning/sports" },
                { value: "endurance", label: "Endurance/Conditioning focused", desc: "HIIT/cardio/sports circuits" },
              ].map((option) => {
                const selected = trainingStyle === option.value;
                return (
                <div
                  key={option.value}
                  className={`rounded-[16px] p-[18px] flex items-start gap-3.5 cursor-pointer transition-all ${
                    selected ? "bg-[#ff6300] text-white" : "bg-white dark:bg-card"
                  }`}
                  onClick={() => setTrainingStyle(option.value as TrainingStyle)}
                >
                  <RadioGroupItem value={option.value} id={`training-${option.value}`} className="sr-only" />
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    selected ? "bg-white/30" : "border-2 border-[#d1d1d6]"
                  }`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <Label htmlFor={`training-${option.value}`} className={`font-bold text-[15px] cursor-pointer ${selected ? "text-white" : "text-foreground"}`}>{option.label}</Label>
                    <p className={`text-[12px] mt-0.5 ${selected ? "text-white/80" : "text-muted-foreground"}`}>{option.desc}</p>
                  </div>
                </div>
                );
              })}
            </RadioGroup>

            <Button
              onClick={() => setGuideStep(6)}
              className="w-full h-[52px] text-[16px] font-bold text-white rounded-full border-0 bg-[#ff6300]"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 6 && goal === "build_muscle" && (
          <div className="space-y-5">
            <div className="text-center">
              <Target className="w-12 h-12 text-[#ff6300] mx-auto mb-2" />
              <h2 className="text-[22px] font-extrabold text-foreground">What's your priority right now?</h2>
            </div>

            <RadioGroup value={priority} onValueChange={(v) => setPriority(v as Priority)} className="space-y-2.5">
              {[
                { value: "lean_gain", label: "Maximize lean muscle gain", desc: "Build muscle while staying as lean as possible" },
                { value: "balanced", label: "Balanced muscle + performance", desc: "Build muscle with good training performance" },
                { value: "performance", label: "Performance & training output", desc: "Prioritize energy for intense training" },
              ].map((option) => {
                const selected = priority === option.value;
                return (
                <div
                  key={option.value}
                  className={`rounded-[16px] p-[18px] flex items-start gap-3.5 cursor-pointer transition-all ${
                    selected ? "bg-[#ff6300] text-white" : "bg-white dark:bg-card"
                  }`}
                  onClick={() => setPriority(option.value as Priority)}
                >
                  <RadioGroupItem value={option.value} id={`priority-${option.value}`} className="sr-only" />
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    selected ? "bg-white/30" : "border-2 border-[#d1d1d6]"
                  }`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <Label htmlFor={`priority-${option.value}`} className={`font-bold text-[15px] cursor-pointer ${selected ? "text-white" : "text-foreground"}`}>{option.label}</Label>
                    <p className={`text-[12px] mt-0.5 ${selected ? "text-white/80" : "text-muted-foreground"}`}>{option.desc}</p>
                  </div>
                </div>
                );
              })}
            </RadioGroup>

            <Button
              onClick={handleGoToSummary}
              className="w-full h-[52px] text-[16px] font-bold text-white rounded-full border-0 bg-[#ff6300]"
              data-testid="button-calculate"
            >
              Calculate My Macros <Check className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "know-numbers" && (() => {
          const totalPercent = proteinPercent + carbsPercent + fatPercent;
          const isBalanced = totalPercent === 100;
          const diff = totalPercent - 100;

          return (
          <div className="space-y-4">

            <div className="text-center">
              <h2 className="text-[24px] font-extrabold text-foreground">Enter Your Targets</h2>
              <p className="text-[13px] text-muted-foreground mt-1">Set calories and macro split</p>
            </div>

            {/* Segmented Control - Glass pill style matching Recipes tabs */}
            <div className="flex justify-center">
              <div className="relative grid grid-cols-2 p-0 h-auto rounded-[9999px] bg-[#e5e5ea] dark:bg-white/10">
                {/* Sliding green indicator */}
                <div
                  className="absolute top-0 bottom-0 left-0 pointer-events-none rounded-[9999px] transition-transform duration-300 ease-out bg-[#16a34a]"
                  style={{
                    width: '50%',
                    transform: macroMode === "percentages" ? 'translateX(0%)' : 'translateX(100%)',
                  }}
                />
                <button
                  onClick={() => setMacroMode("percentages")}
                  className={`relative z-10 rounded-[9999px] text-sm font-medium py-2 px-6 transition-all duration-200 ${
                    macroMode === "percentages"
                      ? "text-white font-semibold"
                      : "text-gray-600/80 dark:text-white/70"
                  }`}
                  data-testid="switch-macro-mode-pct"
                >
                  Percentages
                </button>
                <button
                  onClick={() => setMacroMode("grams")}
                  className={`relative z-10 rounded-[9999px] text-sm font-medium py-2 px-6 transition-all duration-200 ${
                    macroMode === "grams"
                      ? "text-white font-semibold"
                      : "text-gray-600/80 dark:text-white/70"
                  }`}
                  data-testid="switch-macro-mode-grams"
                >
                  Grams
                </button>
              </div>
            </div>

            {macroMode === "percentages" && (
              <div className="space-y-3">
                {/* Calories Card */}
                <div className="bg-white dark:bg-card rounded-[20px] p-4 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Daily Calories</p>
                  <NumericInput
                    value={manualCalories}
                    onChange={setManualCalories}
                    min={1000}
                    max={10000}
                    fallback={2000}
                    className="text-center text-[38px] font-extrabold h-auto border-0 bg-transparent focus-visible:ring-0 tracking-tight"
                    data-testid="input-calories"
                  />
                  <p className="text-[11px] text-muted-foreground/50">kcal / day</p>
                </div>

                {/* Macro Cards Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Protein", value: proteinPercent, setter: setProteinPercent, color: "#ff6300" },
                    { label: "Carbs", value: carbsPercent, setter: setCarbsPercent, color: "#34c759" },
                    { label: "Fat", value: fatPercent, setter: setFatPercent, color: "#007aff" },
                  ].map((macro) => (
                    <div key={macro.label} className="bg-white dark:bg-card rounded-[20px] p-4 pt-5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden">
                      {/* Shimmer accent */}
                      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${macro.color}40, transparent)` }} />
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{macro.label}</p>
                      <div className="flex items-baseline justify-center gap-1 mt-1 px-1">
                        <NumericInput
                          value={macro.value}
                          onChange={macro.setter}
                          min={0}
                          max={100}
                          fallback={0}
                          className="w-full text-center text-[28px] font-extrabold h-auto border-0 bg-transparent focus-visible:ring-0 p-0"
                          data-testid={`input-${macro.label.toLowerCase()}-pct`}
                        />
                        <span className="text-[14px] text-muted-foreground font-semibold">%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                        = {Math.round((manualCalories * macro.value / 100) / (macro.label === "Fat" ? 9 : 4))}g
                      </p>
                    </div>
                  ))}
                </div>

                {/* Variance Card */}
                <div className={`rounded-[16px] p-3.5 ${
                  isBalanced
                    ? "border-[1.5px] border-green-500/20"
                    : "border-[1.5px] border-red-500/20"
                }`} style={{
                  background: isBalanced
                    ? 'linear-gradient(135deg, rgba(52,199,89,0.08), rgba(52,199,89,0.04))'
                    : 'linear-gradient(135deg, rgba(255,59,48,0.08), rgba(255,59,48,0.04))'
                }}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[13px] font-semibold ${isBalanced ? "text-green-600" : "text-red-500"}`}>
                      {isBalanced ? "✓ Total: 100%" : diff > 0 ? `Almost there — ${diff}% over` : `Almost there — ${Math.abs(diff)}% under`}
                    </span>
                    <span className={`text-[20px] font-extrabold ${isBalanced ? "text-green-600" : "text-red-500"}`}>
                      {totalPercent}%
                    </span>
                  </div>
                  <div className="flex h-[8px] rounded-[4px] overflow-hidden gap-[2px] mt-2">
                    <div className="rounded-[4px]" style={{ width: `${proteinPercent}%`, background: '#ff6300' }} />
                    <div className="rounded-[4px]" style={{ width: `${carbsPercent}%`, background: '#34c759' }} />
                    <div className="rounded-[4px]" style={{ width: `${fatPercent}%`, background: '#007aff' }} />
                  </div>
                  {!isBalanced && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">Tweak your split to add up to 100%</p>
                  )}
                </div>
              </div>
            )}

            {macroMode === "grams" && (
              <div className="space-y-3">
                {/* Macro Cards Grid - Grams mode */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Protein", value: proteinGrams, setter: setProteinGrams, color: "#ff6300", max: 500 },
                    { label: "Carbs", value: carbsGrams, setter: setCarbsGrams, color: "#34c759", max: 1000 },
                    { label: "Fat", value: fatGrams, setter: setFatGrams, color: "#007aff", max: 500 },
                  ].map((macro) => (
                    <div key={macro.label} className="bg-white dark:bg-card rounded-[20px] p-4 pt-5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${macro.color}40, transparent)` }} />
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{macro.label}</p>
                      <div className="flex items-baseline justify-center gap-1 mt-1 px-1">
                        <NumericInput
                          value={macro.value}
                          onChange={macro.setter}
                          min={0}
                          max={macro.max}
                          fallback={0}
                          className="w-full text-center text-[28px] font-extrabold h-auto border-0 bg-transparent focus-visible:ring-0 p-0"
                          data-testid={`input-${macro.label.toLowerCase()}-grams`}
                        />
                        <span className="text-[14px] text-muted-foreground font-semibold">g</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculated Calories */}
                <div className="bg-white dark:bg-card rounded-[20px] p-4 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Calculated Calories</p>
                  <p className="text-[38px] font-extrabold tracking-tight">{calculateKnowNumbersMacros.calories}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    ({proteinGrams}g × 4) + ({carbsGrams}g × 4) + ({fatGrams}g × 9)
                  </p>
                </div>
              </div>
            )}

            {/* CTA Button */}
            <div className="">
              <Button
                onClick={handleGoToSummary}
                disabled={macroMode === "percentages" && !isBalanced}
                className={`w-full h-14 rounded-full text-[16px] font-bold border-0 ${
                  macroMode === "percentages" && !isBalanced
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-[#ff6300] text-white"
                }`}
                data-testid="button-set-targets"
              >
                Set My Targets <Check className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
          );
        })()}

        {path === "summary" && calculatedTargets && (() => {
          const totalCals = calculatedTargets.calories || 1;
          const proteinPct = Math.round((calculatedTargets.protein * 4 / totalCals) * 100);
          const carbsPct = Math.round((calculatedTargets.carbs * 4 / totalCals) * 100);
          const fatPct = 100 - proteinPct - carbsPct;
          const circumference = 2 * Math.PI * 58;
          const proteinArc = (proteinPct / 100) * circumference;
          const carbsArc = (carbsPct / 100) * circumference;
          const fatArc = (fatPct / 100) * circumference;
          const gap = 6;

          return (
          <div className="space-y-5">
            {/* Success Icon + Title */}
            <div className="text-center pt-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'linear-gradient(135deg, rgba(52,199,89,0.15), rgba(52,199,89,0.05))', border: '2px solid rgba(52,199,89,0.2)' }}>
                <Check className="w-7 h-7 text-green-500" />
              </div>
              <h2 className="text-[26px] font-extrabold text-foreground">Your Daily Targets</h2>
              <p className="text-[13px] text-muted-foreground mt-1">Here's your personalized macro breakdown</p>
            </div>

            {/* Donut Chart Card */}
            <div className="bg-white dark:bg-card rounded-[24px] p-7 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">

              <div className="flex items-center justify-center gap-8">
                {/* Donut SVG */}
                <div className="relative w-[150px] h-[150px] flex-shrink-0">
                  <svg width="150" height="150" viewBox="0 0 150 150" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Protein arc */}
                    <circle cx="75" cy="75" r="58" fill="none" stroke="#ff6300" strokeWidth="14"
                      strokeDasharray={`${proteinArc - gap} ${circumference - proteinArc + gap}`}
                      strokeDashoffset="0" strokeLinecap="round" />
                    {/* Carbs arc */}
                    <circle cx="75" cy="75" r="58" fill="none" stroke="#34c759" strokeWidth="14"
                      strokeDasharray={`${carbsArc - gap} ${circumference - carbsArc + gap}`}
                      strokeDashoffset={`${-(proteinArc)}`} strokeLinecap="round" />
                    {/* Fat arc */}
                    <circle cx="75" cy="75" r="58" fill="none" stroke="#007aff" strokeWidth="14"
                      strokeDasharray={`${fatArc - gap} ${circumference - fatArc + gap}`}
                      strokeDashoffset={`${-(proteinArc + carbsArc)}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[32px] font-extrabold text-foreground leading-none" data-testid="text-target-calories">
                      {calculatedTargets.calories}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">kcal</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-[4px] flex-shrink-0" style={{ background: '#ff6300' }} />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Protein</p>
                      <p className="text-[20px] font-extrabold text-foreground leading-tight" data-testid="text-target-protein">
                        {calculatedTargets.protein}<span className="text-[12px] text-muted-foreground font-semibold">g</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-[4px] flex-shrink-0" style={{ background: '#34c759' }} />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Carbs</p>
                      <p className="text-[20px] font-extrabold text-foreground leading-tight" data-testid="text-target-carbs">
                        {calculatedTargets.carbs}<span className="text-[12px] text-muted-foreground font-semibold">g</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-[4px] flex-shrink-0" style={{ background: '#007aff' }} />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Fat</p>
                      <p className="text-[20px] font-extrabold text-foreground leading-tight" data-testid="text-target-fat">
                        {calculatedTargets.fat}<span className="text-[12px] text-muted-foreground font-semibold">g</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Explanation */}
            {getMacroExplanation() && (
              <p className="text-[12px] text-muted-foreground text-center px-8 leading-relaxed" data-testid="text-macro-explanation">
                {getMacroExplanation()}
              </p>
            )}

            {/* CTA Button */}
            <Button
              onClick={handleApplyMacros}
              className="w-full h-[52px] text-[17px] font-bold text-white rounded-full border-0 bg-[#ff6300]"
              disabled={saveMacrosMutation.isPending}
              data-testid="button-apply-macros"
            >
              {saveMacrosMutation.isPending ? "Saving..." : "Apply Macros"}
              {!saveMacrosMutation.isPending && <Check className="w-4 h-4 ml-2" />}
            </Button>
          </div>
          );
        })()}

      </div>

    </div>
    </div>

    {/* Override Confirmation Dialog */}
    <AlertDialog open={showOverrideConfirm} onOpenChange={setShowOverrideConfirm}>
      <AlertDialogContent style={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(255,99,0,0.12), rgba(255,149,0,0.08))' }}>
              <AlertTriangle className="w-5 h-5 text-[#ff6300]" />
            </div>
            <AlertDialogTitle className="text-[17px] font-bold">Override Existing Macros?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-[14px] text-muted-foreground leading-relaxed">
            You already have macro targets saved. Applying these new targets will replace your current settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmApplyMacros}
            className="rounded-full bg-[#ff6300] text-white font-bold border-0"
          >
            Override Macros
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
