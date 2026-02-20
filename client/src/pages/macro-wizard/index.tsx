import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Target, Zap, Check, Calculator, Flame, Dumbbell, Scale, Activity, Ruler } from "lucide-react";
import { useLocation } from "wouter";
import { useProfile } from "@/hooks/use-profile";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDemoStore } from "@/lib/demo-store";

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

  const age = profile?.age || 30;

  const calculateGuideMeMacros = useMemo((): MacroTargets => {
    const heightCm = (heightFeet * 12 + heightInches) * 2.54;
    const weightKg = weightLbs * 0.453592;
    
    let bmr: number;
    if (sex === "male") {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }
    
    const multipliers: Record<ActivityLevel, number> = {
      light: 1.375,
      moderate: 1.55,
      very_active: 1.725,
    };
    
    let tdee = bmr * multipliers[activityLevel];
    
    const goalAdjustments: Record<GoalType, number> = {
      lose_fat: 0.85,
      maintain: 1.0,
      build_muscle: 1.10,
      performance: 1.05,
    };
    
    const calories = Math.round(tdee * goalAdjustments[goal]);
    
    // For build_muscle, use protein-first logic based on trainingStyle + priority
    if (goal === "build_muscle") {
      // Step 1: Protein (grams anchored to bodyweight in lbs)
      const proteinMultiplierMap: Record<TrainingStyle, Record<Priority, number>> = {
        strength: { lean_gain: 1.1, balanced: 0.9, performance: 0.9 },
        mixed: { lean_gain: 0.9, balanced: 0.85, performance: 0.85 },
        endurance: { lean_gain: 0.8, balanced: 0.8, performance: 0.8 },
      };
      const proteinMultiplier = proteinMultiplierMap[trainingStyle][priority];
      const minProteinMultiplier = 0.8; // Safety floor
      let protein_g = Math.round(weightLbs * Math.max(proteinMultiplier, minProteinMultiplier));
      let protein_cal = protein_g * 4;
      
      // Step 2: Fat (stable range + minimum floor)
      let fatPctTarget = 0.25; // 25% of calories
      const fatGMin = Math.round(weightLbs * 0.30); // 0.3 g/lb minimum floor
      let fat_g_from_pct = Math.round((calories * fatPctTarget) / 9);
      let fat_g = Math.max(fat_g_from_pct, fatGMin);
      let fat_cal = fat_g * 9;
      
      // Step 3: Carbs (remainder)
      let carb_cal = calories - protein_cal - fat_cal;
      let carbs_g = Math.round(carb_cal / 4);
      
      // Step 4: Safety clamps
      if (carb_cal < 0) {
        // First reduce fatPctTarget to 0.20
        fatPctTarget = 0.20;
        fat_g_from_pct = Math.round((calories * fatPctTarget) / 9);
        fat_g = Math.max(fat_g_from_pct, fatGMin);
        fat_cal = fat_g * 9;
        carb_cal = calories - protein_cal - fat_cal;
        carbs_g = Math.round(carb_cal / 4);
      }
      
      if (carb_cal < 0) {
        // Reduce protein toward minimum 0.8 g/lb
        protein_g = Math.round(weightLbs * minProteinMultiplier);
        protein_cal = protein_g * 4;
        carb_cal = calories - protein_cal - fat_cal;
        carbs_g = Math.round(carb_cal / 4);
      }
      
      // Never return negative carbs
      carbs_g = Math.max(0, carbs_g);
      
      return { calories, protein: protein_g, carbs: carbs_g, fat: fat_g };
    }
    
    // For other goals, use existing kg-based logic
    const proteinMultipliers: Record<GoalType, number> = {
      lose_fat: 2.0,
      maintain: 1.6,
      build_muscle: 1.8, // This branch won't be reached for build_muscle
      performance: 1.6,
    };
    
    const protein = Math.round(weightKg * proteinMultipliers[goal]);
    const fat = Math.round(weightKg * 0.8);
    const proteinCals = protein * 4;
    const fatCals = fat * 9;
    const carbsCals = Math.max(calories - proteinCals - fatCals, 0);
    const carbs = Math.round(carbsCals / 4);
    
    return { calories, protein, carbs, fat };
  }, [sex, heightFeet, heightInches, weightLbs, activityLevel, goal, age, trainingStyle, priority]);

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

  const handleApplyMacros = () => {
    if (!calculatedTargets) return;
    
    saveMacrosMutation.mutate(calculatedTargets, {
      onSuccess: () => {
        toast({
          title: "Macros saved!",
          description: "Your daily macro targets have been updated.",
        });
        setLocation("/profile");
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 p-4 border-b sticky top-0 bg-background z-10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            if (path === "start") setLocation("/profile");
            else if (path === "summary") {
              if (prevPath === "guide-me") {
                setPath("guide-me");
                // Go back to last step: step 6 (Priority) for build_muscle, step 4 (Activity) otherwise
                setGuideStep(goal === "build_muscle" ? 6 : 4);
              } else {
                setPath("know-numbers");
              }
            }
            else if (path === "guide-me" && guideStep > 0) setGuideStep(guideStep - 1);
            else setPath("start");
          }} 
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Set up your macros</h1>
      </header>

      {path !== "start" && path !== "summary" && (
        <div className="px-4 py-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-recipal-orange transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Step {currentStep} of {totalSteps}
          </p>
        </div>
      )}

      <div className="flex-1 p-4 pb-24 overflow-auto">
        {path === "start" && (
          <div className="space-y-6">
            <p className="text-muted-foreground text-center">
              Choose how you'd like to set your daily macro targets
            </p>
            
            <div className="grid gap-4">
              <Card 
                className="cursor-pointer hover-elevate border-2 hover:border-recipal-orange/50 transition-colors"
                onClick={() => setPath("guide-me")}
                data-testid="card-guide-me"
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-recipal-orange/10 rounded-full flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-recipal-orange" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">Guide me</h3>
                    <p className="text-sm text-muted-foreground">
                      Answer a few questions and we'll calculate personalized macros based on your body and goals.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover-elevate border-2 hover:border-primary/50 transition-colors"
                onClick={() => setPath("know-numbers")}
                data-testid="card-know-numbers"
              >
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Calculator className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">I know my numbers</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your own calorie and macro targets directly.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {path === "guide-me" && guideStep === 0 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Target className="w-12 h-12 text-recipal-orange mx-auto" />
              <h2 className="text-xl font-bold">What's your primary goal?</h2>
            </div>
            
            <RadioGroup value={goal} onValueChange={(v) => setGoal(v as GoalType)} className="space-y-3">
              {[
                { value: "lose_fat", label: "Lose fat", desc: "Create a calorie deficit to shed body fat" },
                { value: "maintain", label: "Maintain weight", desc: "Stay at your current weight" },
                { value: "build_muscle", label: "Build muscle", desc: "Gain lean muscle with a calorie surplus" },
                { value: "performance", label: "Improve performance", desc: "Optimize energy for training" },
              ].map((option) => (
                <Card 
                  key={option.value} 
                  className={`cursor-pointer transition-colors ${goal === option.value ? "border-recipal-orange bg-recipal-orange/5" : ""}`}
                  onClick={() => setGoal(option.value as GoalType)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <div>
                      <Label htmlFor={option.value} className="font-medium cursor-pointer">{option.label}</Label>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
            
            <Button 
              onClick={() => setGuideStep(1)} 
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Scale className="w-12 h-12 text-recipal-orange mx-auto" />
              <h2 className="text-xl font-bold">What's your biological sex?</h2>
              <p className="text-sm text-muted-foreground">This helps us calculate your base metabolic rate</p>
            </div>
            
            <RadioGroup value={sex} onValueChange={(v) => setSex(v as SexType)} className="grid grid-cols-2 gap-4">
              {[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ].map((option) => (
                <Card 
                  key={option.value} 
                  className={`cursor-pointer transition-colors ${sex === option.value ? "border-recipal-orange bg-recipal-orange/5" : ""}`}
                  onClick={() => setSex(option.value as SexType)}
                >
                  <CardContent className="p-6 text-center">
                    <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                    <Label htmlFor={option.value} className="font-medium text-lg cursor-pointer">{option.label}</Label>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
            
            <Button 
              onClick={() => setGuideStep(2)} 
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Ruler className="w-12 h-12 text-recipal-orange mx-auto" />
              <h2 className="text-xl font-bold">What's your height?</h2>
            </div>
            
            <div className="flex gap-4 justify-center">
              <div className="space-y-2">
                <Label>Feet</Label>
                <Input 
                  type="number" 
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(Math.max(4, Math.min(7, parseInt(e.target.value) || 5)))}
                  className="w-24 text-center text-2xl h-14"
                  data-testid="input-height-feet"
                />
              </div>
              <div className="space-y-2">
                <Label>Inches</Label>
                <Input 
                  type="number" 
                  value={heightInches}
                  onChange={(e) => setHeightInches(Math.max(0, Math.min(11, parseInt(e.target.value) || 0)))}
                  className="w-24 text-center text-2xl h-14"
                  data-testid="input-height-inches"
                />
              </div>
            </div>
            
            <p className="text-center text-muted-foreground">
              {heightFeet}' {heightInches}" = {Math.round((heightFeet * 12 + heightInches) * 2.54)} cm
            </p>
            
            <Button 
              onClick={() => setGuideStep(3)} 
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 3 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Dumbbell className="w-12 h-12 text-recipal-orange mx-auto" />
              <h2 className="text-xl font-bold">What's your weight?</h2>
            </div>
            
            <div className="flex justify-center">
              <div className="space-y-2">
                <Label className="text-center block">Pounds</Label>
                <Input 
                  type="number" 
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(Math.max(80, Math.min(500, parseInt(e.target.value) || 150)))}
                  className="w-32 text-center text-2xl h-14"
                  data-testid="input-weight"
                />
              </div>
            </div>
            
            <p className="text-center text-muted-foreground">
              {weightLbs} lbs = {Math.round(weightLbs * 0.453592)} kg
            </p>
            
            <Button 
              onClick={() => setGuideStep(4)} 
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 4 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Flame className="w-12 h-12 text-recipal-orange mx-auto" />
              <h2 className="text-xl font-bold">How active are you?</h2>
            </div>
            
            <RadioGroup value={activityLevel} onValueChange={(v) => setActivityLevel(v as ActivityLevel)} className="space-y-3">
              {[
                { value: "light", label: "Light", desc: "Works out or participates in physical activities casually 1-2 times per week" },
                { value: "moderate", label: "Moderate", desc: "Works out or participates in physical activities 3-4 times per week" },
                { value: "very_active", label: "Very Active", desc: "Works out or participates in physical activities 5+ times per week" },
              ].map((option) => (
                <Card 
                  key={option.value} 
                  className={`cursor-pointer transition-colors ${activityLevel === option.value ? "border-recipal-orange bg-recipal-orange/5" : ""}`}
                  onClick={() => setActivityLevel(option.value as ActivityLevel)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                    <div>
                      <Label htmlFor={option.value} className="font-medium cursor-pointer">{option.label}</Label>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
            
            <Button 
              onClick={() => goal === "build_muscle" ? setGuideStep(5) : handleGoToSummary()}
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
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
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Dumbbell className="w-12 h-12 text-recipal-orange mx-auto" />
              <h2 className="text-xl font-bold">What best describes your training?</h2>
            </div>
            
            <RadioGroup value={trainingStyle} onValueChange={(v) => setTrainingStyle(v as TrainingStyle)} className="space-y-3">
              {[
                { value: "strength", label: "Strength/Hypertrophy focused", desc: "Heavy lifting, moderate volume, longer rests" },
                { value: "mixed", label: "Mixed training", desc: "Lifting + conditioning/sports" },
                { value: "endurance", label: "Endurance/Conditioning focused", desc: "HIIT/cardio/sports circuits" },
              ].map((option) => (
                <Card 
                  key={option.value} 
                  className={`cursor-pointer transition-colors ${trainingStyle === option.value ? "border-recipal-orange bg-recipal-orange/5" : ""}`}
                  onClick={() => setTrainingStyle(option.value as TrainingStyle)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <RadioGroupItem value={option.value} id={`training-${option.value}`} className="mt-1" />
                    <div>
                      <Label htmlFor={`training-${option.value}`} className="font-medium cursor-pointer">{option.label}</Label>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
            
            <Button 
              onClick={() => setGuideStep(6)}
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
              data-testid="button-next-step"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "guide-me" && guideStep === 6 && goal === "build_muscle" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Target className="w-12 h-12 text-recipal-orange mx-auto" />
              <h2 className="text-xl font-bold">What's your priority right now?</h2>
            </div>
            
            <RadioGroup value={priority} onValueChange={(v) => setPriority(v as Priority)} className="space-y-3">
              {[
                { value: "lean_gain", label: "Maximize lean muscle gain", desc: "Build muscle while staying as lean as possible" },
                { value: "balanced", label: "Balanced muscle + performance", desc: "Build muscle with good training performance" },
                { value: "performance", label: "Performance & training output", desc: "Prioritize energy for intense training" },
              ].map((option) => (
                <Card 
                  key={option.value} 
                  className={`cursor-pointer transition-colors ${priority === option.value ? "border-recipal-orange bg-recipal-orange/5" : ""}`}
                  onClick={() => setPriority(option.value as Priority)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <RadioGroupItem value={option.value} id={`priority-${option.value}`} className="mt-1" />
                    <div>
                      <Label htmlFor={`priority-${option.value}`} className="font-medium cursor-pointer">{option.label}</Label>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
            
            <Button 
              onClick={handleGoToSummary}
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
              data-testid="button-calculate"
            >
              Calculate My Macros <Check className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "know-numbers" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Calculator className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold">Enter your targets</h2>
            </div>
            
            <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
              <span className={`text-sm ${macroMode === "percentages" ? "font-bold" : "text-muted-foreground"}`}>Percentages</span>
              <Switch 
                checked={macroMode === "grams"}
                onCheckedChange={(checked) => setMacroMode(checked ? "grams" : "percentages")}
                data-testid="switch-macro-mode"
              />
              <span className={`text-sm ${macroMode === "grams" ? "font-bold" : "text-muted-foreground"}`}>Grams</span>
            </div>

            {macroMode === "percentages" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Daily Calories</Label>
                  <Input 
                    type="number"
                    value={manualCalories}
                    onChange={(e) => setManualCalories(Math.max(1000, Math.min(10000, parseInt(e.target.value) || 2000)))}
                    className="text-center text-xl h-12"
                    data-testid="input-calories"
                  />
                </div>
                
                <div className="space-y-4">
                  {[
                    { label: "Protein", value: proteinPercent, setter: (v: number) => handlePercentChange("protein", v), color: "bg-recipal-orange" },
                    { label: "Carbs", value: carbsPercent, setter: (v: number) => handlePercentChange("carbs", v), color: "bg-primary" },
                    { label: "Fat", value: fatPercent, setter: (v: number) => handlePercentChange("fat", v), color: "bg-blue-500" },
                  ].map((macro) => (
                    <div key={macro.label} className="space-y-2">
                      <div className="flex justify-between">
                        <Label>{macro.label}</Label>
                        <span className="font-bold">{macro.value}%</span>
                      </div>
                      <Slider
                        value={[macro.value]}
                        onValueChange={([v]) => macro.setter(v)}
                        max={100}
                        step={1}
                        className={`[&>span>span]:${macro.color}`}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {Math.round((manualCalories * macro.value / 100) / (macro.label === "Fat" ? 9 : 4))}g
                      </p>
                    </div>
                  ))}
                </div>
                
                <div className={`p-3 rounded-lg ${proteinPercent + carbsPercent + fatPercent === 100 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  <p className="text-sm font-medium text-center">
                    Total: {proteinPercent + carbsPercent + fatPercent}%
                    {proteinPercent + carbsPercent + fatPercent === 100 && " ✓"}
                  </p>
                </div>
              </div>
            )}

            {macroMode === "grams" && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-recipal-orange">Protein (g)</Label>
                    <Input 
                      type="number"
                      value={proteinGrams}
                      onChange={(e) => setProteinGrams(Math.max(0, Math.min(500, parseInt(e.target.value) || 0)))}
                      className="text-center"
                      data-testid="input-protein-grams"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-primary">Carbs (g)</Label>
                    <Input 
                      type="number"
                      value={carbsGrams}
                      onChange={(e) => setCarbsGrams(Math.max(0, Math.min(1000, parseInt(e.target.value) || 0)))}
                      className="text-center"
                      data-testid="input-carbs-grams"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-blue-800 dark:text-blue-300">Fat (g)</Label>
                    <Input 
                      type="number"
                      value={fatGrams}
                      onChange={(e) => setFatGrams(Math.max(0, Math.min(500, parseInt(e.target.value) || 0)))}
                      className="text-center"
                      data-testid="input-fat-grams"
                    />
                  </div>
                </div>
                
                <Card className="bg-muted">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Calculated Calories</p>
                    <p className="text-3xl font-bold">{calculateKnowNumbersMacros.calories}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ({proteinGrams}g × 4) + ({carbsGrams}g × 4) + ({fatGrams}g × 9)
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
            
            <Button 
              onClick={handleGoToSummary}
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90"
              data-testid="button-set-targets"
            >
              Set My Targets <Check className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {path === "summary" && calculatedTargets && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Your Daily Targets</h2>
              <p className="text-sm text-muted-foreground">Here's your personalized macro breakdown</p>
            </div>
            
            <Card className="bg-gradient-to-br from-recipal-orange/10 to-recipal-deep-green/10 border-2">
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Daily Calories</p>
                  <p className="text-4xl font-bold text-recipal-orange" data-testid="text-target-calories">{calculatedTargets.calories}</p>
                </div>
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Protein</p>
                    <p className="text-2xl font-bold text-recipal-orange" data-testid="text-target-protein">{calculatedTargets.protein}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Carbs</p>
                    <p className="text-2xl font-bold text-primary" data-testid="text-target-carbs">{calculatedTargets.carbs}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Fat</p>
                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-300" data-testid="text-target-fat">{calculatedTargets.fat}g</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {getMacroExplanation() && (
              <p className="text-sm text-muted-foreground text-center italic" data-testid="text-macro-explanation">
                {getMacroExplanation()}
              </p>
            )}
            
            <Button 
              onClick={handleApplyMacros}
              className="w-full bg-recipal-orange hover:bg-recipal-orange/90 h-14 text-lg"
              disabled={saveMacrosMutation.isPending}
              data-testid="button-apply-macros"
            >
              {saveMacrosMutation.isPending ? "Saving..." : "Apply Macros"}
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
