const TOKEN_GROUPS: { title: string; tokens: { name: string; variable: string; note?: string }[] }[] = [
  {
    title: "Base",
    tokens: [
      { name: "Background", variable: "--background" },
      { name: "Foreground", variable: "--foreground" },
      { name: "Card", variable: "--card" },
      { name: "Card Foreground", variable: "--card-foreground" },
      { name: "Popover", variable: "--popover" },
      { name: "Popover Foreground", variable: "--popover-foreground" },
      { name: "Primary", variable: "--primary" },
      { name: "Primary Foreground", variable: "--primary-foreground" },
      { name: "Secondary", variable: "--secondary" },
      { name: "Secondary Foreground", variable: "--secondary-foreground" },
      { name: "Muted", variable: "--muted" },
      { name: "Muted Foreground", variable: "--muted-foreground" },
      { name: "Accent", variable: "--accent" },
      { name: "Accent Foreground", variable: "--accent-foreground" },
      { name: "Destructive", variable: "--destructive" },
      { name: "Destructive Foreground", variable: "--destructive-foreground" },
      { name: "Border", variable: "--border" },
      { name: "Input", variable: "--input" },
      { name: "Ring", variable: "--ring" },
    ],
  },
  {
    title: "ReciPal Brand",
    tokens: [
      { name: "Orange", variable: "--recipal-orange", note: "#ff6300" },
      { name: "Deep Green", variable: "--recipal-deep-green", note: "#1c502d" },
      { name: "Primary Green", variable: "--recipal-primary-green", note: "#15803d" },
    ],
  },
  {
    title: "Macro: Protein",
    tokens: [
      { name: "Protein", variable: "--macro-protein", note: "#ff6300" },
      { name: "Protein Light", variable: "--macro-protein-light", note: "#ff8533" },
      { name: "Protein Pale", variable: "--macro-protein-pale", note: "#ffb380" },
      { name: "Protein Dark", variable: "--macro-protein-dark", note: "#e85500" },
    ],
  },
  {
    title: "Macro: Carbs",
    tokens: [
      { name: "Carbs", variable: "--macro-carbs", note: "#2ecc71" },
      { name: "Carbs Dark", variable: "--macro-carbs-dark", note: "#27ae60" },
      { name: "Carbs Light", variable: "--macro-carbs-light", note: "#4ade80" },
      { name: "Carbs Medium", variable: "--macro-carbs-medium", note: "#22c55e" },
      { name: "Carbs Deep", variable: "--macro-carbs-deep", note: "#16a34a" },
    ],
  },
  {
    title: "Macro: Fat",
    tokens: [
      { name: "Fat", variable: "--macro-fat", note: "#3498db" },
      { name: "Fat Dark", variable: "--macro-fat-dark", note: "#2980b9" },
      { name: "Fat Light", variable: "--macro-fat-light", note: "#60a5fa" },
      { name: "Fat Medium", variable: "--macro-fat-medium", note: "#3b82f6" },
      { name: "Fat Deep", variable: "--macro-fat-deep", note: "#2563eb" },
      { name: "Fat Navy", variable: "--macro-fat-navy", note: "#1e3a5f" },
    ],
  },
  {
    title: "Macro: Calories",
    tokens: [
      { name: "Calories", variable: "--macro-calories", note: "#e67e22" },
      { name: "Calories Yellow", variable: "--macro-calories-yellow", note: "#f1c40f" },
      { name: "Calories Dark", variable: "--macro-calories-dark", note: "#d35400" },
      { name: "Calories Amber", variable: "--macro-calories-amber", note: "#ca8a04" },
    ],
  },
  {
    title: "Macro: Vitamins",
    tokens: [
      { name: "Vitamins", variable: "--macro-vitamins", note: "#9b59b6" },
      { name: "Vitamins Dark", variable: "--macro-vitamins-dark", note: "#8e44ad" },
    ],
  },
  {
    title: "Surfaces",
    tokens: [
      { name: "Raised", variable: "--surface-raised", note: "#FDFCFB / #1a1a1a" },
      { name: "Input", variable: "--surface-input", note: "#f1f5f9 / #212121" },
      { name: "Subtle", variable: "--surface-subtle", note: "#f8faf9 / #171717" },
      { name: "Muted", variable: "--surface-muted", note: "#fafafa / #141414" },
      { name: "Hover Green", variable: "--surface-hover-green", note: "#ecfdf5" },
      { name: "Border Subtle", variable: "--border-subtle", note: "#e2e8f0 / #383838" },
    ],
  },
  {
    title: "iOS UI",
    tokens: [
      { name: "Text Primary", variable: "--ios-text-primary", note: "#1c1c1e / #f2f2f2" },
      { name: "Text Secondary", variable: "--ios-text-secondary", note: "#8e8e93" },
      { name: "Chevron", variable: "--ios-chevron", note: "#c7c7cc" },
      { name: "Border", variable: "--ios-border", note: "#e5e5ea" },
      { name: "Destructive", variable: "--ios-destructive", note: "#ff3b30" },
      { name: "Selection Border", variable: "--ios-selection-border", note: "#d1d1d6" },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "Success", variable: "--status-success", note: "#22c55e" },
      { name: "Success Light", variable: "--status-success-light", note: "#4ade80" },
      { name: "Success Dark", variable: "--status-success-dark", note: "#16a34a" },
      { name: "Danger", variable: "--status-danger", note: "#ef4444" },
      { name: "Danger Light", variable: "--status-danger-light", note: "#f87171" },
      { name: "Danger Dark", variable: "--status-danger-dark", note: "#dc2626" },
      { name: "Warning", variable: "--status-warning", note: "#f59e0b" },
    ],
  },
  {
    title: "Text",
    tokens: [
      { name: "Dark", variable: "--text-dark", note: "#1a1a1a / #ededed" },
      { name: "Gray", variable: "--text-gray", note: "#999" },
      { name: "Medium Gray", variable: "--text-medium-gray", note: "#666" },
      { name: "Muted iOS", variable: "--text-muted-ios", note: "#6e6e73" },
      { name: "Warning Dark", variable: "--text-warning-dark", note: "#92400e" },
      { name: "Warning Medium", variable: "--text-warning-medium", note: "#a16207" },
    ],
  },
  {
    title: "CTA",
    tokens: [
      { name: "Green Text", variable: "--cta-green-text", note: "#15803d" },
      { name: "Orange Text", variable: "--cta-orange-text", note: "#d45400" },
      { name: "Instacart", variable: "--cta-instacart", note: "#43b02a" },
      { name: "Instacart Hover", variable: "--cta-instacart-hover", note: "#3a9a24" },
    ],
  },
];

