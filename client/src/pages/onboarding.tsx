import { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateProfile } from "@/hooks/use-profile";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, ChevronLeft, Check, X, Search, Camera, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ALLERGIES = ["Peanuts", "Tree nuts", "Shellfish", "Fish", "Dairy", "Eggs", "Soy", "Gluten", "Sesame"];
const DIETARY_REFS = ["None", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "Dairy-free", "Gluten-free", "Low-carb"];
const TOOLS = ["Oven", "Blender", "Food processor", "Air fryer", "Instant Pot", "Stand mixer"];
const CUISINES = [
  "African", "American", "Asian", "Caribbean", "French",
  "Indian", "Italian", "Latin American", "Mediterranean", "Mexican", "Middle Eastern"
];

const wizardSchema = z.object({
  // Step 1: Name & photo
  displayName: z.string().min(1, "Please enter your name"),
  profileImageUrl: z.string().nullable().default(null),
  // Step 2: Allergies
  allergies: z.array(z.string()).default([]),
  // Step 3: Dietary restrictions
  dietaryPreferences: z.array(z.string()).default([]),
  // Step 4: Diabetes
  isDiabetic: z.boolean().default(false),
  maxCarbPercent: z.number().int().min(0).max(999).nullable().default(null),
  // Step 5: Disliked foods
  dislikedFoods: z.array(z.string()).default([]),
  // Step 6: Cuisines (top 3)
  cuisinePreferences: z.array(z.string()).min(1, "Pick at least your favorite cuisine").max(3),
  // Step 7: Cooking style
  cookingComfort: z.enum(["quick", "comfortable", "involved"]),
  // Step 8: Kitchen tools
  missingTools: z.array(z.string()).default([]),
  // Step 9: Calorie goal
  calorieGoal: z.number().int().min(0).nullable().default(null),
});

type WizardData = z.infer<typeof wizardSchema>;

