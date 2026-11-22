import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ counts: [] as unknown[], weekly: [] as unknown[], movements: [] as unknown[], products: [{ id: "ali-1", name: "Café" }], initial: { "ali-1": 7 },
  glace: vi.fn(), toppings: vi.fn() }));
vi.mock("@/lib/db", () => ({ supabase: { from: (table: string) => {
  const query = { table, select: () => query, eq: () => query, lt: () => query };
  return query;
} } }));
vi.mock("@/lib/pdvStore", () => ({ requireCurrentPdvId: () => "pdv-a" }));
vi.mock("@/lib/supabasePaginate", () => ({ fetchAllRows: async (query: () => { table: string }) => query().table === "weekly_tracking" ? fixtures.weekly : fixtures.counts }));
vi.mock("@/lib/stockData", () => ({
  getMovements: async () => fixtures.movements, getInitialStocks: async () => fixtures.initial,
  getProductUnits: async () => ({}), getProductUnitConfigs: async () => ({}),
  movementPiecesToDisplay: (qty: number) => qty, getProducts: () => fixtures.products,
  roundStockQuantity: (qty: number) => Math.round(qty * 1000) / 1000,
  movementFlow: (row: { type: string }, qty: number) => ({ e: row.type === "entree" ? qty : 0, s: row.type === "sortie" ? qty : 0 }),
  getGlaceAggregateForRange: fixtures.glace, getToppingsBreakdown: fixtures.toppings,
}));
import { loadPreviousStockTotals, calculateStockTotals, chainWeeklyStockTotals } from "@/lib/stockInitialTotal";
const opening = { product_id: "ali-1", category: "alimentaire" as const, opening_date: "2026-11-22", quantity: 100, performed_by: "Ali" };

describe("Dated total-stock opening carry-forward", () => {
  beforeEach(() => {
    fixtures.products = [{ id: "ali-1", name: "Café" }];
    fixtures.counts = [];
    fixtures.weekly = [];
    fixtures.movements = [
      { productId: "ali-1", type: "sortie", quantity: 20, date: "2026-11-21" },
      { productId: "ali-1", type: "entree", quantity: 15, date: "2026-11-22" },
      { productId: "ali-1", type: "sortie", quantity: 4, date: "2026-11-22" },
      { productId: "ali-1", type: "sortie", quantity: 3, date: "2026-11-23" },
    ];
    vi.clearAllMocks();
  });
  it("replaces the negative carried initial total at the first operation without changing historical movements", async () => {
    const snapshot = structuredClone(fixtures.movements);
    expect((await loadPreviousStockTotals("2026-11-22", {}, "day", []) )["ali-1"]).toBe(-13);
    const totals = await loadPreviousStockTotals("2026-11-22", {}, "day", [opening]);
    expect(totals["ali-1"]).toBe(100);
    expect(calculateStockTotals(totals["ali-1"], 15, 4, 0)).toEqual({ sortiesTotal: 4, stockTotal: 111 });
    expect(fixtures.movements).toEqual(snapshot);
  });
  it("carries the corrected total into the next day rather than replaying old negative balances", async () => {
    expect((await loadPreviousStockTotals("2026-11-23", {}, "day", [opening]))["ali-1"]).toBe(111);
  });
  it("keeps periods preceding the operation unchanged", async () => {
    expect((await loadPreviousStockTotals("2026-11-21", {}, "day", [opening]))["ali-1"]).toBe(7);
  });
  it("carries the new initial total into the next month using only post-opening data", async () => {
    expect((await loadPreviousStockTotals("2026-12-01", {}, "month", [opening]))["ali-1"]).toBe(108);
  });
  it("does not apply another article's opening", async () => {
    expect((await loadPreviousStockTotals("2026-11-22", {}, "day", [{ ...opening, product_id: "emb-1", category: "emballage" }]))["ali-1"]).toBe(-13);
  });
  it("retains a deliberately entered zero even when there is no preceding history", async () => {
    expect((await loadPreviousStockTotals("2026-11-22", {}, "day", [{ ...opening, product_id: "emb-1", category: "emballage", quantity: 0 }]))["emb-1"]).toBe(0);
  });
  it("uses weekly receipts/outputs from the opening date without modifying their counts", () => {
    const rows = [
      { article: "Orange", week_start: "2026-11-16", day_of_week: "Samedi", stock_initial: 7, sorties: 20, entrees: 0 },
      { article: "Orange", week_start: "2026-11-16", day_of_week: "Dimanche", stock_initial: null, sorties: 4, entrees: 15 },
    ];
    const snapshot = structuredClone(rows);
    expect(chainWeeklyStockTotals(rows, ["Orange"], "2026-11-23", [], "ali-1", 0, [], "day", opening)).toBe(111);
    expect(rows).toEqual(snapshot);
  });
  it("replays GLACE only after its opening and preserves the shared outputs", async () => {
    fixtures.products = [{ id: "ali-1", name: "GLACE" }];
    fixtures.glace.mockResolvedValue({ entrees: 15, sorties: 4 });
    expect((await loadPreviousStockTotals("2026-11-23", {}, "day", [opening]))["ali-1"]).toBe(111);
    expect(fixtures.glace).toHaveBeenCalledWith("2026-11-22", "2026-11-22");
  });
});