import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Numeric input that lets users clear and retype freely. Validates on blur. */
export function NumericInput({
  value,
  onChange,
  min = 0,
  max = 99999,
  fallback,
  className,
  "data-testid": testId,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  fallback?: number;
  className?: string;
  "data-testid"?: string;
}) {
  const [raw, setRaw] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Sync from parent when not focused
  if (!focused && raw !== String(value)) {
    setRaw(String(value));
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={focused ? raw : String(value)}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9]/g, '');
        setRaw(v);
        if (v !== '') {
          const num = Math.max(min, Math.min(max, parseInt(v)));
          onChange(num);
        }
      }}
      onFocus={(e) => {
        setFocused(true);
        setRaw(String(value));
        e.target.select();
      }}
      onBlur={() => {
        setFocused(false);
        if (raw === '' || isNaN(parseInt(raw))) {
          const fb = fallback ?? min;
          setRaw(String(fb));
          onChange(fb);
        } else {
          const clamped = Math.max(min, Math.min(max, parseInt(raw)));
          setRaw(String(clamped));
          onChange(clamped);
        }
      }}
      className={className}
      data-testid={testId}
    />
  );
}
