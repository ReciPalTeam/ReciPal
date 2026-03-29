import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ScanBarcode, Upload, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isNativeApp, compressImage, pickImageFile } from '@/lib/capacitor-utils';
import { useDemoStore, type FoodGroup } from '@/lib/demo-store';

interface BarcodeProduct {
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodGroup: FoodGroup;
}

type FlowStep = 'idle' | 'scanning' | 'loading' | 'confirm' | 'manual' | 'error';

interface ScanBarcodeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseFatsecretBarcodeResponse(data: any): BarcodeProduct | null {
  const food = data?.food;
  if (!food) return null;

  const name = food.food_name || 'Unknown Product';
  const brand = food.brand_name || '';

  let calories = 0, protein = 0, carbs = 0, fat = 0;
  const servings = food.servings?.serving;
  if (servings) {
    const serving = Array.isArray(servings) ? servings[0] : servings;
    calories = parseFloat(serving.calories) || 0;
    protein = parseFloat(serving.protein) || 0;
    carbs = parseFloat(serving.carbohydrate) || 0;
    fat = parseFloat(serving.fat) || 0;
  }

  const foodGroup = classifyFoodGroup(name, brand);

  return { name, brand, calories, protein, carbs, fat, foodGroup };
}

function classifyFoodGroup(name: string, brand: string): FoodGroup {
  const text = `${name} ${brand}`.toLowerCase();
  if (/meat|chicken|beef|pork|fish|salmon|tuna|shrimp|turkey|bacon|sausage/.test(text)) return 'Meat & Seafood';
  if (/milk|cheese|yogurt|butter|cream|egg/.test(text)) return 'Dairy & Eggs';
  if (/bread|bagel|muffin|roll|bun|tortilla|pita/.test(text)) return 'Bread & Bakery';
  if (/pasta|rice|noodle|quinoa|oat|cereal|grain/.test(text)) return 'Pasta, Rice & Grains';
  if (/frozen|ice cream/.test(text)) return 'Frozen';
  if (/can|jar|soup|sauce|tomato paste|bean/.test(text)) return 'Canned & Jarred';
  if (/spice|seasoning|pepper|salt|herb|cumin|paprika/.test(text)) return 'Spices & Seasonings';
  if (/oil|vinegar|dressing|ketchup|mustard|mayo/.test(text)) return 'Oils, Sauces & Condiments';
  if (/sugar|flour|baking|vanilla|cocoa/.test(text)) return 'Baking & Sweets';
  if (/chip|cracker|nut|snack|popcorn|pretzel/.test(text)) return 'Snacks & Nuts';
  if (/apple|banana|orange|berry|grape|lettuce|tomato|onion|potato|carrot|broccoli|pepper/.test(text)) return 'Produce';
  if (/deli|prepared|ready/.test(text)) return 'Prepared Foods & Deli';
  if (/coffee|tea|juice|soda|beer|wine|liquor|bourbon|vodka|energy drink/.test(text)) return 'Beverages & Alcohol';
  if (/parchment|foil|plastic wrap|skewer|toothpick|twine/.test(text)) return 'Non-Food';
  return 'Spices & Seasonings';
}

