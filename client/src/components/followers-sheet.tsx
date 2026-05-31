import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChefHat, Loader2, User as UserIcon } from "lucide-react";
import { useFollowers, type FollowerUser } from "@/hooks/use-follow";

/** Creator-only bottom sheet listing who follows the current chef. Phase H.17. */
export function FollowersSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const q = useFollowers(open);
  const followers = q.data?.pages.flatMap((p) => p.followers) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] flex flex-col rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Followers</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-2 -mx-2 px-2">
          {q.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : followers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No followers yet.</p>
          ) : (
            <div className="space-y-1">
              {followers.map((f) => <FollowerRow key={f.userId} follower={f} onNavigate={() => onOpenChange(false)} />)}
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

function FollowerRow({ follower, onNavigate }: { follower: FollowerUser; onNavigate: () => void }) {
  const name = follower.displayName || follower.username || "ReciPal user";
  const avatar = (
    <div className="w-10 h-10 rounded-full bg-recipal-orange/15 flex items-center justify-center overflow-hidden flex-shrink-0">
      {follower.avatarUrl ? <img src={follower.avatarUrl} alt={name} className="w-full h-full object-cover" /> : (
        follower.chefHandle ? <ChefHat className="w-5 h-5 text-recipal-orange" /> : <UserIcon className="w-5 h-5 text-recipal-orange" />
      )}
    </div>
  );
  const body = (
    <div className="min-w-0">
      <p className="text-sm font-semibold truncate">{name}</p>
      {follower.chefHandle && <p className="text-[11px] text-muted-foreground truncate">@{follower.chefHandle}</p>}
    </div>
  );
  // Followers who are themselves chefs link to their profile; plain users aren't linkable.
  return follower.chefHandle ? (
    <Link href={`/chef/${follower.chefHandle}`} onClick={onNavigate} className="flex items-center gap-3 py-2" data-testid={`follower-row-${follower.userId}`}>
      {avatar}{body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 py-2" data-testid={`follower-row-${follower.userId}`}>{avatar}{body}</div>
  );
}
