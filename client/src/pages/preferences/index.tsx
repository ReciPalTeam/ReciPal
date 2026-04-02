import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, AlertTriangle, Leaf, ChefHat, Wrench, Globe, Zap, UtensilsCrossed } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements, UserPreferences } from "@/lib/entitlements";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";

const ALLERGIES = ["Peanuts", "Tree Nuts", "Dairy", "Eggs", "Wheat/Gluten", "Soy", "Fish", "Shellfish", "Sesame"];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Pescatarian", "Keto", "Paleo", "Low-Carb", "Low-Sodium", "Halal", "Kosher"];
const COOKING_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'Simple recipes with basic techniques' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Some experience with various cooking methods' },
  { value: 'advanced', label: 'Advanced', desc: 'Comfortable with complex recipes' },
];
const KITCHEN_TOOLS = ["Oven", "Microwave", "Blender", "Food Processor", "Stand Mixer", "Slow Cooker", "Instant Pot", "Air Fryer", "Grill"];

type EditingType = 'allergies' | 'dietary' | 'cooking' | 'tools' | 'language' | 'meal-prep' | null;

export default function PreferencesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { preferences, setUserPreference, entitlement } = useEntitlements();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const isPro = entitlement.isPro;

  const [editingType, setEditingType] = useState<EditingType>(null);
  const [tempValues, setTempValues] = useState<Partial<UserPreferences>>({});
  const [mealPrepValues, setMealPrepValues] = useState({
    preferredServingSize: 1,
    allowLeftovers: false,
    leftoverTolerance: 2,
    maxCookSessionsPerDay: 2,
  });

  const openEditor = (type: EditingType) => {
    if (type === 'allergies') setTempValues({ allergies: [...preferences.allergies] });
    else if (type === 'dietary') setTempValues({ dietaryPreferences: [...preferences.dietaryPreferences] });
    else if (type === 'cooking') setTempValues({ cookingComfort: preferences.cookingComfort });
    else if (type === 'tools') setTempValues({ missingTools: [...preferences.missingTools] });
    else if (type === 'language') setTempValues({ language: preferences.language });
    else if (type === 'meal-prep') {
      setMealPrepValues({
        preferredServingSize: profile?.preferredServingSize ?? 1,
        allowLeftovers: profile?.allowLeftovers ?? false,
        leftoverTolerance: profile?.leftoverTolerance ?? 2,
        maxCookSessionsPerDay: profile?.maxCookSessionsPerDay ?? 2,
      });
    }
    setEditingType(type);
  };

  const handleSave = () => {
    if (editingType === 'allergies' && tempValues.allergies) {
      setUserPreference('allergies', tempValues.allergies);
    } else if (editingType === 'dietary' && tempValues.dietaryPreferences) {
      setUserPreference('dietaryPreferences', tempValues.dietaryPreferences);
    } else if (editingType === 'cooking' && tempValues.cookingComfort) {
      setUserPreference('cookingComfort', tempValues.cookingComfort);
    } else if (editingType === 'tools' && tempValues.missingTools) {
      setUserPreference('missingTools', tempValues.missingTools);
    } else if (editingType === 'language' && tempValues.language) {
      setUserPreference('language', tempValues.language);
    } else if (editingType === 'meal-prep') {
      updateProfile.mutate(mealPrepValues, {
        onSuccess: () => {
          toast({
            title: "Meal prep preferences updated",
            description: "Your changes will be reflected in meal planning.",
          });
          setEditingType(null);
        },
        onError: () => {
          toast({
            title: "Failed to save",
            description: "Could not update meal prep preferences. Please try again.",
            variant: "destructive",
          });
        },
      });
      return;
    }

    toast({
      title: "Preferences updated",
      description: "Your changes will be reflected in recipe recommendations.",
    });
    setEditingType(null);
  };

  const toggleArrayItem = (key: 'allergies' | 'dietaryPreferences' | 'missingTools', item: string) => {
    const current = tempValues[key] || [];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    setTempValues({ ...tempValues, [key]: updated });
  };

  const renderEditDialog = () => {
    if (!editingType) return null;

    let title = "";
    let content: React.ReactNode = null;

    if (editingType === 'allergies') {
      title = "Allergies & Restrictions";
      content = (
        <div className="grid grid-cols-2 gap-2">
          {ALLERGIES.map(allergy => (
            <div key={allergy} className="flex items-center space-x-2">
              <Checkbox
                id={allergy}
                checked={(tempValues.allergies || []).includes(allergy)}
                onCheckedChange={() => toggleArrayItem('allergies', allergy)}
              />
              <Label htmlFor={allergy} className="text-sm">{allergy}</Label>
            </div>
          ))}
        </div>
      );
    } else if (editingType === 'dietary') {
      title = "Dietary Preferences";
      content = (
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_OPTIONS.map(diet => (
            <div key={diet} className="flex items-center space-x-2">
              <Checkbox
                id={diet}
                checked={(tempValues.dietaryPreferences || []).includes(diet)}
                onCheckedChange={() => toggleArrayItem('dietaryPreferences', diet)}
              />
              <Label htmlFor={diet} className="text-sm">{diet}</Label>
            </div>
          ))}
        </div>
      );
    } else if (editingType === 'cooking') {
      title = "Cooking Comfort Level";
      content = (
        <RadioGroup
          value={tempValues.cookingComfort}
          onValueChange={(v) => setTempValues({ cookingComfort: v as UserPreferences['cookingComfort'] })}
        >
          {COOKING_LEVELS.map(level => (
            <div key={level.value} className="flex items-start space-x-3 p-3 border rounded-lg">
              <RadioGroupItem value={level.value} id={level.value} className="mt-1" />
              <Label htmlFor={level.value} className="flex-1 cursor-pointer">
                <div className="font-medium">{level.label}</div>
                <div className="text-sm text-muted-foreground">{level.desc}</div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    } else if (editingType === 'tools') {
      title = "Missing Kitchen Tools";
      content = (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-4">
            Select tools you don't have. We'll avoid recipes that require them.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {KITCHEN_TOOLS.map(tool => (
              <div key={tool} className="flex items-center space-x-2">
                <Checkbox
                  id={tool}
                  checked={(tempValues.missingTools || []).includes(tool)}
                  onCheckedChange={() => toggleArrayItem('missingTools', tool)}
                />
                <Label htmlFor={tool} className="text-sm">{tool}</Label>
              </div>
            ))}
          </div>
        </div>
      );
    } else if (editingType === 'language') {
      title = "Language";
      content = (
        <RadioGroup
          value={tempValues.language}
          onValueChange={(v) => setTempValues({ language: v as 'en' | 'es' })}
        >
          <div className="flex items-center space-x-3 p-3 border rounded-lg">
            <RadioGroupItem value="en" id="en" />
            <Label htmlFor="en" className="flex-1 cursor-pointer">English</Label>
          </div>
          <div className="flex items-center space-x-3 p-3 border rounded-lg">
            <RadioGroupItem value="es" id="es" />
            <Label htmlFor="es" className="flex-1 cursor-pointer">Español</Label>
          </div>
        </RadioGroup>
      );
    } else if (editingType === 'meal-prep') {
      title = "Meal Planning Preferences";
      content = (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Preferred Serving Size</Label>
            <p className="text-xs text-muted-foreground">How many servings do you typically eat per meal?</p>
            <RadioGroup
              value={String(mealPrepValues.preferredServingSize)}
              onValueChange={(v) => setMealPrepValues({ ...mealPrepValues, preferredServingSize: Number(v) })}
              className="flex gap-2"
            >
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="flex items-center space-x-1.5">
                  <RadioGroupItem value={String(n)} id={`serving-${n}`} data-testid={`radio-serving-${n}`} />
                  <Label htmlFor={`serving-${n}`} className="text-sm cursor-pointer">{n}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Allow Leftovers</Label>
                <p className="text-xs text-muted-foreground">Cook extra and eat leftovers to save time</p>
              </div>
              <Switch
                checked={mealPrepValues.allowLeftovers}
                onCheckedChange={(checked) => setMealPrepValues({ ...mealPrepValues, allowLeftovers: checked })}
                data-testid="switch-allow-leftovers"
              />
            </div>
            {mealPrepValues.allowLeftovers && (
              <div className="ml-4 space-y-2 pt-2 border-l-2 pl-4">
                <Label className="text-sm font-medium">Leftover Tolerance</Label>
                <p className="text-xs text-muted-foreground">How many times are you comfortable eating the same meal in one plan?</p>
                <RadioGroup
                  value={String(mealPrepValues.leftoverTolerance)}
                  onValueChange={(v) => setMealPrepValues({ ...mealPrepValues, leftoverTolerance: Number(v) })}
                  className="flex gap-2"
                >
                  {[2, 3, 4].map(n => (
                    <div key={n} className="flex items-center space-x-1.5">
                      <RadioGroupItem value={String(n)} id={`tolerance-${n}`} data-testid={`radio-tolerance-${n}`} />
                      <Label htmlFor={`tolerance-${n}`} className="text-sm cursor-pointer">{n} times</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Max Cook Sessions Per Day</Label>
            <p className="text-xs text-muted-foreground">How many times per day are you willing to cook?</p>
            <RadioGroup
              value={String(mealPrepValues.maxCookSessionsPerDay)}
              onValueChange={(v) => setMealPrepValues({ ...mealPrepValues, maxCookSessionsPerDay: Number(v) })}
              className="flex gap-2"
            >
              {[1, 2, 3].map(n => (
                <div key={n} className="flex items-center space-x-1.5">
                  <RadioGroupItem value={String(n)} id={`cook-${n}`} data-testid={`radio-cook-sessions-${n}`} />
                  <Label htmlFor={`cook-${n}`} className="text-sm cursor-pointer">{n}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      );
    }

    return (
      <Dialog open={!!editingType} onOpenChange={() => setEditingType(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto" style={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {content}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingType(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={editingType === 'meal-prep' && updateProfile.isPending} data-testid="button-save-preferences">
              {editingType === 'meal-prep' && updateProfile.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const getMealPrepSummary = (): string => {
    const serving = profile?.preferredServingSize ?? 1;
    const leftovers = profile?.allowLeftovers ?? false;
    const cookSessions = profile?.maxCookSessionsPerDay ?? 2;
    const parts: string[] = [];
    parts.push(`${serving} serving${serving > 1 ? 's' : ''}`);
    parts.push(leftovers ? 'Leftovers on' : 'No leftovers');
    parts.push(`${cookSessions} cook/day`);
    return parts.join(' · ');
  };

  const IconBox = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <div className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-white flex-shrink-0" style={{ background: color }}>
      {children}
    </div>
  );

  const renderRow = (
    icon: React.ReactNode,
    iconColor: string,
    title: string,
    value: string,
    type: EditingType,
    isLast: boolean = false
  ) => (
    <button
      onClick={() => openEditor(type)}
      className={`w-full flex items-center justify-between px-4 py-3 ${!isLast ? 'border-b border-[#e5e5ea] dark:border-border' : ''}`}
      data-testid={`button-edit-${type}`}
    >
      <div className="flex items-center gap-3">
        <IconBox color={iconColor}>{icon}</IconBox>
        <div className="text-left">
          <span className="text-[15px]">{title}</span>
          <div className="text-[12px] text-muted-foreground">{value}</div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
    </button>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: '#f2f2f7' }}>
      <div className="p-4 pb-2">
        <button
          onClick={() => setLocation("/profile")}
          className="flex items-center gap-1 text-[#ff6300] text-sm font-medium mb-1"
          data-testid="button-back"
        >
          <ChevronLeft className="h-4 w-4" />
          Profile
        </button>
        <h1 className="text-[32px] font-extrabold text-foreground leading-tight">Preferences</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-6">
        {/* Diet & Health */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-1.5">Diet & Health</p>
          <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
            {renderRow(
              <AlertTriangle className="h-4 w-4" />,
              "#ff9500",
              "Allergies & Restrictions",
              preferences.allergies.length > 0 ? preferences.allergies.join(", ") : "None set",
              'allergies'
            )}
            {renderRow(
              <Leaf className="h-4 w-4" />,
              "#34c759",
              "Dietary Preferences",
              preferences.dietaryPreferences.length > 0 ? preferences.dietaryPreferences.join(", ") : "None",
              'dietary',
              true
            )}
          </div>
        </div>

        {/* Cooking Style */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-1.5">Cooking Style</p>
          <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
            {renderRow(
              <ChefHat className="h-4 w-4" />,
              "#ff6300",
              "Cooking Comfort Level",
              COOKING_LEVELS.find(l => l.value === preferences.cookingComfort)?.label || "Intermediate",
              'cooking'
            )}
            {renderRow(
              <Wrench className="h-4 w-4" />,
              "#8e8e93",
              "Missing Kitchen Tools",
              preferences.missingTools.length > 0 ? `${preferences.missingTools.length} tools` : "None",
              'tools',
              true
            )}
          </div>
        </div>

        {/* App Settings */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-1.5">App Settings</p>
          <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
            {renderRow(
              <Globe className="h-4 w-4" />,
              "#007aff",
              "Language",
              preferences.language === 'en' ? "English" : "Español",
              'language',
              true
            )}
          </div>
        </div>

        {/* Meal Planning */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-1.5">
            Meal Planning
          </p>
          {isPro ? (
            <div className="bg-white dark:bg-card rounded-xl overflow-hidden">
              {renderRow(
                <UtensilsCrossed className="h-4 w-4" />,
                "#ff6300",
                "Meal Prep Preferences",
                getMealPrepSummary(),
                'meal-prep',
                true
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-card rounded-xl overflow-hidden px-4 py-3">
              <div className="flex items-center gap-3">
                <IconBox color="#ff6300"><Zap className="h-4 w-4" /></IconBox>
                <div className="flex-1">
                  <p className="text-[13px] text-muted-foreground">Upgrade to Pro to customize serving sizes, leftovers, and cook sessions.</p>
                  <button
                    onClick={() => setLocation("/paywall")}
                    className="text-[#ff6300] text-[13px] font-medium mt-1"
                    data-testid="button-upgrade-meal-prep"
                  >
                    Learn more
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Changes to your preferences will immediately affect recipe recommendations.
        </p>
      </div>

      {renderEditDialog()}
    </div>
  );
}