export function ScanBarcodeSheet({ open, onOpenChange }: ScanBarcodeSheetProps) {
  const [step, setStep] = useState<FlowStep>('idle');
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { addToPantry } = useDemoStore();

  const resetState = () => {
    setStep('idle');
    setProduct(null);
    setManualBarcode('');
    setErrorMsg('');
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const lookupBarcode = async (digits: string) => {
    setStep('loading');
    try {
      const resp = await fetch(`/api/fatsecret/barcode?barcode=${encodeURIComponent(digits)}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Barcode lookup failed');
      }
      const data = await resp.json();
      const parsed = parseFatsecretBarcodeResponse(data);
      if (!parsed) {
        setErrorMsg("Couldn't identify this product. Try again?");
        setStep('error');
        return;
      }
      setProduct(parsed);
      setStep('confirm');
    } catch (e: any) {
      setErrorMsg(e.message || 'Lookup failed');
      setStep('error');
    }
  };

  const handleScan = async () => {
    if (isNativeApp()) {
      setStep('scanning');
      try {
        const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
        const { barcodes } = await BarcodeScanner.scan();
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          await lookupBarcode(barcodes[0].rawValue);
        } else {
          setErrorMsg('No barcode detected. Try again?');
          setStep('error');
        }
      } catch (e: any) {
        setErrorMsg('Scanner failed. Try uploading an image instead.');
        setStep('manual');
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('loading');
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const imgEl = document.createElement('img');
      const url = URL.createObjectURL(file);
      imgEl.src = url;
      await new Promise<void>((res, rej) => { imgEl.onload = () => res(); imgEl.onerror = () => rej(); });
      const result = await reader.decodeFromImageElement(imgEl);
      URL.revokeObjectURL(url);
      const digits = result.getText();

      if (digits) {
        await lookupBarcode(digits);
      } else {
        setStep('manual');
      }
    } catch {
      setStep('manual');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualSubmit = async () => {
    const digits = manualBarcode.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 14) {
      setErrorMsg('Please enter 8 to 14 digits');
      return;
    }
    await lookupBarcode(digits);
  };

  const handleAddToPantry = () => {
    if (!product) return;
    addToPantry({
      name: product.brand ? `${product.name} (${product.brand})` : product.name,
      foodGroup: product.foodGroup,
      state: 'have',
      source: 'manual',
    });
    toast({ title: 'Added to Pantry', description: `${product.name} has been added.` });
    handleClose(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center">Scan Barcode</SheetTitle>
        </SheetHeader>

        {step === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              {isNativeApp() ? 'Point your camera at a barcode' : 'Upload an image of a barcode'}
            </p>
            <Button onClick={handleScan} className="w-full" data-testid="button-start-scan">
              {isNativeApp() ? (
                <><ScanBarcode className="w-5 h-5 mr-2" /> Open Scanner</>
              ) : (
                <><Upload className="w-5 h-5 mr-2" /> Upload Barcode Image</>
              )}
            </Button>
            <Button variant="outline" onClick={() => setStep('manual')} className="w-full" data-testid="button-manual-barcode">
              Enter barcode manually
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="input-barcode-file"
            />
          </div>
        )}

        {step === 'scanning' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Opening scanner...</p>
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Looking up product...</p>
          </div>
        )}

        {step === 'manual' && (
          <div className="flex flex-col gap-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              {isNativeApp() ? "Couldn't scan? " : "Couldn't decode the barcode? "}
              Enter the digits manually.
            </p>
            <Input
              placeholder="Enter barcode digits (8-14)"
              value={manualBarcode}
              onChange={(e) => { setManualBarcode(e.target.value); setErrorMsg(''); }}
              maxLength={14}
              data-testid="input-manual-barcode"
            />
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { resetState(); }} className="flex-1" data-testid="button-barcode-cancel">
                Cancel
              </Button>
              <Button onClick={handleManualSubmit} className="flex-1" data-testid="button-barcode-submit">
                Look Up
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && product && (
          <div className="flex flex-col gap-4 py-4">
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold text-lg" data-testid="text-product-name">{product.name}</h3>
              {product.brand && <p className="text-sm text-muted-foreground" data-testid="text-product-brand">{product.brand}</p>}
              <div className="grid grid-cols-4 gap-2 mt-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Calories</p>
                  <p className="font-semibold" data-testid="text-product-calories">{Math.round(product.calories)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="font-semibold" data-testid="text-product-protein">{Math.round(product.protein)}g</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="font-semibold" data-testid="text-product-carbs">{Math.round(product.carbs)}g</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="font-semibold" data-testid="text-product-fat">{Math.round(product.fat)}g</p>
                </div>
              </div>
            </div>
            <Button onClick={handleAddToPantry} className="w-full" data-testid="button-confirm-add-pantry">
              <Check className="w-5 h-5 mr-2" /> Add to Pantry
            </Button>
            <Button variant="outline" onClick={resetState} className="w-full" data-testid="button-scan-again">
              Scan Another
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-destructive text-center">{errorMsg}</p>
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => handleClose(false)} className="flex-1" data-testid="button-error-cancel">
                Cancel
              </Button>
              <Button onClick={resetState} className="flex-1" data-testid="button-error-retry">
                Retry
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
