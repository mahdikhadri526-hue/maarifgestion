import { describe, it, expect } from "vitest";
import { convertForDisplay } from "@/lib/materialDisplayUnits";

describe("material display units", () => {
  it("shows 1.5 kg as 1500 g", () => expect(convertForDisplay(1.5, "KG", "g").value).toBe(1500));
  it("shows 0.33 L as 33 cl", () => expect(convertForDisplay(0.33, "L", "cl").value).toBe(33));
  it("keeps unknown units unchanged", () => expect(convertForDisplay(4, "UA", "g")).toMatchObject({ value: 4, label: "UA" }));
});
