import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, Loader2, Plus, X } from "lucide-react";
import { useApplyAsChef } from "@/hooks/use-chef";

interface ChefApplicationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_BIO = 50;
const MAX_BIO = 500;
const MAX_LINKS = 5;

export function ChefApplicationSheet({ open, onOpenChange }: ChefApplicationSheetProps) {
  const { toast } = useToast();
  const apply = useApplyAsChef();

  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<string[]>([""]);

  const resetForm = () => {
    setBio("");
    setLinks([""]);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !apply.isPending) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const handleAddLink = () => {
    if (links.length < MAX_LINKS) setLinks([...links, ""]);
  };

  const handleRemoveLink = (idx: number) => {
    setLinks(links.filter((_, i) => i !== idx));
  };

  const handleLinkChange = (idx: number, value: string) => {
    setLinks(links.map((l, i) => (i === idx ? value : l)));
  };

  const bioLength = bio.trim().length;
  const bioValid = bioLength >= MIN_BIO && bioLength <= MAX_BIO;

  const handleSubmit = async () => {
    if (!bioValid) {
      toast({
        title: "Bio too short",
        description: `Tell us a bit more about yourself (${MIN_BIO}-${MAX_BIO} characters).`,
        variant: "destructive",
      });
      return;
    }
    const cleanedLinks = links
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    try {
      await apply.mutateAsync({ bio: bio.trim(), sampleLinks: cleanedLinks });
      toast({
        title: "Application submitted",
        description: "We'll review it and get back to you. Thanks for applying!",
      });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Couldn't submit application",
        description: err?.message ?? "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
        <div className="bg-gradient-to-br from-recipal-orange/10 to-recipal-orange/5 px-6 pt-6 pb-5 border-b">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-recipal-orange flex items-center justify-center shadow-[0_4px_12px_rgba(255,99,0,0.3)]">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-xl font-bold text-recipal-deep-green dark:text-foreground">
              Apply to be a Chef Creator
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Share short cooking videos with the ReciPal community. We review every application by hand — usually within a few days.
          </DialogDescription>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-sm font-semibold text-foreground mb-1.5 block">
              Tell us about yourself
            </label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What kinds of dishes do you cook? Where did you learn? What makes your content unique?"
              className="min-h-[120px] resize-none"
              maxLength={MAX_BIO}
              data-testid="textarea-chef-bio"
            />
            <div className="flex items-center justify-between mt-1.5 text-[11px]">
              <span className={bioLength < MIN_BIO ? "text-muted-foreground" : "text-green-600 dark:text-green-400"}>
                {bioLength < MIN_BIO ? `${MIN_BIO - bioLength} more characters` : "Looks good"}
              </span>
              <span className="text-muted-foreground">{bioLength} / {MAX_BIO}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-1.5 block">
              Sample work <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Links to existing videos, Instagram, TikTok, YouTube, blog, etc.
            </p>
            <div className="space-y-2">
              {links.map((link, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://..."
                    value={link}
                    onChange={(e) => handleLinkChange(idx, e.target.value)}
                    data-testid={`input-chef-link-${idx}`}
                  />
                  {links.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveLink(idx)}
                      data-testid={`button-remove-link-${idx}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {links.length < MAX_LINKS && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddLink}
                className="mt-2 text-recipal-orange hover:text-recipal-orange hover:bg-recipal-orange/10 gap-1.5"
                data-testid="button-add-link"
              >
                <Plus className="w-4 h-4" /> Add another link
              </Button>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-4 flex items-center justify-end gap-2 bg-muted/30">
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={apply.isPending}
            data-testid="button-cancel-application"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!bioValid || apply.isPending}
            className="bg-recipal-orange hover:bg-recipal-orange/90 text-white gap-2 min-w-[120px]"
            data-testid="button-submit-application"
          >
            {apply.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
