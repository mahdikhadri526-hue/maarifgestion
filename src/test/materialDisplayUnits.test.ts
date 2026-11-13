import { describe, it, expect } from "vitest";
import { convertForDisplay, materialUsageDisplay } from "@/lib/materialDisplayUnits";

describe("material display units", () => {
  it("shows 1.5 kg as 1500 g", () => expect(convertForDisplay(1.5, "KG", "g").value).toBe(1500));
  it("shows 0.33 L as 33 cl", () => expect(convertForDisplay(0.33, "L", "cl").value).toBe(33));
  it("keeps unknown units unchanged", () => expect(convertForDisplay(4, "UA", "g")).toMatchObject({ value: 4, label: "UA" }));
  it("uses the exact stock reference unit for actual usage despite a saved display preference", () => {
    expect(materialUsageDisplay("actual", 1.5, "KG", "g")).toMatchObject({ value: 1.5, label: "KG" });
    expect(materialUsageDisplay("actual", 1500, "g", "kg")).toMatchObject({ value: 1500, label: "g" });
    expect(materialUsageDisplay("actual", 12, "pièce", "kg")).toMatchObject({ value: 12, label: "pièce" });
  });
  it("preserves theoretical display conversions without modifying the source value", () => {
    expect(materialUsageDisplay("theo", 1.5, "KG", "g").value).toBe(1500);
    expect(materialUsageDisplay("actual", null, "L", "ml")).toMatchObject({ value: null, label: "L" });
  });
});
