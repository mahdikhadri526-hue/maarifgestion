import { describe, expect, it } from "vitest";
import { buildWeeklyEntryIndex, weeklyEntryKey } from "@/lib/weeklyEntryIndex";

describe("weekly entry lookup", () => {
  it("preserves all lots, empty editable entries, zero receipts and row ordering", () => {
    const index = buildWeeklyEntryIndex([
      { week_start: "2026-11-16", day_of_week: "Lundi", article: "Panachés", row_index: 2, entrees: 5, lot_number: "lot-b" },
      { week_start: "2026-11-16", day_of_week: "Lundi", article: "Panachés", row_index: 0, entrees: 0 },
      { week_start: "2026-11-16", day_of_week: "Lundi", article: "Panachés", row_index: 1, entrees: "", lot_number: "" },
      { week_start: "2026-11-16", day_of_week: "Lundi", article: "Panachés", row_index: 3, entrees: null, lot_number: "lot-c" },
      { week_start: "2026-11-16", day_of_week: "Lundi", article: "Panachés", row_index: 4, entrees: null, lot_number: null },
    ]);
    expect(index.get(weeklyEntryKey("2026-11-16", "Lundi", "Panachés"))).toEqual([
      { rowIndex: 0, entree: 0, lot: undefined },
      { rowIndex: 1, entree: "", lot: "" },
      { rowIndex: 2, entree: 5, lot: "lot-b" },
      { rowIndex: 3, entree: null, lot: "lot-c" },
    ]);
  });

  it("keeps articles, weeks and days independent without rescanning source rows", () => {
    const rows = [
      { week_start: "2026-11-16", day_of_week: "Lundi", article: "Panachés", entrees: 2 },
      { week_start: "2026-11-09", day_of_week: "Lundi", article: "Panachés", entrees: 3 },
      { week_start: "2026-11-16", day_of_week: "Mardi", article: "Panachés", entrees: 4 },
      { week_start: "2026-11-16", day_of_week: "Lundi", article: "Nougat", entrees: 5 },
    ];
    const index = buildWeeklyEntryIndex(rows);
    rows.length = 0;
    expect(index.size).toBe(4);
    expect(index.get(weeklyEntryKey("2026-11-16", "Lundi", "Panachés"))?.[0].entree).toBe(2);
    expect(index.get(weeklyEntryKey("2026-11-09", "Lundi", "Panachés"))?.[0].entree).toBe(3);
  });
});