import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clapperboard } from "lucide-react";

interface FabRadialMenuProps {
  open: boolean;
  onClose: () => void;
  onAddPantry: () => void;
  onAddMeal: () => void;
  onUploadReel: () => void;
}

/**
 * Chef-only "+" FAB radial menu. Mirrors the visual language of `SidesRadialPicker`
 * (glass-morphic centred modal, three buttons on a ring, springy open/close) with the
 * locked Phase H.4 spec deltas:
 *   - Three buttons in a triangle: Pantry top, Meal/Recipe bottom-left, Upload Reel bottom-right.
 *   - Centre button is the **red X** only (no confirm). Tapping any option commits + dismisses.
 *   - Circles are larger (~120 px) so the 2-line label sits **inside** under the icon.
 *   - Label color matches the icon stroke color of that button.
 *   - Per the icon-set mockup decision: soup-can (custom SVG) for Pantry, Lucide `Soup`
 *     for Meal/Recipe, Lucide `Clapperboard` for Reel.
 */

const COLORS = {
  pantry: { stroke: "#10b981", rgb: "16,185,129" },     // emerald
  meal:   { stroke: "#ff6300", rgb: "255,99,0" },        // recipal-orange
  reel:   { stroke: "#8b5cf6", rgb: "139,92,246" },      // purple
};

// Custom soup-can SVG (Lucide has no soup-can; this matches its visual weight + 2px stroke).
function SoupCanIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="4" rx="6" ry="1.5" />
      <path d="M6 4v16c0 .83 2.7 1.5 6 1.5s6-.67 6-1.5V4" />
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="15" x2="18" y2="15" />
    </svg>
  );
}

function SoupBowlIcon({ color }: { color: string }) {
  // Lucide `Soup`
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
      <path d="M7 21h10" />
      <path d="M19.5 12 22 6" />
      <path d="M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62" />
      <path d="M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62" />
      <path d="M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62" />
    </svg>
  );
}

export function FabRadialMenu({ open, onClose, onAddPantry, onAddMeal, onUploadReel }: FabRadialMenuProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [open]);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const fire = (action: () => void) => {
    setVisible(false);
    setTimeout(() => { onClose(); action(); }, 250);
  };

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: visible ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(12px)" : "blur(0px)",
        WebkitBackdropFilter: visible ? "blur(12px)" : "blur(0px)",
        transition: "all 0.3s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      data-testid="fab-radial-backdrop"
    >
      <div
        style={{
          width: "360px",
          maxWidth: "calc(100vw - 32px)",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "28px",
          padding: "28px 20px 20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.5)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.9) translateY(20px)",
          transition: "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <p style={{ fontSize: "18px", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em", marginBottom: "2px" }}>
          Quick Add
        </p>
        <p style={{ fontSize: "11px", color: "#999", marginBottom: "20px" }}>
          Tap an option, or X to cancel
        </p>

        <div style={{ position: "relative", width: "300px", height: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Subtle ring */}
          <div style={{
            position: "absolute", width: "240px", height: "240px", borderRadius: "50%",
            border: "1.5px solid rgba(0,0,0,0.04)",
          }} />

          {/* Pantry — top */}
          <RadialButton
            position={{ top: "0px", left: "50%", transform: "translateX(-50%)" }}
            color={COLORS.pantry}
            icon={<SoupCanIcon color={COLORS.pantry.stroke} />}
            label="Add To Pantry"
            onClick={() => fire(onAddPantry)}
            testId="fab-radial-pantry"
          />
          {/* Meal/Recipe — bottom-left */}
          <RadialButton
            position={{ bottom: "12px", left: "12px" }}
            color={COLORS.meal}
            icon={<SoupBowlIcon color={COLORS.meal.stroke} />}
            label="Add Meal / Recipe"
            onClick={() => fire(onAddMeal)}
            testId="fab-radial-meal"
          />
          {/* Upload Reel — bottom-right */}
          <RadialButton
            position={{ bottom: "12px", right: "12px" }}
            color={COLORS.reel}
            icon={<Clapperboard color={COLORS.reel.stroke} strokeWidth={2} size={28} />}
            label="Upload Reel"
            onClick={() => fire(onUploadReel)}
            testId="fab-radial-reel"
          />

          {/* Centre red X */}
          <button
            onClick={close}
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(180deg, #f87171, #ef4444, #dc2626)",
              boxShadow: "0 4px 12px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              transition: "transform 0.2s ease",
              zIndex: 5,
            }}
            data-testid="fab-radial-close"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface RadialButtonProps {
  position: React.CSSProperties;
  color: { stroke: string; rgb: string };
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
}

function RadialButton({ position, color, icon, label, onClick, testId }: RadialButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "absolute",
        ...position,
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: `linear-gradient(145deg, rgba(${color.rgb},0.06), rgba(255,255,255,0.95))`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `2px solid rgba(${color.rgb},0.25)`,
        boxShadow: `0 6px 20px rgba(${color.rgb},0.18), inset 0 1px 0 rgba(255,255,255,0.7)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: "8px 12px",
        transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = `${(position.transform as string ?? "")} scale(1.06)`.trim())}
      onMouseLeave={(e) => (e.currentTarget.style.transform = (position.transform as string ?? ""))}
      data-testid={testId}
    >
      {icon}
      <span
        style={{
          marginTop: "6px",
          fontSize: "12px",
          fontWeight: 800,
          color: color.stroke,
          textAlign: "center",
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          // Constrain text width so longer labels wrap naturally onto a 2nd line.
          maxWidth: "92px",
        }}
      >
        {label}
      </span>
    </button>
  );
}
