import { describe, expect, it } from "vitest";
import { stockReferenceQuantity } from "@/lib/stockReference";

describe("Stock restant reference quantities", () => {
  it("converts total outputs with the existing reference factor", () => {
    expect(stockReferenceQuantity(25, "0.116")).toBe(2.9);
  });
  it("converts mise en place without changing its source quantity", () => {
    expect(stockReferenceQuantity(12, "0.116")).toBe(1.39);
  });
  it("converts total stock including mise en place", () => {
    expect(stockReferenceQuantity(20 + 12, "0.116")).toBe(3.71);
  });
  it("preserves zero and negative quantities", () => {
    expect(stockReferenceQuantity(0, "24")).toBe(0);
    expect(stockReferenceQuantity(-3, "24")).toBe(-72);
  });
  it("does not invent a conversion when it is missing or zero", () => {
    expect(stockReferenceQuantity(12, "")).toBeNull();
    expect(stockReferenceQuantity(12, "0")).toBeNull();
    expect(stockReferenceQuantity(12, "invalid")).toBeNull();
  });
});