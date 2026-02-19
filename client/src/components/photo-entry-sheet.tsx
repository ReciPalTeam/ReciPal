import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, Upload, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isNativeApp, compressImage, pickImageFile } from '@/lib/capacitor-utils';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

interface DetectedFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type FlowStep = 'idle' | 'loading' | 'meal-card' | 'questions' | 'error';

interface PhotoEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseFatsecretImageResponse(data: any): DetectedFood[] {
  const foods: DetectedFood[] = [];
  const recognized = data?.food_response?.food_response_list?.food_response;
  if (!recognized) return foods;

  const items = Array.isArray(recognized) ? recognized : [recognized];
  for (const item of items) {
    const foodData = item?.food;
    if (!foodData) continue;

    let calories = 0, protein = 0, carbs = 0, fat = 0;
    const servings = foodData.servings?.serving;
    if (servings) {
      const serving = Array.isArray(servings) ? servings[0] : servings;
      calories = parseFloat(serving.calories) || 0;
      protein = parseFloat(serving.protein) || 0;
      carbs = parseFloat(serving.carbohydrate) || 0;
      fat = parseFloat(serving.fat) || 0;
    }

    foods.push({
      id: `img-${foodData.food_id || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: foodData.food_name || item.food_entry_name || 'Unknown Food',
      calories,
      protein,
      carbs,
      fat,
    });
  }

  return foods;
}

export function PhotoEntrySheet({ open, onOpenChange }: PhotoEntrySheetProps) {
  const [step, setStep] = useState<FlowStep>('idle');
  const [foods, setFoods] = useState<DetectedFood[]>([]);
  const [fromPantry, setFromPantry] = useState<boolean | null>(null);
  const [saveRecipe, setSaveRecipe] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = () => {
    setStep('idle');
    setFoods([]);
    setFromPantry(null);
    setSaveRecipe(null);
    setErrorMsg('');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const recognizeImage = async (b64: string) => {
    setStep('loading');
    try {
      const resp = await fetch('/api/fatsecret/image-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: b64 }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Image recognition failed');
      }
      const data = await resp.json();
      const detected = parseFatsecretImageResponse(data);
      if (detected.length === 0) {
        setErrorMsg("Couldn't identify any foods. Try again?");
        setStep('error');
        return;
      }
      setFoods(detected);
      setStep('meal-card');
    } catch (e: any) {
      setErrorMsg(e.message || 'Recognition failed');
      setStep('error');
    }
  };

  const handleCapture = async () => {
    if (isNativeApp()) {
      try {
        const { Camera: CapCamera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const image = await CapCamera.getPhoto({
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          quality: 80,
          width: 1024,
          height: 1024,
        });
        if (image.base64String) {
          await recognizeImage(image.base64String);
        } else {
          setErrorMsg('No image captured');
          setStep('error');
        }
      } catch (e: any) {
        setErrorMsg('Camera failed. Try uploading instead.');
        setStep('error');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await compressImage(file, 1024, 0.8);
      await recognizeImage(b64);
    } catch (err: any) {
      setErrorMsg('Failed to process image');
      setStep('error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFood = (id: string) => {
    const updated = foods.filter(f => f.id !== id);
    if (updated.length === 0) {
      setErrorMsg('All items removed. Try again?');
      setStep('error');
      return;
    }
    setFoods(updated);
  };

  const totals = foods.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const handleConfirmMealCard = () => {
    setStep('questions');
  };

  const handleFinalConfirm = async () => {
    setStep('loading');
    try {
      const today = new Date().toISOString().split('T')[0];
      await apiRequest('POST', '/api/consumption-logs', {
        date: today,
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
        recipeId: null,
        recipeName: foods.map(f => f.name).join(', '),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/consumption-logs'] });

      if (saveRecipe) {
        const ingredients = foods.map(f => ({
          food_id: f.id,
          food_name: f.name,
          amount: '1',
          unit: 'serving',
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
        }));

        await apiRequest('POST', '/api/custom-recipes', {
          name: `Photo Meal - ${new Date().toLocaleDateString()}`,
          ingredients,
          totalCalories: Math.round(totals.calories),
          totalProtein: Math.round(totals.protein),
          totalCarbs: Math.round(totals.carbs),
          totalFat: Math.round(totals.fat),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/custom-recipes'] });
      }

      toast({
        title: 'Meal Logged',
        description: `${Math.round(totals.calories)} cal logged${saveRecipe ? ' and saved to My Recipes' : ''}`,
      });

      handleClose(false);
    } catch (e: any) {
      setErrorMsg('Failed to save. Please try again.');
      setStep('error');
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">Photo Entry</SheetTitle>
        </SheetHeader>

        {step === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              {isNativeApp() ? 'Take a photo of your meal' : 'Upload a photo of your meal'}
            </p>
            <Button onClick={handleCapture} className="w-full" data-testid="button-start-photo">
              {isNativeApp() ? (
                <><Camera className="w-5 h-5 mr-2" /> Take Photo</>
              ) : (
                <><Upload className="w-5 h-5 mr-2" /> Upload Photo</>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="input-photo-file"
            />
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Analyzing your meal...</p>
          </div>
        )}

        {step === 'meal-card' && (
          <div className="flex flex-col gap-4 py-4">
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold mb-3">Detected Foods</h3>
              <div className="space-y-2">
                {foods.map((food) => (
                  <div key={food.id} className="flex items-center justify-between p-2 rounded-lg bg-muted" data-testid={`food-item-${food.id}`}>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{food.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(food.calories)} cal | P: {Math.round(food.protein)}g | C: {Math.round(food.carbs)}g | F: {Math.round(food.fat)}g
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFood(food.id)}
                      data-testid={`button-remove-food-${food.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="border-t mt-3 pt-3">
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Calories</p>
                    <p className="font-semibold" data-testid="text-total-calories">{Math.round(totals.calories)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Protein</p>
                    <p className="font-semibold" data-testid="text-total-protein">{Math.round(totals.protein)}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Carbs</p>
                    <p className="font-semibold" data-testid="text-total-carbs">{Math.round(totals.carbs)}g</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Fat</p>
                    <p className="font-semibold" data-testid="text-total-fat">{Math.round(totals.fat)}g</p>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={handleConfirmMealCard} className="w-full" data-testid="button-confirm-meal">
              <Check className="w-5 h-5 mr-2" /> Confirm Meal
            </Button>
            <Button variant="outline" onClick={resetState} className="w-full" data-testid="button-retake-photo">
              Try Again
            </Button>
          </div>
        )}

        {step === 'questions' && (
          <div className="flex flex-col gap-5 py-4">
            <div className="rounded-xl border p-4">
              <p className="font-medium mb-3">Was this made from pantry items?</p>
              <div className="flex gap-2">
                <Button
                  variant={fromPantry === true ? 'default' : 'outline'}
                  onClick={() => setFromPantry(true)}
                  className="flex-1"
                  data-testid="button-pantry-yes"
                >
                  Yes
                </Button>
                <Button
                  variant={fromPantry === false ? 'default' : 'outline'}
                  onClick={() => setFromPantry(false)}
                  className="flex-1"
                  data-testid="button-pantry-no"
                >
                  No
                </Button>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <p className="font-medium mb-3">Save to My Recipes for easy adding later?</p>
              <div className="flex gap-2">
                <Button
                  variant={saveRecipe === true ? 'default' : 'outline'}
                  onClick={() => setSaveRecipe(true)}
                  className="flex-1"
                  data-testid="button-save-recipe-yes"
                >
                  Yes
                </Button>
                <Button
                  variant={saveRecipe === false ? 'default' : 'outline'}
                  onClick={() => setSaveRecipe(false)}
                  className="flex-1"
                  data-testid="button-save-recipe-no"
                >
                  No
                </Button>
              </div>
            </div>

            <Button
              onClick={handleFinalConfirm}
              disabled={fromPantry === null || saveRecipe === null}
              className="w-full"
              data-testid="button-final-confirm"
            >
              <Check className="w-5 h-5 mr-2" /> Log Meal
            </Button>
            <Button variant="outline" onClick={() => setStep('meal-card')} className="w-full" data-testid="button-back-to-meal">
              Back
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-destructive text-center">{errorMsg}</p>
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => handleClose(false)} className="flex-1" data-testid="button-photo-error-cancel">
                Cancel
              </Button>
              <Button onClick={resetState} className="flex-1" data-testid="button-photo-error-retry">
                Retry
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
