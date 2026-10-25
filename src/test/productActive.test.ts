import { afterEach, describe, expect, it, vi } from "vitest";
import { getProducts, isProductActive, setProductCatalog, visibleProductRows, visibleOrderItems } from "@/lib/stockData";
import { setProductActive } from "@/lib/productCatalog";

const state = vi.hoisted(() => ({ pdv: "pdv-a", writes: [] as any[], update: vi.fn(), insert: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/db", () => ({ supabase: { from: (table: string) => ({
  update: (payload: any) => { state.writes.push({ table, payload, pdv: state.pdv }); return { eq: state.eq }; },
  insert: (payload: any) => { state.writes.push({ table, payload, pdv: state.pdv }); return Promise.resolve({ error: null }); },
}) } }));
afterEach(() => { setProductCatalog([]); state.writes = []; vi.clearAllMocks(); });
const row = { id: "row-a", productId: "ali-2", category: "alimentaire" as const, name: "Produit", conditionnement: "24 P", hidden: false, sortOrder: 0 };

describe("product availability without historical changes", () => {
  it("hides inactive rows in movement, history, stock, requisition and lot lists without mutating source data", () => {
    setProductCatalog([{ ...row, active: false }]);
    const rows = [{ productId: "ali-2", quantity: 24 }, { productId: "emb-1", quantity: 16 }];
    expect(visibleProductRows(rows)).toEqual([{ productId: "emb-1", quantity: 16 }]);
    expect(rows).toEqual([{ productId: "ali-2", quantity: 24 }, { productId: "emb-1", quantity: 16 }]);
    setProductCatalog([{ ...row, active: true }]);
    expect(visibleProductRows(rows)).toEqual(rows);
  });
  it("hides inactive names in saved orders without modifying saved quantities or unrelated weekly categories", () => {
    setProductCatalog([{ ...row, active: false }]);
    const items = [{ name: "Produit", quantity: 24 }, { name: "Orange", quantity: 6 }];
    expect(visibleOrderItems(items, "alimentaire")).toEqual([{ name: "Orange", quantity: 6 }]);
    expect(visibleOrderItems(items, "tarte")).toEqual(items);
    expect(items[0].quantity).toBe(24);
  });
  it("keeps inactive products in the full catalogue used by stock calculations", () => {
    setProductCatalog([{ ...row, active: true }]);
    const before = getProducts();
    setProductCatalog([{ ...row, active: false }]);
    expect(isProductActive("ali-2")).toBe(false);
    expect(getProducts()).toEqual(before);
  });
  it("writes only active on an existing product and can reactivate it", async () => {
    state.eq.mockResolvedValue({ error: null });
    setProductCatalog([{ ...row, active: true }]);
    await setProductActive("ali-2", false);
    await setProductActive("ali-2", true);
    expect(state.writes.map(w => w.payload)).toEqual([{ active: false }, { active: true }]);
    expect(state.writes.every(w => w.table === "product_catalog")).toBe(true);
    expect(state.eq).toHaveBeenCalledWith("product_id", "ali-2");
  });
  it("starts default products active and retains their identity when adding availability", async () => {
    const product = getProducts().find(p => p.id === "ali-2");
    expect(isProductActive("ali-2")).toBe(true);
    await setProductActive("ali-2", false);
    expect(state.writes[0].payload).toEqual({ product_id: "ali-2", name: product?.name, category: product?.category, conditionnement: product?.conditionnement ?? "", hidden: false, active: false });
  });
  it("does not carry inactive state into a different PDV catalogue", () => {
    setProductCatalog([{ ...row, active: false }]);
    expect(isProductActive("ali-2")).toBe(false);
    setProductCatalog([{ ...row, id: "row-b", active: true }]);
    expect(isProductActive("ali-2")).toBe(true);
  });
  it("propagates a failed save rather than announcing success", async () => {
    setProductCatalog([row]);
    state.eq.mockResolvedValue({ error: new Error("denied") });
    await expect(setProductActive("ali-2", false)).rejects.toThrow("denied");
  });
});