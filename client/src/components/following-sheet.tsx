import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChefHat, Loader2, UserCheck } from "lucide-react";
import { useFollowing, useToggleFollow, type FollowingChef } from "@/hooks/use-follow";

/** Bottom sheet listing the chefs the current user follows. Phase H.17. */
export function FollowingSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const q = useFollowing(open);
  const chefs = q.data?.pages.flatMap((p) => p.chefs) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] flex flex-col rounded-t-2xl" style={{ background: 'white', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
        <SheetHeader>
          <SheetTitle>Following</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-2 -mx-2 px-2">
          {q.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : chefs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">You're not following any creators yet.</p>
          ) : (
            <div className="space-y-1">
              {chefs.map((c) => <FollowingRow key={c.chefId} chef={c} onNavigate={() => onOpenChange(false)} />)}
              {q.hasNextPage && (
                <Button variant="ghost" className="w-full text-recipal-orange" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                  {q.isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FollowingRow({ chef, onNavigate }: { chef: FollowingChef; onNavigate: () => void }) {
  const toggle = useToggleFollow(chef.chefId, chef.handle);
  // Optimistic local state isn't tracked here; the list refetches on settle. Show "Following" by default.
  return (
    <div className="flex items-center gap-3 py-2" data-testid={`following-row-${chef.handle}`}>
      <Link href={`/chef/${chef.handle}`} onClick={onNavigate} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-recipal-orange/15 flex items-center justify-center overflow-hidden flex-shrink-0">
          {chef.avatarUrl ? <img src={chef.avatarUrl} alt={chef.displayName} className="w-full h-full object-cover" /> : <ChefHat className="w-5 h-5 text-recipal-orange" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{chef.displayName}</p>
          <p className="text-[11px] text-muted-foreground truncate">@{chef.handle}</p>
        </div>
      </Link>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 flex-shrink-0"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(false)}
        data-testid={`unfollow-${chef.handle}`}
      >
        <UserCheck className="w-3.5 h-3.5" /> Following
      </Button>
    </div>
  );
}
