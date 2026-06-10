import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface SidesRadialPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: { Breakfast: boolean; Lunch: boolean; Dinner: boolean }) => void;
  initialSelection?: { Breakfast: boolean; Lunch: boolean; Dinner: boolean };
}

const MEALS = [
  {
    key: "Breakfast" as const,
    label: "BREAKFAST",
    color: { main: "#22c55e", light: "#4ade80", dark: "#16a34a", rgb: "34,197,94" },
    icon: (color: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
    position: { top: "0px", left: "50%", transform: "translateX(-50%)" },
  },
  {
    key: "Lunch" as const,
    label: "LUNCH",
    color: { main: "#3b82f6", light: "#60a5fa", dark: "#2563eb", rgb: "59,130,246" },
    icon: (color: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
      </svg>
    ),
    position: { bottom: "12px", left: "12px" },
  },
  {
    key: "Dinner" as const,
    label: "DINNER",
    color: { main: "#ff6300", light: "#ff8533", dark: "#e55a00", rgb: "255,99,0" },
    icon: (color: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
      </svg>
    ),
    position: { bottom: "12px", right: "12px" },
  },
];

export function SidesRadialPicker({ open, onClose, onConfirm, initialSelection }: SidesRadialPickerProps) {
  const [selected, setSelected] = useState<{ Breakfast: boolean; Lunch: boolean; Dinner: boolean }>(
    initialSelection ?? { Breakfast: false, Lunch: false, Dinner: false }
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(initialSelection ?? { Breakfast: false, Lunch: false, Dinner: false });
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open, initialSelection]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleConfirm = () => {
    setVisible(false);
    setTimeout(() => onConfirm(selected), 250);
  };

  const toggle = (key: "Breakfast" | "Lunch" | "Dinner") => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const anySelected = selected.Breakfast || selected.Lunch || selected.Dinner;

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: visible ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(12px)" : "blur(0px)",
        WebkitBackdropFilter: visible ? "blur(12px)" : "blur(0px)",
        transition: "all 0.3s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid="sides-radial-backdrop"
    >
      <div
        style={{
          width: "340px",
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "28px",
          padding: "32px 24px 28px",
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
          Add Sides To
        </p>
        <p style={{ fontSize: "11px", color: "#999", marginBottom: "24px" }}>
          Tap meals to include auto sides
        </p>

        {/* Radial container */}
        <div style={{ position: "relative", width: "280px", height: "280px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Subtle ring */}
          <div style={{
            position: "absolute",
            width: "230px",
            height: "230px",
            borderRadius: "50%",
            border: "1.5px solid rgba(0,0,0,0.04)",
          }} />

          {MEALS.map((meal) => {
            const isActive = selected[meal.key];
            const c = meal.color;
            return (
              <button
                key={meal.key}
                onClick={() => toggle(meal.key)}
                style={{
                  position: "absolute",
                  ...meal.position,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "none",
                  border: "none",
                  padding: 0,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {/* Flat circle */}
                <div style={{
                  width: "82px",
                  height: "82px",
                  borderRadius: "50%",
                  background: isActive ? `rgba(${c.rgb},0.12)` : "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: isActive ? `2px solid ${c.main}` : "2px solid rgba(0,0,0,0.1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: isActive ? "scale(1.06)" : "scale(1)",
                  transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  position: "relative",
                  zIndex: 2,
                }}>
                  {meal.icon(c.main)}
                  <span style={{
                    fontSize: "8px",
                    fontWeight: 800,
                    color: c.main,
                    marginTop: "3px",
                    letterSpacing: "0.05em",
                  }}>{meal.label}</span>
                </div>

                {/* Check badge */}
                <div style={{
                  position: "absolute",
                  top: "-4px",
                  right: meal.key === "Breakfast" ? "calc(50% - 45px)" : "-4px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: c.main,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? "scale(1)" : "scale(0.5)",
                  transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  zIndex: 3,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </button>
            );
          })}

          {/* Center buttons */}
          <div style={{ display: "flex", gap: "14px", zIndex: 5 }}>
            <button
              onClick={handleClose}
              className="w-12 h-12 rounded-full border-0 cursor-pointer bg-[#ef4444] text-white flex items-center justify-center"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button
              onClick={handleConfirm}
              className={`w-12 h-12 rounded-full border-0 cursor-pointer text-white flex items-center justify-center transition-all duration-300 ${anySelected ? "bg-[#16a34a]" : "bg-[#9ca3af]"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
