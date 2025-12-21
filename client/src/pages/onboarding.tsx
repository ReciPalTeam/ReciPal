import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserProfileSchema } from "@shared/routes";
import { useCreateProfile } from "@/hooks/use-profile";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Schema refinement for the form specifically
const formSchema = insertUserProfileSchema.extend({
  age: z.coerce.number().min(18),
  height: z.coerce.number().min(100),
  weight: z.coerce.number().min(30),
  mealsPerDay: z.coerce.number().min(1).max(6),
  snacksPerDay: z.coerce.number().min(0).max(4),
  trainingDays: z.coerce.number().min(0).max(7),
  targetCalories: z.coerce.number().default(2000), // Default values computed later
  targetProtein: z.coerce.number().default(150),
  targetCarbs: z.coerce.number().default(200),
  targetFat: z.coerce.number().default(60),
});

type FormData = z.infer<typeof formSchema>;

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [useCustomMacros, setUseCustomMacros] = useState(false);
  const [, setLocation] = useLocation();
  const { mutate: createProfile, isPending } = useCreateProfile();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      goal: "maintain",
      sex: "female",
      activityLevel: "moderate",
      dietaryPreferences: [],
      allergies: [],
      mealsPerDay: 3,
      snacksPerDay: 1,
      trainingDays: 3,
      cookingTime: "normal",
      budgetMode: "normal",
      pantryStaples: ["Salt", "Pepper", "Oil"],
      targetCalories: 2000,
      targetProtein: 150,
      targetCarbs: 200,
      targetFat: 60,
    },
  });

  const watchedProtein = form.watch("targetProtein");
  const watchedCarbs = form.watch("targetCarbs");
  const watchedFat = form.watch("targetFat");
  
  const calculatedCalories = (watchedProtein * 4) + (watchedCarbs * 4) + (watchedFat * 9);

  const onSubmit = (data: FormData) => {
    let finalData;
    
    if (useCustomMacros) {
      finalData = {
        ...data,
        targetCalories: (data.targetProtein * 4) + (data.targetCarbs * 4) + (data.targetFat * 9),
      } as any;
      finalData.useCustomMacros = true;
    } else {
      const bmr = data.sex === "male" 
        ? 10 * data.weight + 6.25 * data.height - 5 * data.age + 5
        : 10 * data.weight + 6.25 * data.height - 5 * data.age - 161;
      
      let activityMultiplier = 1.2;
      if (data.activityLevel === "light") activityMultiplier = 1.375;
      if (data.activityLevel === "moderate") activityMultiplier = 1.55;
      if (data.activityLevel === "active") activityMultiplier = 1.725;
      if (data.activityLevel === "very_active") activityMultiplier = 1.9;

      let tdee = bmr * activityMultiplier;
      
      if (data.goal === "cut") tdee *= 0.80;
      if (data.goal === "bulk") tdee *= 1.15;

      let proteinFactor = 1.0;
      if (data.goal === "cut") proteinFactor = 1.2;
      if (data.goal === "bulk") proteinFactor = 1.1;
      if (data.activityLevel === "active" || data.activityLevel === "very_active") {
        proteinFactor += 0.1;
      }

      finalData = {
        ...data,
        targetCalories: Math.round(tdee),
        targetProtein: Math.round(data.weight * proteinFactor),
        targetFat: Math.round((tdee * 0.20) / 9),
        targetCarbs: Math.round((tdee - (data.weight * proteinFactor * 4) - (tdee * 0.20)) / 4),
      };
    }

    createProfile(finalData, {
      onSuccess: () => {
        toast({ title: "Profile Created!", description: "Let's build your first plan." });
        setLocation("/dashboard");
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const nextStep = async () => {
    const fields = step === 1 
      ? ["age", "height", "weight"] 
      : step === 2 
      ? [] 
      : [];
    
    // Trigger validation for current step fields if needed
    const valid = await form.trigger(fields as any);
    if (valid) setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4 mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-3xl font-display font-bold">Let's get to know you</h1>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Step {step} of 5</span>
          </div>
          <div className="h-1.5 sm:h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        <Card className="border-border shadow-lg">
          <CardContent className="p-4 sm:p-6 md:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <h2 className="text-lg sm:text-xl font-semibold">Basic Stats</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="goal"
                          render={({ field }) => (
                            <FormItem className="col-span-full">
                              <FormLabel>Current Goal</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4"
                                >
                                  {["cut", "maintain", "bulk"].map((goal) => (
                                    <FormItem key={goal}>
                                      <FormControl>
                                        <RadioGroupItem value={goal} className="peer sr-only" />
                                      </FormControl>
                                      <FormLabel className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-3 sm:p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer transition-all">
                                        <span className="capitalize font-bold text-sm sm:text-lg">{goal}</span>
                                      </FormLabel>
                                    </FormItem>
                                  ))}
                                </RadioGroup>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Age</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} className="text-lg" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="sex"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sex</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select sex" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="weight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Weight (lbs)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} className="text-lg" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="height"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Height (cm)</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} className="text-lg" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="activityLevel"
                          render={({ field }) => (
                            <FormItem className="col-span-full">
                              <FormLabel>Activity Level</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select activity" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="sedentary">Sedentary (Office job)</SelectItem>
                                  <SelectItem value="light">Lightly Active (1-2 days/week)</SelectItem>
                                  <SelectItem value="moderate">Moderately Active (3-5 days/week)</SelectItem>
                                  <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                                  <SelectItem value="very_active">Very Active (Physical job)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <h2 className="text-lg sm:text-xl font-semibold">Preferences</h2>
                      <div className="space-y-4 sm:space-y-6">
                        <FormField
                          control={form.control}
                          name="dietaryPreferences"
                          render={() => (
                            <FormItem>
                              <FormLabel className="text-sm sm:text-base">Diet Type</FormLabel>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mt-2">
                                {["Vegetarian", "Vegan", "Keto", "Paleo", "Gluten Free", "Dairy Free"].map((item) => (
                                  <FormField
                                    key={item}
                                    control={form.control}
                                    name="dietaryPreferences"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={item}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(item)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, item])
                                                  : field.onChange(
                                                      field.value?.filter((value) => value !== item)
                                                    )
                                              }}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer">
                                            {item}
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))}
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="allergies"
                          render={() => (
                            <FormItem>
                              <FormLabel className="text-sm sm:text-base">Food Allergies</FormLabel>
                              <p className="text-xs sm:text-sm text-muted-foreground mb-2">Select any ingredients you need to avoid</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mt-2">
                                {["Peanuts", "Tree Nuts", "Dairy", "Eggs", "Soy", "Wheat", "Fish", "Shellfish", "Sesame"].map((item) => (
                                  <FormField
                                    key={item}
                                    control={form.control}
                                    name="allergies"
                                    render={({ field }) => {
                                      return (
                                        <FormItem
                                          key={item}
                                          className="flex flex-row items-center space-x-2 sm:space-x-3 space-y-0 p-2 sm:p-3 border rounded-lg hover-elevate cursor-pointer"
                                        >
                                          <FormControl>
                                            <Checkbox
                                              checked={field.value?.includes(item)}
                                              onCheckedChange={(checked) => {
                                                return checked
                                                  ? field.onChange([...field.value, item])
                                                  : field.onChange(
                                                      field.value?.filter((value) => value !== item)
                                                    )
                                              }}
                                              data-testid={`checkbox-allergy-${item.toLowerCase().replace(' ', '-')}`}
                                            />
                                          </FormControl>
                                          <FormLabel className="font-normal cursor-pointer">
                                            {item}
                                          </FormLabel>
                                        </FormItem>
                                      )
                                    }}
                                  />
                                ))}
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="cookingTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>How much time for cooking?</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select preference" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="quick">Quick (&lt; 30 mins)</SelectItem>
                                  <SelectItem value="normal">Normal (30-60 mins)</SelectItem>
                                  <SelectItem value="elaborate">I love cooking (60+ mins)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <h2 className="text-lg sm:text-xl font-semibold">Habits</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <FormField
                          control={form.control}
                          name="mealsPerDay"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Meals per Day</FormLabel>
                              <FormControl>
                                <Input type="number" min={1} max={6} {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="snacksPerDay"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Snacks per Day</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} max={4} {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="trainingDays"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Training Days / Week</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} max={7} {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <h2 className="text-lg sm:text-xl font-semibold">Budget & Pantry</h2>
                      <div className="space-y-4 sm:space-y-6">
                        <FormField
                          control={form.control}
                          name="budgetMode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Budget Preference</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select budget" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="cheap">Budget Friendly</SelectItem>
                                  <SelectItem value="normal">Standard</SelectItem>
                                  <SelectItem value="premium">Premium</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                          <p>We'll assume you have basic staples like Salt, Pepper, and Oil. You can add more later in your pantry settings.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 5 && (
                    <motion.div
                      key="step5"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <h2 className="text-xl font-semibold">Custom Macros (Optional)</h2>
                      <p className="text-muted-foreground text-sm">
                        We'll calculate your targets based on your stats, but you can override them here if you prefer.
                      </p>
                      
                      <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
                        <Checkbox 
                          id="useCustomMacros" 
                          checked={useCustomMacros}
                          onCheckedChange={(checked) => setUseCustomMacros(checked === true)}
                          data-testid="checkbox-use-custom-macros"
                        />
                        <Label htmlFor="useCustomMacros" className="cursor-pointer">
                          I want to set my own macro targets
                        </Label>
                      </div>

                      {useCustomMacros && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-lg">
                          <FormField
                            control={form.control}
                            name="targetProtein"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Protein (g)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    className="text-lg"
                                    data-testid="input-target-protein"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="targetCarbs"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Carbs (g)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    className="text-lg"
                                    data-testid="input-target-carbs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="targetFat"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fat (g)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field} 
                                    className="text-lg"
                                    data-testid="input-target-fat"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="md:col-span-3 p-4 bg-primary/10 rounded-lg">
                            <p className="text-sm font-medium">
                              Calculated Calories: <span className="text-primary text-lg font-bold">{calculatedCalories}</span> kcal
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              (Protein x 4) + (Carbs x 4) + (Fat x 9)
                            </p>
                          </div>
                        </div>
                      )}

                      {!useCustomMacros && (
                        <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                          <p>Your macros will be calculated based on your stats, goal, and activity level with protein as the priority.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-between pt-6 border-t mt-8">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={prevStep} 
                    disabled={step === 1}
                    className="w-24"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  
                  {step < 5 ? (
                    <Button 
                      type="button" 
                      onClick={nextStep}
                      className="w-24 bg-primary hover:bg-primary/90"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      type="submit" 
                      disabled={isPending}
                      className="bg-primary hover:bg-primary/90 min-w-32"
                    >
                      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Complete Profile"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
