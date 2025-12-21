import { useState, useEffect } from "react";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, User, Target, Utensils, Activity, Dumbbell, 
  Edit2, Save, X, RefreshCw, AlertTriangle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COMMON_ALLERGENS = ["Peanuts", "Tree Nuts", "Dairy", "Eggs", "Soy", "Wheat", "Fish", "Shellfish", "Sesame"];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Keto", "Paleo", "Gluten Free", "Dairy Free"];

const macroSchema = z.object({
  targetProtein: z.coerce.number().min(50).max(500),
  targetCarbs: z.coerce.number().min(0).max(800),
  targetFat: z.coerce.number().min(20).max(300),
});

const statsSchema = z.object({
  age: z.coerce.number().min(18).max(120),
  weight: z.coerce.number().min(50).max(500),
  height: z.coerce.number().min(100).max(250),
  goal: z.enum(["cut", "maintain", "bulk"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  trainingDays: z.coerce.number().min(0).max(7),
});

const preferencesSchema = z.object({
  mealsPerDay: z.coerce.number().min(1).max(6),
  snacksPerDay: z.coerce.number().min(0).max(4),
  cookingTime: z.enum(["quick", "normal", "elaborate"]),
  budgetMode: z.enum(["cheap", "normal", "premium"]),
});

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);

  const macroForm = useForm({
    resolver: zodResolver(macroSchema),
    defaultValues: { targetProtein: 150, targetCarbs: 200, targetFat: 60 },
  });

  const statsForm = useForm({
    resolver: zodResolver(statsSchema),
    defaultValues: { age: 30, weight: 150, height: 170, goal: "maintain" as const, activityLevel: "moderate" as const, trainingDays: 3 },
  });

  const prefsForm = useForm({
    resolver: zodResolver(preferencesSchema),
    defaultValues: { mealsPerDay: 3, snacksPerDay: 1, cookingTime: "normal" as const, budgetMode: "normal" as const },
  });

  useEffect(() => {
    if (profile) {
      macroForm.reset({
        targetProtein: profile.targetProtein,
        targetCarbs: profile.targetCarbs,
        targetFat: profile.targetFat,
      });
      statsForm.reset({
        age: profile.age,
        weight: profile.weight,
        height: profile.height,
        goal: profile.goal as any,
        activityLevel: profile.activityLevel as any,
        trainingDays: profile.trainingDays,
      });
      prefsForm.reset({
        mealsPerDay: profile.mealsPerDay,
        snacksPerDay: profile.snacksPerDay,
        cookingTime: profile.cookingTime as any,
        budgetMode: profile.budgetMode as any,
      });
      setSelectedAllergies(profile.allergies || []);
      setSelectedDietary(profile.dietaryPreferences || []);
    }
  }, [profile]);

  const watchedProtein = macroForm.watch("targetProtein");
  const watchedCarbs = macroForm.watch("targetCarbs");
  const watchedFat = macroForm.watch("targetFat");
  const calculatedCalories = (Number(watchedProtein) * 4) + (Number(watchedCarbs) * 4) + (Number(watchedFat) * 9);

  const handleSaveMacros = (data: z.infer<typeof macroSchema>) => {
    updateProfile(data, {
      onSuccess: () => {
        toast({ title: "Macros Updated", description: "Your macro targets have been saved." });
        setEditingSection(null);
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleSaveStats = (data: z.infer<typeof statsSchema>) => {
    updateProfile(data, {
      onSuccess: () => {
        toast({ title: "Stats Updated", description: "Your stats have been saved." });
        setEditingSection(null);
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleSavePreferences = (data: z.infer<typeof preferencesSchema>) => {
    updateProfile(data, {
      onSuccess: () => {
        toast({ title: "Preferences Updated", description: "Your preferences have been saved." });
        setEditingSection(null);
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleSaveAllergies = () => {
    updateProfile({ allergies: selectedAllergies }, {
      onSuccess: () => {
        toast({ title: "Allergies Updated", description: "Your allergies have been saved." });
        setEditingSection(null);
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleSaveDietary = () => {
    updateProfile({ dietaryPreferences: selectedDietary }, {
      onSuccess: () => {
        toast({ title: "Dietary Preferences Updated", description: "Your dietary preferences have been saved." });
        setEditingSection(null);
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleStartNewConsultation = () => {
    setShowConsultationDialog(false);
    setLocation("/onboarding?reconsult=true");
  };

  const toggleAllergy = (allergy: string) => {
    setSelectedAllergies(prev => 
      prev.includes(allergy) ? prev.filter(a => a !== allergy) : [...prev, allergy]
    );
  };

  const toggleDietary = (pref: string) => {
    setSelectedDietary(prev => 
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin w-10 h-10 text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <User className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">No Profile Found</h2>
        <p className="text-muted-foreground">Please complete the onboarding process first.</p>
        <Button onClick={() => setLocation("/onboarding")}>Start Setup</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="text-profile-title">Your Profile</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your health stats and preferences</p>
        </div>
        <Dialog open={showConsultationDialog} onOpenChange={setShowConsultationDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-new-consultation">
              <RefreshCw className="w-4 h-4 mr-2" />
              New Consultation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Consultation?</DialogTitle>
              <DialogDescription>
                This will take you through the setup wizard again. Your current profile will be updated with your new answers.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 p-4 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">Your existing meal plans will remain, but new ones will use your updated preferences.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConsultationDialog(false)}>Cancel</Button>
              <Button onClick={handleStartNewConsultation} data-testid="button-confirm-consultation">
                Start Consultation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Macro Targets */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">Daily Macro Targets</CardTitle>
            </div>
            {editingSection !== "macros" ? (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection("macros")} data-testid="button-edit-macros">
                <Edit2 className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => setEditingSection(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {editingSection === "macros" ? (
              <Form {...macroForm}>
                <form onSubmit={macroForm.handleSubmit(handleSaveMacros)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <FormField
                      control={macroForm.control}
                      name="targetProtein"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Protein (g)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-edit-protein" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={macroForm.control}
                      name="targetCarbs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Carbs (g)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-edit-carbs" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={macroForm.control}
                      name="targetFat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fat (g)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-edit-fat" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium">
                      Calculated Calories: <span className="text-primary text-lg font-bold">{calculatedCalories}</span> kcal
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Calories are automatically calculated from your macros
                    </p>
                  </div>
                  <Button type="submit" disabled={isPending} data-testid="button-save-macros">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Macros
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-secondary rounded-lg">
                  <div className="text-lg sm:text-2xl font-bold font-display text-primary" data-testid="text-calories">{profile.targetCalories}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mt-1">Calories</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-secondary rounded-lg">
                  <div className="text-lg sm:text-2xl font-bold font-display text-green-600 dark:text-green-400" data-testid="text-protein">{profile.targetProtein}g</div>
                  <div className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mt-1">Protein</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-secondary rounded-lg">
                  <div className="text-lg sm:text-2xl font-bold font-display text-blue-600 dark:text-blue-400" data-testid="text-carbs">{profile.targetCarbs}g</div>
                  <div className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mt-1">Carbs</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-secondary rounded-lg">
                  <div className="text-lg sm:text-2xl font-bold font-display text-orange-600 dark:text-orange-400" data-testid="text-fat">{profile.targetFat}g</div>
                  <div className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mt-1">Fat</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">Your Stats</CardTitle>
            </div>
            {editingSection !== "stats" ? (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection("stats")} data-testid="button-edit-stats">
                <Edit2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection(null)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {editingSection === "stats" ? (
              <Form {...statsForm}>
                <form onSubmit={statsForm.handleSubmit(handleSaveStats)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <FormField
                      control={statsForm.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-edit-age" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={statsForm.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight (lbs)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-edit-weight" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={statsForm.control}
                      name="height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Height (cm)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-edit-height" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={statsForm.control}
                      name="trainingDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Training Days/Week</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={7} {...field} data-testid="input-edit-training" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={statsForm.control}
                    name="goal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Goal</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-goal">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cut">Cut (Lose Fat)</SelectItem>
                            <SelectItem value="maintain">Maintain</SelectItem>
                            <SelectItem value="bulk">Bulk (Build Muscle)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={statsForm.control}
                    name="activityLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activity Level</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-activity">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sedentary">Sedentary</SelectItem>
                            <SelectItem value="light">Lightly Active</SelectItem>
                            <SelectItem value="moderate">Moderately Active</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="very_active">Very Active</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isPending} data-testid="button-save-stats">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Stats
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Goal</span>
                  <Badge variant="secondary" className="capitalize">{profile.goal}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Age</span>
                  <span className="font-medium">{profile.age} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight</span>
                  <span className="font-medium">{profile.weight} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Height</span>
                  <span className="font-medium">{profile.height} cm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Activity</span>
                  <span className="font-medium capitalize">{profile.activityLevel.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Training</span>
                  <span className="font-medium">{profile.trainingDays} days/week</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meal Preferences */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">Meal Preferences</CardTitle>
            </div>
            {editingSection !== "prefs" ? (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection("prefs")} data-testid="button-edit-prefs">
                <Edit2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection(null)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {editingSection === "prefs" ? (
              <Form {...prefsForm}>
                <form onSubmit={prefsForm.handleSubmit(handleSavePreferences)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <FormField
                      control={prefsForm.control}
                      name="mealsPerDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meals/Day</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={6} {...field} data-testid="input-edit-meals" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={prefsForm.control}
                      name="snacksPerDay"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Snacks/Day</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} max={4} {...field} data-testid="input-edit-snacks" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={prefsForm.control}
                    name="cookingTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cooking Time</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="quick">Quick (&lt; 30 mins)</SelectItem>
                            <SelectItem value="normal">Normal (30-60 mins)</SelectItem>
                            <SelectItem value="elaborate">Elaborate (60+ mins)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={prefsForm.control}
                    name="budgetMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
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
                  <Button type="submit" disabled={isPending} data-testid="button-save-prefs">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Preferences
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meals/Day</span>
                  <span className="font-medium">{profile.mealsPerDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Snacks/Day</span>
                  <span className="font-medium">{profile.snacksPerDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cooking Time</span>
                  <span className="font-medium capitalize">{profile.cookingTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-medium capitalize">{profile.budgetMode}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allergies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 sm:p-6">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                Food Allergies
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Ingredients to exclude from recipes</CardDescription>
            </div>
            {editingSection !== "allergies" ? (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection("allergies")} data-testid="button-edit-allergies">
                <Edit2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection(null)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {editingSection === "allergies" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMMON_ALLERGENS.map((allergy) => (
                    <div 
                      key={allergy}
                      className={`flex items-center gap-2 p-2 sm:p-3 border rounded-lg cursor-pointer transition-colors text-sm sm:text-base ${
                        selectedAllergies.includes(allergy) ? 'bg-destructive/10 border-destructive' : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleAllergy(allergy)}
                    >
                      <Checkbox 
                        checked={selectedAllergies.includes(allergy)}
                        data-testid={`checkbox-edit-allergy-${allergy.toLowerCase().replace(' ', '-')}`}
                      />
                      <Label className="cursor-pointer">{allergy}</Label>
                    </div>
                  ))}
                </div>
                <Button onClick={handleSaveAllergies} disabled={isPending} data-testid="button-save-allergies">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Allergies
                </Button>
              </div>
            ) : (
              profile.allergies && profile.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.allergies.map((allergy: string) => (
                    <Badge key={allergy} variant="destructive">{allergy}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No allergies specified</p>
              )
            )}
          </CardContent>
        </Card>

        {/* Dietary Preferences */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 sm:p-6">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Dietary Preferences
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Your preferred diet types</CardDescription>
            </div>
            {editingSection !== "dietary" ? (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection("dietary")} data-testid="button-edit-dietary">
                <Edit2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setEditingSection(null)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {editingSection === "dietary" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DIETARY_OPTIONS.map((pref) => (
                    <div 
                      key={pref}
                      className={`flex items-center gap-2 p-2 sm:p-3 border rounded-lg cursor-pointer transition-colors text-sm sm:text-base ${
                        selectedDietary.includes(pref) ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleDietary(pref)}
                    >
                      <Checkbox 
                        checked={selectedDietary.includes(pref)}
                        data-testid={`checkbox-edit-dietary-${pref.toLowerCase().replace(' ', '-')}`}
                      />
                      <Label className="cursor-pointer">{pref}</Label>
                    </div>
                  ))}
                </div>
                <Button onClick={handleSaveDietary} disabled={isPending} data-testid="button-save-dietary">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Dietary Preferences
                </Button>
              </div>
            ) : (
              profile.dietaryPreferences && profile.dietaryPreferences.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.dietaryPreferences.map((pref: string) => (
                    <Badge key={pref} variant="outline">{pref}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No dietary preferences specified</p>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
