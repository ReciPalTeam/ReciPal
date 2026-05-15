import { Link } from "wouter";
import { ChefHat, Loader2 } from "lucide-react";
import { useSearch } from "@/hooks/use-search";

interface ChefSearchStripProps {
  query: string;
}

/**
 * Horizontal-scroll strip of matching chefs. Renders only when `query` is non-empty AND
 * the search returns at least one chef. Slotted above the recipe tabs when the user has
 * an active search on the Recipes page.
 */
export function ChefSearchStrip({ query }: ChefSearchStripProps) {
  const trimmed = query.trim();
  const { data, isLoading } = useSearch(trimmed, 8);

  if (!trimmed) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching chefs…
      </div>
    );
  }
  const chefs = data?.chefs ?? [];
  if (chefs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Chefs matching "{trimmed}"
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {chefs.map((c) => (
          <Link key={c.id} href={`/chef/${c.handle}`}>
            <div
              className="flex-shrink-0 w-[140px] rounded-xl border bg-card hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
              data-testid={`chef-strip-${c.id}`}
            >
              <div className="aspect-square bg-recipal-orange/10 flex items-center justify-center overflow-hidden">
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full object-cover" />
                ) : (
                  <ChefHat className="w-10 h-10 text-recipal-orange" />
                )}
              </div>
              <div className="px-2.5 py-2">
                <p className="text-sm font-semibold truncate text-recipal-deep-green dark:text-foreground">
                  {c.displayName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">@{c.handle}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
