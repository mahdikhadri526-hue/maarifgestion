import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn(), single: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/db", () => ({ supabase: { from: database.from } }));
vi.mock("@/lib/pdvStore", () => ({ requireCurrentPdvId: () => "pdv-a" }));
import { canInitializeStockTotal, saveStockTotalOpening, validateStockTotalOpening } from "@/lib/stockTotalOpening";

const options = { variant: "stock", mode: "day", category: "alimentaire", productId: "ali-1", canEditRemaining: true, hasOpening: false };
describe("Total-stock opening permissions", () => {
  it.each(["alimentaire", "emballage"])("allows the first opening for %s", category => {
    expect(canInitializeStockTotal({ ...options, category })).toBe(true);
  });
  it.each(["glace", "tarte", "fruits", "nettoyant"])("does not expose initialization in %s weekly tables", category => {
    expect(canInitializeStockTotal({ ...options, category })).toBe(false);
  });
  it("requires permission to edit remaining stock", () => {
    expect(canInitializeStockTotal({ ...options, canEditRemaining: false })).toBe(false);
  });
  it("is available only once per article", () => {
    expect(canInitializeStockTotal({ ...options, hasOpening: true })).toBe(false);
  });
  it("does not change derived group totals independently", () => {
    expect(canInitializeStockTotal({ ...options, derived: true })).toBe(false);
    expect(canInitializeStockTotal({ ...options, productId: "__group__" })).toBe(false);
  });
  it.each(["day", "all", "month", "period"])("allows Bac 2.5 and food initialization in %s with a date chosen in the dialog", mode => {
    expect(canInitializeStockTotal({ ...options, mode, category: "emballage", productId: "emb-25" })).toBe(true);
    expect(canInitializeStockTotal({ ...options, mode })).toBe(true);
  });
  it("does not add initialization to Commande", () => {
    expect(canInitializeStockTotal({ ...options, variant: "order" })).toBe(false);
  });
});

describe("Opening value validation", () => {
  it("accepts a zero starting stock and decimal kilograms", () => {
    expect(validateStockTotalOpening("0", "Ali", "2026-11-22")).toBe(0);
    expect(validateStockTotalOpening("3,727", "Ali", "2026-11-22")).toBe(3.727);
  });
  it.each(["-1", "", "Infinity", "NaN"])("rejects invalid starting stock %s", value => {
    expect(() => validateStockTotalOpening(value, "Ali", "2026-11-22")).toThrow();
  });
  it("requires the operator's name", () => {
    expect(() => validateStockTotalOpening("10", " ", "2026-11-22")).toThrow();
  });
  it("rejects impossible dates", () => {
    expect(() => validateStockTotalOpening("10", "Ali", "2026-02-30")).toThrow();
  });
});

describe("Immutable opening writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.from.mockReturnValue({ insert: database.insert });
    database.insert.mockReturnValue({ select: database.select });
    database.select.mockReturnValue({ single: database.single });
    database.single.mockResolvedValue({ data: { product_id: "ali-1", quantity: 10 }, error: null });
  });
  const opening = { product_id: "ali-1", category: "alimentaire" as const, opening_date: "2026-11-22", quantity: 10, performed_by: " Ali " };
  it("inserts only into the current PDV opening table without modifying operational records", async () => {
    await saveStockTotalOpening(opening);
    expect(database.from.mock.calls).toEqual([["stock_total_openings"]]);
    expect(database.insert).toHaveBeenCalledWith({ ...opening, performed_by: "Ali", pdv_id: "pdv-a" });
    expect(database.single).toHaveBeenCalledOnce();
  });
  it("never overwrites an existing initial opening", async () => {
    database.single.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(saveStockTotalOpening(opening)).rejects.toThrow("déjà été défini");
  });
  it("surfaces a denied database write instead of claiming success", async () => {
    database.single.mockResolvedValue({ data: null, error: { code: "42501", message: "Denied" } });
    await expect(saveStockTotalOpening(opening)).rejects.toEqual({ code: "42501", message: "Denied" });
  });
});