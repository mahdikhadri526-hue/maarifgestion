import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProductCatalogManager } from "@/components/inventory/ProductCatalogManager";
import { updateProductPackOption } from "@/lib/stockData";

const state = vi.hoisted(() => ({ admin: false, update: vi.fn(), eq: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ hasAdminRole: state.admin, can: () => false }) }));
vi.mock("@/lib/db", () => ({ supabase: { from: () => ({ update: state.update }) } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/requestCache", () => ({ cached: vi.fn(), invalidateTables: state.invalidate }));
vi.mock("@/lib/stockData", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/stockData")>();
  return { ...original, getProducts: () => [], getProductCatalog: () => [] };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("existing packaging", () => {
  it("allows an admin to open the editor even without custom product permissions", () => {
    state.admin = true;
    render(<ProductCatalogManager conditionnementOnly />);
    expect(screen.getByRole("button", { name: "Conditionnements" })).toBeEnabled();
  });
  it("does not give a non-admin access to the packaging editor", () => {
    state.admin = false;
    render(<ProductCatalogManager conditionnementOnly />);
    expect(screen.queryByRole("button", { name: "Conditionnements" })).toBeNull();
  });
  it("updates an existing format in place without changing its identity", async () => {
    state.eq.mockResolvedValue({ error: null });
    state.update.mockReturnValue({ eq: state.eq });
    await updateProductPackOption("existing-16", " Paquet de 20 ", 20);
    expect(state.update).toHaveBeenCalledWith({ label: "Paquet de 20", pieces_per_unit: 20 });
    expect(state.eq).toHaveBeenCalledWith("id", "existing-16");
    expect(state.invalidate).toHaveBeenCalledWith(["product_pack_options", "initial_stocks"]);
  });
  it("rejects invalid quantities before writing", async () => {
    await expect(updateProductPackOption("existing-16", "Paquet", NaN)).rejects.toThrow();
    expect(state.update).not.toHaveBeenCalled();
  });
});