import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number; // 0–5, supports decimals like 4.8
  size?: "sm" | "md";
  className?: string;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function StarRating({ rating, size = "sm", className = "", interactive = false, onChange }: StarRatingProps) {
  const iconSize = size === "sm" ? "w-4 h-4" : "w-[26px] h-[26px]";

  return (
    <div className={`flex items-center gap-[1px] ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - (star - 1)));

        if (interactive) {
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange?.(star)}
              className="transition-colors hover:scale-110"
            >
              <Star
                className={`${iconSize} ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                fill={star <= rating ? 'currentColor' : 'none'}
                strokeWidth={1.5}
              />
            </button>
          );
        }

        if (fill >= 1) {
          return (
            <Star
              key={star}
              className={`${iconSize} text-yellow-400 fill-yellow-400 filled`}
            />
          );
        }

        if (fill > 0) {
          return (
            <span key={star} className={`relative inline-flex ${iconSize}`}>
              <Star className={`${iconSize} text-gray-300 absolute inset-0`} />
              <Star
                className={`${iconSize} text-yellow-400 fill-yellow-400 filled absolute inset-0`}
                style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
              />
            </span>
          );
        }

        return (
          <Star key={star} className={`${iconSize} text-gray-300`} />
        );
      })}
    </div>
  );
}
