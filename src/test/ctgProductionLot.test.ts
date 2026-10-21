import { describe, expect, it } from "vitest";
import { getCtgProductionLot } from "@/lib/ctgProductionLot";

describe("automatic CTG production lot", () => {
  it.each(["Cornet", "Tulipe", "Gaufrette"])("provides the production date lot for %s weekly transfers", () => {
    expect(getCtgProductionLot("2026-10-20")).toBe("20.10.2026");
  });
  it("uses the fiche date, not today's date", () => {
    expect(getCtgProductionLot("2026-10-06")).toBe("06.10.2026");
  });
});