import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserProfileSchema } from "@shared/schema";
import { useCreateProfile } from "@/hooks/use-profile";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ALLERGIES = ["Peanuts", "Tree nuts", "Shellfish", "Fish", "Dairy", "Eggs", "Soy", "Gluten", "Sesame"];
const DIETARY_REFS = ["None", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "Dairy-free", "Gluten-free", "Low-carb"];
const TOOLS = ["Oven", "Blender", "Food processor", "Air fryer", "Instant Pot", "Stand mixer"];

const wizardSchema = insertUserProfileSchema.extend({
  allergies: z.array(z.string()).default([]),
  dietaryPreferences: z.array(z.string()).default([]),
  cookingComfort: z.enum(["quick", "comfortable", "involved"]),
  costPreference: z.enum(["low", "balanced", "flexible"]),
  missingTools: z.array(z.string()).default([]),
});

type WizardData = z.infer<typeof wizardSchema>;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const { mutate: createProfile, isPending } = useCreateProfile();
  const { toast } = useToast();

  const form = useForm<WizardData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      allergies: [],
      dietaryPreferences: [],
      cookingComfort: "quick",
      costPreference: "balanced",
      missingTools: [],
      // Existing defaults for macro system (moved to Pro/later)
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
      pantryStaples: [],
      targetCalories: 2000,
      targetProtein: 150,
      targetCarbs: 200,
      targetFat: 60,
      subscriptionTier: "free"
    },
  });

  const onSubmit = (data: WizardData) => {
    createProfile(data, {
      onSuccess: () => {
        toast({ title: "Welcome to ReciPal!", description: "Your preferences have been saved." });
        setLocation("/recipes");
      },
    });
  };

  const steps = [
    {
      id: "allergies",
      title: "Food Allergies",
      question: "Do you have any food allergies?",
      helper: "We’ll never recommend recipes that include these ingredients.",
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
                          onCheckedChange={(checked) => {
                            return checked
                              ? field.onChange([...field.value, item])
                              : field.onChange(field.value?.filter((v) => v !== item));
                          }}
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
                          onCheckedChange={(checked) => {
                            return checked
                              ? field.onChange([...field.value, item])
                              : field.onChange(field.value?.filter((v) => v !== item));
                          }}
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
                  <FormControl>
                    <RadioGroupItem value={opt.value} />
                  </FormControl>
                  <FormLabel className="font-normal">{opt.label}</FormLabel>
                </FormItem>
              ))}
            </RadioGroup>
          )}
        />
      ),
    },
    {
      id: "cost",
      title: "Cost Preference",
      question: "When cooking, what matters more to you?",
      helper: "We’ll use this to suggest ingredients and plans that better match your priorities.",
      component: (
        <FormField
          control={form.control}
          name="costPreference"
          render={({ field }) => (
            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-4">
              {[
                { value: "low", label: "Keeping costs low" },
                { value: "balanced", label: "A balance of cost and quality" },
                { value: "flexible", label: "I’m flexible" },
              ].map((opt) => (
                <FormItem key={opt.value} className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <RadioGroupItem value={opt.value} />
                  </FormControl>
                  <FormLabel className="font-normal">{opt.label}</FormLabel>
                </FormItem>
              ))}
            </RadioGroup>
          )}
        />
      ),
    },
    {
      id: "tools",
      title: "Kitchen Tools",
      question: "Are there any kitchen tools you don’t have?",
      helper: "So we don’t recommend recipes you can’t actually make.",
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
                          onCheckedChange={(checked) => {
                            return checked
                              ? field.onChange([...field.value, item])
                              : field.onChange(field.value?.filter((v) => v !== item));
                          }}
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
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-recipal-deep-green">Welcome to ReciPal</h1>
          <p className="text-muted-foreground mt-2">Let's personalize your experience</p>
        </div>

        <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <Card className="border-border shadow-xl">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <h2 className="text-xl font-bold text-recipal-deep-green">{steps[step].question}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{steps[step].helper}</p>
                      </div>
                      <div className="pt-4">{steps[step].component}</div>
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
                className="bg-primary hover:bg-primary/90"
              >
                Continue <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={form.handleSubmit(onSubmit)} 
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
          You can update these preferences anytime in Settings.
        </p>
      </div>
    </div>
  );
}
