import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useShareReel } from "@/hooks/use-engagements";
import { Share2, Link as LinkIcon, MessageSquare, Check, Loader2 } from "lucide-react";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reelId: number | null;
  chefHandle: string | null;
  reelTitle: string | null;
  chefDisplayName: string | null;
}

interface ShareOption {
  method: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  show: boolean;
  iconBg: string;
  iconColor: string;
}

export function ShareSheet({
  open,
  onOpenChange,
  reelId,
  chefHandle,
  reelTitle,
  chefDisplayName,
}: ShareSheetProps) {
  const { toast } = useToast();
  const share = useShareReel();
  const [copied, setCopied] = useState(false);

  // We don't have a dedicated /reels/:id deep link yet — share the chef's page,
  // which lists their reels. (Easy follow-up: add /share/reel/:id.)
  const shareUrl =
    typeof window !== "undefined" && chefHandle
      ? `${window.location.origin}/chef/${chefHandle}`
      : "";
  const shareText = reelTitle
    ? `"${reelTitle}" by ${chefDisplayName ?? "a chef"} on ReciPal`
    : `${chefDisplayName ?? "A chef"} on ReciPal`;

  const recordAndExecute = async (method: string, action: () => Promise<void> | void) => {
    if (!reelId) return;
    try {
      // Fire-and-forget the metric; don't block the share UX on it.
      share.mutate({ reelId, method });
      await action();
    } catch (err: any) {
      // Native share cancellation isn't really an error — only toast for non-cancel errors.
      if (err?.name !== "AbortError") {
        toast({ title: "Share failed", description: err?.message ?? "", variant: "destructive" });
      }
    }
  };

  const handleNativeShare = () =>
    recordAndExecute("native", async () => {
      await navigator.share!({ title: shareText, text: shareText, url: shareUrl });
      onOpenChange(false);
    });

  const handleCopy = () =>
    recordAndExecute("copy", async () => {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: "Link copied" });
      setTimeout(() => setCopied(false), 1500);
      onOpenChange(false);
    });

  const handleSms = () =>
    recordAndExecute("sms", () => {
      const body = `${shareText}\n${shareUrl}`;
      window.location.href = `sms:?&body=${encodeURIComponent(body)}`;
      onOpenChange(false);
    });

  const handleTwitter = () =>
    recordAndExecute("twitter", () => {
      const params = new URLSearchParams({ text: shareText, url: shareUrl });
      window.open(`https://twitter.com/intent/tweet?${params}`, "_blank", "noopener");
      onOpenChange(false);
    });

  const options: (ShareOption & { onClick: () => void })[] = [
    {
      method: "native",
      label: "Share via…",
      Icon: Share2,
      show: typeof navigator !== "undefined" && typeof navigator.share === "function",
      iconBg: "bg-recipal-orange",
      iconColor: "text-white",
      onClick: handleNativeShare,
    },
    {
      method: "copy",
      label: copied ? "Copied!" : "Copy link",
      Icon: copied ? Check : LinkIcon,
      show: true,
      iconBg: "bg-muted",
      iconColor: "text-recipal-deep-green dark:text-foreground",
      onClick: handleCopy,
    },
    {
      method: "sms",
      label: "Text message",
      Icon: MessageSquare,
      show: true,
      iconBg: "bg-green-500",
      iconColor: "text-white",
      onClick: handleSms,
    },
    {
      method: "twitter",
      label: "X / Twitter",
      Icon: Share2, // No dedicated Twitter icon in lucide-react; placeholder.
      show: true,
      iconBg: "bg-black",
      iconColor: "text-white",
      onClick: handleTwitter,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
        <div className="bg-gradient-to-br from-recipal-orange/10 to-recipal-orange/5 px-5 py-4 border-b">
          <DialogTitle className="text-base font-bold text-recipal-deep-green dark:text-foreground">
            Share this reel
          </DialogTitle>
          {chefDisplayName && (
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              From {chefDisplayName}
            </DialogDescription>
          )}
        </div>

        <div className="p-2">
          {options
            .filter((o) => o.show)
            .map(({ method, label, Icon, iconBg, iconColor, onClick }) => (
              <button
                key={method}
                onClick={onClick}
                disabled={share.isPending}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                data-testid={`share-${method}`}
              >
                <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                  {share.isPending && method === "native" ? (
                    <Loader2 className={`w-5 h-5 animate-spin ${iconColor}`} />
                  ) : (
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  )}
                </div>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
