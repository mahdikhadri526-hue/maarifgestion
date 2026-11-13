import { describe, expect, it, vi } from "vitest";
import { buildGlaceStockDetails, sumGlaceStockDetails } from "@/lib/glaceStockAggregate";
vi.mock("@/lib/stockData", () => ({ roundStockQuantity: (n: number) => Math.round(n * 1000) / 1000 }));
const row = (article: string, day_of_week: string, stock_initial: number | null, entrees = 0, sorties: number | null = null, row_index = 0) =>
  ({ article, week_start: "2026-11-09", day_of_week, stock_initial, entrees, sorties, row_index });
describe("GLACE stock and drill-down share daily bac calculations", () => {
  it("uses next day's count as closing stock and sums all receipt lots before converting kg", () => {
    const rows = buildGlaceStockDetails([row("Vanille", "Lundi", 4, 1), row("Vanille", "Lundi", 999, 2, 999, 1), row("Vanille", "Mardi", 3, 50)], { Vanille: 3555 }, "2026-11-09", "2026-11-09");
    expect(rows[0].bacs).toEqual({ stockInitial: 4, entrees: 3, sorties: 4, stockRestant: 3 });
    expect(sumGlaceStockDetails(rows)).toEqual({ stockInitial: 14.22, entrees: 10.665, sorties: 14.22, stockRestant: 10.665 });
  });
  it("retains sparse flavours rather than using another flavour's latest count date", () => {
    const details = buildGlaceStockDetails([row("Vanille", "Lundi", 4), row("Vanille", "Mardi", 3), row("Chocolat", "Lundi", 2)], { Vanille: 3555, Chocolat: 3696 }, "2026-11-10", "2026-11-10");
    expect(details.find(r => r.name === "Chocolat")?.bacs.stockRestant).toBe(2);
    expect(sumGlaceStockDetails(details).stockRestant).toBeCloseTo(18.057);
  });
  it("includes receipts and explicit outputs after the last count", () => {
    const [detail] = buildGlaceStockDetails([row("Vanille", "Lundi", 4, 2, 1)], { Vanille: 3555 });
    expect(detail.bacs.stockRestant).toBe(5);
  });
  it("reports absent grammage without inventing a conversion and excludes chantilly", () => {
    const details = buildGlaceStockDetails([row("Sicilienne vanille", "Lundi", 2), row("Crème fraîche (mousse fouettée)", "Lundi", 100)], { "Sicilienne vanille": 0, "Crème fraîche (mousse fouettée)": 1000 });
    expect(details).toHaveLength(1);
    expect(details[0].missingGrammage).toBe(true);
    expect(details[0].bacs.stockRestant).toBe(2);
    expect(sumGlaceStockDetails(details).stockRestant).toBe(0);
  });
});