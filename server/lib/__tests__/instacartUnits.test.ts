import { describe, it, expect, vi } from "vitest";
import {
  normalizeInstacartUnit,
  canonicalizeInputUnit,
} from "../instacartUnits";

describe("canonicalizeInputUnit", () => {
  it("trims whitespace", () => {
    expect(canonicalizeInputUnit("  cup  ")).toBe("cup");
  });

  it("lowercases input", () => {
    expect(canonicalizeInputUnit("CUP")).toBe("cup");
  });

  it("collapses multiple spaces", () => {
    expect(canonicalizeInputUnit("fl   oz   can")).toBe("fl oz can");
  });

  it("removes trailing punctuation", () => {
    expect(canonicalizeInputUnit("cup.")).toBe("cup");
    expect(canonicalizeInputUnit("oz;")).toBe("oz");
    expect(canonicalizeInputUnit("lb!")).toBe("lb");
  });
});

describe("normalizeInstacartUnit", () => {
  it('"C" → cup (HIGH)', () => {
    const result = normalizeInstacartUnit("C");
    expect(result.normalizedUnit).toBe("cup");
    expect(result.unitType).toBe("volume");
    expect(result.confidence).toBe("HIGH");
  });

  it('"cups" → cup (HIGH)', () => {
    const result = normalizeInstacartUnit("cups");
    expect(result.normalizedUnit).toBe("cup");
    expect(result.unitType).toBe("volume");
    expect(result.confidence).toBe("HIGH");
  });

  it('"mls" → milliliter (HIGH)', () => {
    const result = normalizeInstacartUnit("mls");
    expect(result.normalizedUnit).toBe("milliliter");
    expect(result.unitType).toBe("volume");
    expect(result.confidence).toBe("HIGH");
  });

  it('"gal" → gallon (HIGH)', () => {
    const result = normalizeInstacartUnit("gal");
    expect(result.normalizedUnit).toBe("gallon");
    expect(result.unitType).toBe("volume");
    expect(result.confidence).toBe("HIGH");
  });

  it('"lb" + packaging:"bag" → lb bag (HIGH)', () => {
    const result = normalizeInstacartUnit("lb", { packaging: "bag" });
    expect(result.normalizedUnit).toBe("lb bag");
    expect(result.unitType).toBe("package");
    expect(result.confidence).toBe("HIGH");
  });

  it('"lb" no packaging → pound (MED)', () => {
    const result = normalizeInstacartUnit("lb");
    expect(result.normalizedUnit).toBe("pound");
    expect(result.unitType).toBe("weight");
    expect(result.confidence).toBe("MED");
  });

  it('"oz can" → oz can (HIGH)', () => {
    const result = normalizeInstacartUnit("oz can");
    expect(result.normalizedUnit).toBe("oz can");
    expect(result.unitType).toBe("package");
    expect(result.confidence).toBe("HIGH");
  });

  it('"tbs" → tablespoon (HIGH)', () => {
    const result = normalizeInstacartUnit("tbs");
    expect(result.normalizedUnit).toBe("tablespoon");
    expect(result.unitType).toBe("volume");
    expect(result.confidence).toBe("HIGH");
  });

  it('"tspn" → teaspoon (HIGH)', () => {
    const result = normalizeInstacartUnit("tspn");
    expect(result.normalizedUnit).toBe("teaspoon");
    expect(result.unitType).toBe("volume");
    expect(result.confidence).toBe("HIGH");
  });

  it('"pinch" → null (LOW) + telemetry log', () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = normalizeInstacartUnit("pinch");
    expect(result.normalizedUnit).toBeNull();
    expect(result.unitType).toBeNull();
    expect(result.confidence).toBe("LOW");
    expect(result.reason).toContain("pinch");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("Unknown Instacart unit encountered");
    expect(warnSpy.mock.calls[0][0]).toContain("pinch");

    warnSpy.mockRestore();
  });

  it('"oz" no packaging → ounce (MED)', () => {
    const result = normalizeInstacartUnit("oz");
    expect(result.normalizedUnit).toBe("ounce");
    expect(result.unitType).toBe("weight");
    expect(result.confidence).toBe("MED");
  });

  it('"oz" + packaging:"container" → oz container (HIGH)', () => {
    const result = normalizeInstacartUnit("oz", { packaging: "container" });
    expect(result.normalizedUnit).toBe("oz container");
    expect(result.unitType).toBe("package");
    expect(result.confidence).toBe("HIGH");
  });

  it('"lbs" + packaging:"can" → lb can (HIGH)', () => {
    const result = normalizeInstacartUnit("lbs", { packaging: "can" });
    expect(result.normalizedUnit).toBe("lb can");
    expect(result.unitType).toBe("package");
    expect(result.confidence).toBe("HIGH");
  });

  it("handles whitespace and punctuation in input", () => {
    const result = normalizeInstacartUnit("  Cups. ");
    expect(result.normalizedUnit).toBe("cup");
    expect(result.confidence).toBe("HIGH");
  });
});
