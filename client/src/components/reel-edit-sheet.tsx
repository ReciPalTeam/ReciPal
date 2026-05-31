import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateReel } from "@/hooks/use-reels";
import { useToast } from "@/hooks/use-toast";

interface EditableReel {
  id: number;
  title: string | null;
  description: string | null;
}

/** Phase H.20 — edit a reel's metadata (title + caption). Owner-only; opened from /chef/me Reels tab. */
export function ReelEditSheet({ open, onOpenChange, reel }: { open: boolean; onOpenChange: (o: boolean) => void; reel: EditableReel | null }) {
  const update = useUpdateReel();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (reel) {
      setTitle(reel.title ?? "");
      setDescription(reel.description ?? "");
    }
  }, [reel]);

  const submit = async () => {
    if (!reel) return;
    try {
      await update.mutateAsync({ id: reel.id, title, description });
      toast({ title: "Reel updated" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't save", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Edit reel</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4 max-w-md mx-auto w-full">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
            <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Reel title" data-testid="input-reel-title" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption</label>
            <Textarea value={description} maxLength={2000} rows={4} onChange={(e) => setDescription(e.target.value)} placeholder="Add a caption — use #hashtags to help people find it" data-testid="input-reel-description" />
          </div>
          <Button
            onClick={submit}
            disabled={update.isPending}
            className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white font-bold"
            data-testid="button-save-reel"
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
