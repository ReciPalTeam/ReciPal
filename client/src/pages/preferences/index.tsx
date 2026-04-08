import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, AlertTriangle, Leaf, ChefHat, Wrench, Globe } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements, UserPreferences } from "@/lib/entitlements";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const ALLERGIES = ["Peanuts", "Tree Nuts", "Dairy", "Eggs", "Wheat/Gluten", "Soy", "Fish", "Shellfish", "Sesame"];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Pescatarian", "Keto", "Paleo", "Low-Carb", "Low-Sodium", "Halal", "Kosher"];
const COOKING_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'Simple recipes with basic techniques' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Some experience with various cooking methods' },
  { value: 'advanced', label: 'Advanced', desc: 'Comfortable with complex recipes' },
];
const KITCHEN_TOOLS = ["Oven", "Microwave", "Blender", "Food Processor", "Stand Mixer", "Slow Cooker", "Instant Pot", "Air Fryer", "Grill"];

type EditingType = 'allergies' | 'dietary' | 'cooking' | 'tools' | 'language' | null;

export default function PreferencesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { preferences, setUserPreference } = useEntitlements();

  const [editingType, setEditingType] = useState<EditingType>(null);
  const [tempValues, setTempValues] = useState<Partial<UserPreferences>>({});

  const openEditor = (type: EditingType) => {
    if (type === 'allergies') setTempValues({ allergies: [...preferences.allergies] });
    else if (type === 'dietary') setTempValues({ dietaryPreferences: [...preferences.dietaryPreferences] });
    else if (type === 'cooking') setTempValues({ cookingComfort: preferences.cookingComfort });
    else if (type === 'tools') setTempValues({ missingTools: [...preferences.missingTools] });
    else if (type === 'language') setTempValues({ language: preferences.language });
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
            <Button onClick={handleSave} data-testid="button-save-preferences">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
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

        <p className="text-xs text-muted-foreground text-center pt-2">
          Changes to your preferences will immediately affect recipe recommendations.
        </p>
      </div>

      {renderEditDialog()}
    </div>
  );
}
