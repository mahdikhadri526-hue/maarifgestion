import { describe, expect, it, vi } from "vitest";
import { buildGlaceStockDetails, sumGlaceStockDetails } from "@/lib/glaceStockAggregate";
import { isWeeklyArticleVisible, type WeeklyArticleSetting } from "@/lib/weeklyArticleSettings";
vi.mock("@/lib/stockData", () => ({ roundStockQuantity: (n: number) => Math.round(n * 1000) / 1000 }));
const row = (article: string, day_of_week: string, stock_initial: number | null, entrees = 0, sorties: number | null = null, row_index = 0) =>
  ({ article, week_start: "2026-11-09", day_of_week, stock_initial, entrees, sorties, row_index });
describe("GLACE stock and drill-down share daily bac calculations", () => {
  it("converts Panachés Tartes counts at exactly 0.750 kg/bac without a flavour weight entry", () => {
    const records = [row("Panachés", "Lundi", 8), row("Panachés", "Mardi", 5)];
    const detail = buildGlaceStockDetails(records, {}, "2026-11-09", "2026-11-09").find(r => r.name === "Panachés");
    expect(detail?.kgPerBac).toBe(0.750);
    expect(detail?.stockInitial).toBe(6);
    expect(detail?.stockRestant).toBe(3.75);
  });
  it("shows Panachés GLACE outputs from its counts while the global total excludes them", () => {
    const records = [row("Panachés", "Lundi", 8, 12, 10), row("Panachés", "Mardi", 5, 20, 9)];
    const original = structuredClone(records);
    const details = buildGlaceStockDetails(records, {}, "2026-11-09", "2026-11-09");
    const detail = details.find(r => r.name === "Panachés");
    expect(detail?.bacs).toEqual({ stockInitial: 8, entrees: 0, sorties: 3, stockRestant: 5 });
    expect(detail?.sorties).toBe(2.25);
    expect(detail?.daily[0].sorties).toBe(3);
    expect(sumGlaceStockDetails(details)).toEqual({ stockInitial: 6, entrees: 0, sorties: 0, stockRestant: 3.75 });
    expect(records).toEqual(original);
  });
  it("shows Panachés outputs from adjacent counts in a month without touching the global total", () => {
    const records = [row("Panachés", "Lundi", 8, 12, 10), row("Panachés", "Mardi", 5, 20, 9)];
    const details = buildGlaceStockDetails(records, {}, "2026-11-01", "2026-11-30");
    const detail = details.find(r => r.name === "Panachés");
    expect(detail?.bacs).toEqual({ stockInitial: 8, entrees: 0, sorties: 3, stockRestant: 5 });
    expect(detail?.daily.reduce((s, day) => s + day.sorties, 0)).toBe(3);
    expect(sumGlaceStockDetails(details).sorties).toBe(0);
  });
  it("carries Panachés last count into a later period and preserves other flavour flows", () => {
    const records = [row("Panachés", "Lundi", 8, 12, 10), row("Vanille", "Mardi", 4, 2, 1)];
    const details = buildGlaceStockDetails(records, { Vanille: 3000 }, "2026-11-10", "2026-11-10");
    expect(details.find(r => r.name === "Panachés")?.bacs).toEqual({ stockInitial: 8, entrees: 0, sorties: 0, stockRestant: 8 });
    expect(sumGlaceStockDetails(details)).toEqual({ stockInitial: 18, entrees: 6, sorties: 3, stockRestant: 21 });
  });
  it("keeps Nougat's 3.727 kg/bac in every stock conversion without rounding the weight to 3.73", () => {
    const records = [row("Nougat", "Lundi", 4, 2, 1)];
    const original = structuredClone(records);
    const [detail] = buildGlaceStockDetails(records, { Nougat: 3727 });
    expect(detail.kgPerBac).toBe(3.727);
    const totals = sumGlaceStockDetails([detail]);
    expect(totals.stockInitial).toBeCloseTo(14.908, 9);
    expect(totals.entrees).toBeCloseTo(7.454, 9);
    expect(totals.sorties).toBe(3.727);
    expect(totals.stockRestant).toBeCloseTo(18.635, 9);
    expect(records).toEqual(original);
  });
  it("recalculates all displayed kilogram columns when kg/bac changes without rewriting bac quantities", () => {
    const records = [row("Nougat", "Lundi", 4, 2, 1)];
    const original = structuredClone(records);
    const [before] = buildGlaceStockDetails(records, { Nougat: 4000 });
    const [after] = buildGlaceStockDetails(records, { Nougat: 4500 });
    expect(sumGlaceStockDetails([before])).toEqual({ stockInitial: 16, entrees: 8, sorties: 4, stockRestant: 20 });
    expect(sumGlaceStockDetails([after])).toEqual({ stockInitial: 18, entrees: 9, sorties: 4.5, stockRestant: 22.5 });
    expect(after.bacs).toEqual(before.bacs);
    expect(records).toEqual(original);
  });
  it("excludes the removed sans sucre 14 kg outputs from GLACE totals without erasing records", () => {
    const records = [row("sans sucre", "Lundi", 0, 14, 4), row("Vanille", "Lundi", 2, 0, 0)];
    const original = structuredClone(records);
    const details = buildGlaceStockDetails(records, { "sans sucre": 3500, Vanille: 3555 });
    const settings: WeeklyArticleSetting[] = [{ pdv_id: "A", category: "glace", article: "sans sucre", active: false }];
    expect(sumGlaceStockDetails(details).sorties).toBe(14);
    const visible = details.filter(row => isWeeklyArticleVisible("A", settings, row.name));
    expect(sumGlaceStockDetails(visible)).toEqual({ stockInitial: 7.11, entrees: 0, sorties: 0, stockRestant: 7.11 });
    expect(sumGlaceStockDetails(details.filter(row => isWeeklyArticleVisible("B", settings, row.name))).sorties).toBe(14);
    expect(sumGlaceStockDetails(details.filter(row => isWeeklyArticleVisible("A", [{ ...settings[0], active: true }], row.name))).sorties).toBe(14);
    expect(records).toEqual(original);
  });
  it("uses next day's count as closing stock and sums all receipt lots before converting kg", () => {
    const rows = buildGlaceStockDetails([row("Vanille", "Lundi", 4, 1), row("Vanille", "Lundi", 999, 2, 999, 1), row("Vanille", "Mardi", 3, 50)], { Vanille: 3555 }, "2026-11-09", "2026-11-09");
    expect(rows[0].bacs).toEqual({ stockInitial: 4, entrees: 3, sorties: 4, stockRestant: 3 });
    const totals = sumGlaceStockDetails(rows);
    expect(totals.stockInitial).toBeCloseTo(14.22, 6);
    expect(totals.entrees).toBeCloseTo(10.665, 6);
    expect(totals.sorties).toBeCloseTo(14.22, 6);
    expect(totals.stockRestant).toBeCloseTo(10.665, 6);
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