function Swatch({ variable, mode }: { variable: string; mode: "light" | "dark" }) {
  const bg = `hsl(var(${variable}))`;
  return (
    <div className={mode === "dark" ? "dark" : ""}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          background: bg,
          border: "1px solid rgba(128,128,128,0.3)",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

function TokenRow({ token }: { token: { name: string; variable: string; note?: string } }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
      <Swatch variable={token.variable} mode="light" />
      <Swatch variable={token.variable} mode="dark" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{token.name}</div>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#666" }}>{token.variable}</div>
        {token.note && <div style={{ fontSize: 10, color: "#999" }}>{token.note}</div>}
      </div>
    </div>
  );
}

export default function SwatchboardPage() {
  return (
    <div style={{ padding: "16px 16px 100px", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, color: "#1a1a1a" }}>Token Swatchboard</h1>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>
        Each row: <strong>Light</strong> (left) &middot; <strong>Dark</strong> (right) &middot; Variable name
      </p>

      {TOKEN_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "#ff6300",
              borderBottom: "1px solid #e5e5ea",
              paddingBottom: 4,
              marginBottom: 8,
            }}
          >
            {group.title}
          </div>
          {group.tokens.map((token) => (
            <TokenRow key={token.variable} token={token} />
          ))}
        </div>
      ))}
    </div>
  );
}
