import { useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Share2, ChefHat } from 'lucide-react';
import { Recipe } from '@/lib/mock-data';
import { MealType, useDemoStore } from '@/lib/demo-store';
import { StarRating } from './star-rating';
import { LeftoverAssignment } from './leftover-assignment-modal';
import { useToast } from '@/hooks/use-toast';

type CelebrationStep = 'congrats' | 'leftovers' | 'share';

interface CookCelebrationModalProps {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
  cookMealId?: string;
  weekDates: { date: string; label: string }[];
  totalServings?: number; // Total servings from recipe/planner meal
}

export function CookCelebrationModal({
  open,
  onClose,
  recipe,
  cookMealId,
  weekDates,
  totalServings = 1,
}: CookCelebrationModalProps) {
  const [step, setStep] = useState<CelebrationStep>('congrats');
  const [rating, setRating] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { setRecipeRating, addToPlanner } = useDemoStore();

  const handleRatingChange = (value: number) => {
    setRating(value);
    setRecipeRating(recipe.id, value);
    // Also persist to server
    fetch(`/api/recipes/${recipe.id}/rating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: value }),
    }).catch(() => {}); // best-effort
  };

  const handleLeftoverAssign = (assignments: { date: string; mealType: MealType; servings: number }[]) => {
    for (const a of assignments) {
      const dateObj = new Date(a.date);
      const dayOfWeek = dateObj.getDay();
      addToPlanner({
        recipeId: recipe.id,
        dayIndex: dayOfWeek,
        mealType: a.mealType,
        servings: a.servings,
        date: a.date,
        isLeftover: true,
        leftoverServings: a.servings,
      });
    }
    toast({
      title: 'Leftovers assigned!',
      description: `Added to ${assignments.length} day${assignments.length !== 1 ? 's' : ''}`,
    });
    setStep('share');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhotoFile(file);
  };

  const handleShare = async () => {
    // Upload photo if selected
    if (photoFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('photo', photoFile);
        formData.append('recipeId', recipe.id);
        await fetch('/api/meal-photos', { method: 'POST', body: formData });
      } catch {
        // best-effort upload
      }
      setUploading(false);
    }

    // Use Web Share API if available
    const shareUrl = `${window.location.origin}/share/recipe/${recipe.id}`;
    const shareData = {
      title: `I just cooked ${recipe.title} with ReciPal!`,
      text: `Check out this amazing recipe: ${recipe.title}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed — fall back to clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link copied!', description: 'Share this recipe with friends and family' });
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied!', description: 'Share this recipe with friends and family' });
    }

    onClose();
  };

  const handleClose = () => {
    setStep('congrats');
    setRating(0);
    setPhotoFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        {step === 'congrats' && (
          <div className="flex flex-col items-center text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <ChefHat className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Amazing recipe!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You just cooked <span className="font-medium text-foreground">{recipe.title}</span>
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Rate this recipe</p>
              <StarRating value={rating} onChange={handleRatingChange} />
            </div>

            <div className="w-full border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Have any leftovers?</p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                  onClick={() => setStep('leftovers')}
                >
                  Yes
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 font-bold"
                  onClick={() => setStep('share')}
                >
                  No
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'leftovers' && (
          <LeftoverAssignment
            recipe={recipe}
            weekDates={weekDates}
            totalServings={totalServings}
            onAssign={handleLeftoverAssign}
            onSkip={() => setStep('share')}
          />
        )}

        {step === 'share' && (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <h2 className="text-lg font-bold">Share your creation!</h2>
            <p className="text-sm text-muted-foreground">
              Take a photo of your meal and share it with friends
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {photoFile ? (
              <div className="relative w-full max-w-[200px] aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={URL.createObjectURL(photoFile)}
                  alt="Your meal"
                  className="w-full h-full object-cover"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 right-2 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Retake
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </Button>
            )}

            <div className="flex gap-3 w-full pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
              >
                Skip
              </Button>
              <Button
                className="flex-1 bg-[#ff6300] hover:bg-[#ff6300]/90 text-white font-bold gap-2"
                onClick={handleShare}
                disabled={uploading}
              >
                <Share2 className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Share'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
