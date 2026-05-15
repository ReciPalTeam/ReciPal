import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { useChefMe } from "@/hooks/use-chef";
import { useReelComments, useCreateComment, useDeleteComment } from "@/hooks/use-engagements";
import { MessageCircle, Loader2, User as UserIcon, Trash2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reelId: number | null;
  reelChefId: number | null; // To detect if current user owns this reel (can delete any comment).
}

const MAX_COMMENT_LEN = 1000;

export function CommentsSheet({ open, onOpenChange, reelId, reelChefId }: CommentsSheetProps) {
  const { toast } = useToast();
  const { data: user } = useUser();
  const { data: chefData } = useChefMe();
  const myUserId = (user as any)?.id ?? null;
  const isChefOfReel = chefData?.profile?.id === reelChefId;

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useReelComments(
    open ? reelId : null,
  );
  const createComment = useCreateComment(reelId);
  const deleteComment = useDeleteComment(reelId);

  const [body, setBody] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset compose box when reel changes / sheet opens fresh.
  useEffect(() => {
    if (open) setBody("");
  }, [open, reelId]);

  // Infinite scroll for older comments.
  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { root, threshold: 0.1 });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data?.pages.length]);

  const comments = data?.pages.flatMap((p) => p.comments) ?? [];

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_COMMENT_LEN) {
      toast({ title: "Comment too long", variant: "destructive" });
      return;
    }
    setBody(""); // Clear immediately (optimistic).
    try {
      await createComment.mutateAsync(trimmed);
    } catch (err: any) {
      toast({ title: "Couldn't post comment", description: err?.message ?? "", variant: "destructive" });
      setBody(trimmed); // Restore so the user can retry without retyping.
    }
  };

  const handleDelete = async (commentId: number) => {
    try {
      await deleteComment.mutateAsync(commentId);
    } catch (err: any) {
      toast({ title: "Couldn't delete", description: err?.message ?? "", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md w-full p-0 overflow-hidden gap-0 max-h-[85vh] flex flex-col"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        }}
      >
        <div className="bg-gradient-to-br from-recipal-orange/10 to-recipal-orange/5 px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-recipal-orange" />
            <DialogTitle className="text-base font-bold text-recipal-deep-green dark:text-foreground">
              Comments
            </DialogTitle>
            {comments.length > 0 && (
              <span className="text-xs text-muted-foreground">({comments.length})</span>
            )}
          </div>
        </div>

        {/* Comment list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 px-6">
              <MessageCircle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Be the first</p>
              <p className="text-xs text-muted-foreground mt-1">
                Drop a comment to start the conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => {
                const canDelete = myUserId === c.userId || isChefOfReel;
                const isOptimistic = c.id < 0;
                const display = c.displayName || c.username?.split("@")[0] || "user";
                return (
                  <div key={c.id} className="flex items-start gap-2.5" data-testid={`comment-${c.id}`}>
                    <div className="w-8 h-8 rounded-full bg-recipal-orange/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={display} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-recipal-orange" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold truncate">{display}</span>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {isOptimistic ? "now" : formatDistanceToNow(new Date(c.createdAt), { addSuffix: false })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words leading-snug">{c.body}</p>
                    </div>
                    {canDelete && !isOptimistic && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                        data-testid={`button-delete-comment-${c.id}`}
                        aria-label="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {hasNextPage && (
                <div ref={sentinelRef} className="h-px" data-testid="sentinel-comments" />
              )}
              {isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compose box */}
        <div className="border-t px-3 py-2.5 flex items-end gap-2 bg-background">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            maxLength={MAX_COMMENT_LEN}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="resize-none min-h-[40px] max-h-[120px] text-sm py-2"
            data-testid="input-comment-body"
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!body.trim() || createComment.isPending}
            className="bg-recipal-orange hover:bg-recipal-orange/90 text-white flex-shrink-0"
            data-testid="button-send-comment"
            aria-label="Post comment"
          >
            {createComment.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