// Disliked foods search component
function DislikedFoodsSearch({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ canonical_name: string; category: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/ingredients/search?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.ingredients || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const handleInput = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  };

  const addFood = (name: string) => {
    if (!value.includes(name)) {
      onChange([...value, name]);
    }
    setQuery("");
    setResults([]);
  };

  const removeFood = (name: string) => {
    onChange(value.filter(f => f !== name));
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search foods or ingredients..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          className="pl-10"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      {results.length > 0 && (
        <div className="border rounded-lg max-h-48 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.canonical_name}
              type="button"
              onClick={() => addFood(item.canonical_name)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 flex justify-between items-center text-sm border-b last:border-b-0"
            >
              <span className="capitalize">{item.canonical_name}</span>
              <span className="text-xs text-muted-foreground capitalize">{item.category}</span>
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((food) => (
            <span
              key={food}
              className="inline-flex items-center gap-1 px-3 py-1 bg-destructive/10 text-destructive rounded-full text-sm capitalize"
            >
              {food}
              <button type="button" onClick={() => removeFood(food)} className="hover:bg-destructive/20 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {value.length === 0 && query.length === 0 && (
        <p className="text-xs text-muted-foreground">Start typing to search. You can skip this if you don't have any.</p>
      )}
    </div>
  );
}

// Cuisine picker — pick #1 favorite, then #2 and #3
function CuisinePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const handleToggle = (cuisine: string) => {
    if (value.includes(cuisine)) {
      onChange(value.filter(c => c !== cuisine));
    } else if (value.length < 3) {
      onChange([...value, cuisine]);
    }
  };

  const getLabel = (cuisine: string) => {
    const idx = value.indexOf(cuisine);
    if (idx === 0) return "1st";
    if (idx === 1) return "2nd";
    if (idx === 2) return "3rd";
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {CUISINES.map((cuisine) => {
          const selected = value.includes(cuisine);
          const rank = getLabel(cuisine);
          return (
            <button
              key={cuisine}
              type="button"
              onClick={() => handleToggle(cuisine)}
              disabled={!selected && value.length >= 3}
              className={`relative px-4 py-3 rounded-lg border text-sm font-medium transition-all text-left
                ${selected
                  ? "border-primary bg-primary/10 text-primary"
                  : value.length >= 3
                    ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
            >
              {cuisine}
              {rank && (
                <span className="absolute top-1 right-2 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                  {rank}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length === 0 && "Tap your favorite cuisine first, then pick your 2nd and 3rd choices."}
        {value.length === 1 && "Great! Now pick your 2nd and 3rd favorites."}
        {value.length === 2 && "One more! Pick your 3rd favorite."}
        {value.length === 3 && "Perfect — your top 3 cuisines are set!"}
      </p>
    </div>
  );
}

// Profile photo component
function ProfilePhotoUpload({ value, displayName, onChange }: { value: string | null; displayName: string; onChange: (url: string | null) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstLetter = displayName ? displayName.charAt(0).toUpperCase() : "?";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create a local preview URL for now
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors group"
      >
        {value ? (
          <img src={value} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">{firstLetter}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-6 h-6 text-white" />
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <p className="text-xs text-muted-foreground">
        {value ? "Tap to change photo" : "Add a profile photo (optional)"}
      </p>
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const { mutate: createProfile, isPending } = useCreateProfile();
  const { toast } = useToast();
  const [hasCalorieGoal, setHasCalorieGoal] = useState<boolean | null>(null);

  // Signup/onboarding is LIGHT-ONLY by design (like the auth + Go Pro locks).
  // The theme class is device-level, so a dark-mode device would otherwise
  // render this page dark. A CSS pin can't cleanly cover the form primitives
  // (Checkbox/RadioGroup/Input carry their own dark: classes), so strip the
  // .dark class for the lifetime of this exclusive full-screen route and
  // restore it on exit.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);

  const form = useForm<WizardData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      displayName: "",
      profileImageUrl: null,
      allergies: [],
      dietaryPreferences: [],
      isDiabetic: false,
      maxCarbPercent: null,
      dislikedFoods: [],
      cuisinePreferences: [],
      cookingComfort: "quick",
      missingTools: [],
      calorieGoal: null,
    },
  });

  const watchedName = form.watch("displayName");

  const onSubmit = () => {
    const data = form.getValues();
    // Build the payload — only include fields the free onboarding sets
    const payload: any = {
      displayName: data.displayName,
      profileImageUrl: data.profileImageUrl,
      allergies: data.allergies,
      dietaryPreferences: data.dietaryPreferences,
      isDiabetic: data.isDiabetic,
      maxCarbPercent: data.maxCarbPercent,
      dislikedFoods: data.dislikedFoods,
      cuisinePreferences: data.cuisinePreferences,
      cookingComfort: data.cookingComfort,
      missingTools: data.missingTools,
      calorieGoal: data.calorieGoal,
      subscriptionTier: "free",
      goal: "maintain",
      sex: "female",
      age: 30,
      height: 170,
      weight: 150,
      activityLevel: "moderate",
      trainingDays: 3,
      mealsPerDay: 3,
      snacksPerDay: 1,
      cookingTime: "normal",
      budgetMode: "normal",
      costPreference: "balanced",
      pantryStaples: [],
      macrosSet: false,
      targetCalories: 2000,
      targetProtein: 150,
      targetCarbs: 200,
      targetFat: 60,
    };

    createProfile(payload, {
      onSuccess: () => {
        toast({ title: `Welcome to ReciPal, ${data.displayName}!`, description: "Your preferences have been saved." });
        setLocation("/recipes");
      },
    });
  };

  const steps = [
    // Step 1: Name & Photo
    {
      id: "name",
      title: "Your Name",
      question: "Great to meet you! What's your name?",
      helper: "This is how you'll appear in the app.",
      component: (
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Enter your name"
                    {...field}
                    className="text-lg h-12"
                    autoFocus
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profileImageUrl"
            render={({ field }) => (
              <ProfilePhotoUpload
                value={field.value}
                displayName={watchedName}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      ),
      canContinue: () => watchedName.length > 0,
    },
    // Step 2: Allergies
    {
      id: "allergies",
      title: "Food Allergies",
      question: "Do you have any food allergies?",
      helper: "We'll never recommend recipes that include these ingredients.",
      component: (
        <FormField
          control={form.control}
          name="allergies"
          render={() => (
            <div className="grid grid-cols-2 gap-4">
              {ALLERGIES.map((item) => (
                <FormField
                  key={item}
                  control={form.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(item)}
                          onCheckedChange={(checked) =>
                            checked
                              ? field.onChange([...field.value, item])
                              : field.onChange(field.value?.filter((v) => v !== item))
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal">{item}</FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          )}
        />
      ),
    },
    // Step 3: Dietary Restrictions
    {
      id: "diet",
      title: "Dietary Restrictions",
      question: "Do you follow any dietary restrictions?",
      helper: "This helps us filter recipes so everything you see works for how you eat.",
      component: (
        <FormField
          control={form.control}
          name="dietaryPreferences"
          render={() => (
            <div className="grid grid-cols-2 gap-4">
              {DIETARY_REFS.map((item) => (
                <FormField
                  key={item}
                  control={form.control}
                  name="dietaryPreferences"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(item)}
                          onCheckedChange={(checked) =>
                            checked
                              ? field.onChange([...field.value, item])
                              : field.onChange(field.value?.filter((v) => v !== item))
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal">{item}</FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          )}
        />
      ),
    },
    // Step 4: Diabetes / Carb Preferences
    {
      id: "diabetic",
      title: "Carb Preferences",
      question: "Are you diabetic?",
      helper: "You control this setting.",
      component: (
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="isDiabetic"
            render={({ field }) => (
              <RadioGroup
                onValueChange={(val) => {
                  const isDiabetic = val === "yes";
                  field.onChange(isDiabetic);
                  if (isDiabetic && !form.getValues("maxCarbPercent")) {
                    form.setValue("maxCarbPercent", 60);
                  }
                  if (!isDiabetic) {
                    form.setValue("maxCarbPercent", null);
                  }
                }}
                defaultValue={field.value ? "yes" : "no"}
                className="space-y-4"
              >
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl><RadioGroupItem value="no" /></FormControl>
                  <FormLabel className="font-normal">No</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl><RadioGroupItem value="yes" /></FormControl>
                  <FormLabel className="font-normal">Yes</FormLabel>
                </FormItem>
              </RadioGroup>
            )}
          />
          {form.watch("isDiabetic") && (
            <FormField
              control={form.control}
              name="maxCarbPercent"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium">Carb limit (grams)</FormLabel>
                  <FormControl>
                    <NumericInput
                      value={field.value ?? 60}
                      onChange={(v) => field.onChange(v)}
                      min={0}
                      max={999}
                      fallback={60}
                      className="w-24 h-10 px-3 text-center"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Set a limit that works for you. This app does not provide medical advice.
                  </p>
                </FormItem>
              )}
            />
          )}
        </div>
      ),
    },
    // Step 5: Disliked Foods
    {
      id: "disliked",
      title: "Food Dislikes",
      question: "Any foods or ingredients you don't like?",
      helper: "We'll avoid recommending recipes with these. Search and add as many as you want.",
      component: (
        <FormField
          control={form.control}
          name="dislikedFoods"
          render={({ field }) => (
            <DislikedFoodsSearch value={field.value} onChange={field.onChange} />
          )}
        />
      ),
    },
    // Step 6: Favorite Cuisines
    {
      id: "cuisines",
      title: "Favorite Cuisines",
      question: "What's your favorite cuisine type?",
      helper: "Pick your top favorite, then your 2nd and 3rd. These shape your For You feed.",
      component: (
        <FormField
          control={form.control}
          name="cuisinePreferences"
          render={({ field }) => (
            <CuisinePicker value={field.value} onChange={field.onChange} />
          )}
        />
      ),
      canContinue: () => form.getValues("cuisinePreferences").length >= 1,
    },
    // Step 7: Cooking Style
    {
      id: "cooking",
      title: "Cooking Style",
      question: "How do you usually like to cook?",
      helper: "This helps us suggest recipes that match your comfort level and time.",
      component: (
        <FormField
          control={form.control}
          name="cookingComfort"
          render={({ field }) => (
            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-4">
              {[
                { value: "quick", label: "Quick & easy" },
                { value: "comfortable", label: "Comfortable following recipes" },
                { value: "involved", label: "I enjoy more involved cooking" },
              ].map((opt) => (
                <FormItem key={opt.value} className="flex items-center space-x-3 space-y-0">
                  <FormControl><RadioGroupItem value={opt.value} /></FormControl>
                  <FormLabel className="font-normal">{opt.label}</FormLabel>
                </FormItem>
              ))}
            </RadioGroup>
          )}
        />
      ),
    },
    // Step 8: Kitchen Tools
    {
      id: "tools",
      title: "Kitchen Tools",
      question: "Are there any kitchen tools you don't have?",
      helper: "So we don't recommend recipes you can't actually make.",
      component: (
        <FormField
          control={form.control}
          name="missingTools"
          render={() => (
            <div className="grid grid-cols-2 gap-4">
              {TOOLS.map((item) => (
                <FormField
                  key={item}
                  control={form.control}
                  name="missingTools"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(item)}
                          onCheckedChange={(checked) =>
                            checked
                              ? field.onChange([...field.value, item])
                              : field.onChange(field.value?.filter((v) => v !== item))
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal">{item}</FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          )}
        />
      ),
    },
    // Step 9: Calorie Goal
    {
      id: "calories",
      title: "Calorie Goal",
      question: "Do you have a daily calorie goal?",
      helper: "Track your daily intake with a calorie target.",
      component: (
        <div className="space-y-6">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setHasCalorieGoal(true);
                if (!form.getValues("calorieGoal")) form.setValue("calorieGoal", 2000);
              }}
              className={`w-full px-4 py-3 rounded-lg border text-left text-sm font-medium transition-all ${
                hasCalorieGoal === true
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              Yes, I have a calorie goal
            </button>
            <button
              type="button"
              onClick={() => {
                setHasCalorieGoal(false);
                form.setValue("calorieGoal", null);
              }}
              className={`w-full px-4 py-3 rounded-lg border text-left text-sm font-medium transition-all ${
                hasCalorieGoal === false
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              I don't have one
            </button>
          </div>
          {hasCalorieGoal === true && (
            <FormField
              control={form.control}
              name="calorieGoal"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-medium">Daily calorie target</FormLabel>
                  <FormControl>
                    <NumericInput
                      value={field.value ?? 2000}
                      onChange={(v) => field.onChange(v)}
                      min={500}
                      max={10000}
                      fallback={2000}
                      className="w-32 h-10 px-3 text-center text-lg"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">calories per day</p>
                </FormItem>
              )}
            />
          )}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Want to also track protein, carbs, and fat? Sign up for <span className="font-semibold text-recipal-orange">ReciPal Pro</span> in the app to set personalized macro targets.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const canContinue = currentStep.canContinue ? currentStep.canContinue() : true;

  return (
    // rp-onboard: plain solid gray page (NOT bg-background — the unscoped
    // `.min-h-screen.bg-background.flex.flex-col` layout-shell rule turns that
    // transparent and lets the body bloom through). Card speaks the app's
    // popup-dialog language: white, 24px radius, dialog shadow, orange-tinted
    // header strip, muted footer.
    <div className="rp-onboard min-h-screen bg-[#f2f2f7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <Card className="border-0 bg-white rounded-[24px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.06)]">
          <div className="bg-gradient-to-br from-recipal-orange/10 to-recipal-orange/5 px-6 pt-6 pb-5 border-b">
            <h1 className="text-2xl font-display font-bold text-recipal-deep-green text-center">Welcome to ReciPal</h1>
            <p className="text-sm text-muted-foreground text-center mt-1">Let's personalize your experience</p>
            {/* Progress — same orange-on-#e5e5ea bar as the macro wizard */}
            <div className="relative h-2 rounded-full overflow-hidden mt-4" style={{ background: '#e5e5ea' }}>
              <motion.div
                className="absolute top-0 left-0 h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #ff6300, #ff9500)' }}
                initial={{ width: 0 }}
                animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-xl font-bold text-recipal-deep-green">{currentStep.question}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{currentStep.helper}</p>
                      </div>
                      <div className="pt-4">{currentStep.component}</div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-between border-t bg-muted/50 p-4">
            <Button
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep(s => s - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canContinue}
                className="bg-[#ff6300] hover:bg-[#ff6300]/90 text-white"
              >
                Continue <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => onSubmit()}
                disabled={isPending}
                className="bg-recipal-orange hover:bg-recipal-orange/90 text-white"
              >
                {isPending ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4 mr-2" />}
                Complete Setup
              </Button>
            )}
          </CardFooter>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Step {step + 1} of {steps.length} · You can update these anytime in Settings.
        </p>
      </div>
    </div>
  );
}
