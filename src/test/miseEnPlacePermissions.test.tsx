import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useMiseEnPlace } from "@/components/MiseEnPlaceCell";

const state = vi.hoisted(() => ({ allowed: false, save: vi.fn(), error: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ can: (key: string) => key === "edit_remaining_stock" && state.allowed }) }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("@/lib/miseEnPlaceData", () => ({
  weekStartOf: () => "2026-11-16",
  getMiseEnPlaceStocksForWeek: async () => ({ "ali-2": 5 }),
  getMiseEnPlaceStocks: async () => ({ "ali-2": 5 }),
  getPackagingMepInputsForWeek: async () => ({}),
  setMiseEnPlaceStockForWeek: state.save,
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); state.allowed = false; });

describe("permissions de saisie mise en place", () => {
  it("ne change ni la valeur ni les données sans le droit Stock restant", async () => {
    const { result } = renderHook(() => useMiseEnPlace("2026-11-16"));
    await waitFor(() => expect(result.current.map["ali-2"]).toBe(5));
    await act(() => result.current.save("ali-2", 12));
    expect(state.save).not.toHaveBeenCalled();
    expect(result.current.map["ali-2"]).toBe(5);
  });
  it("enregistre une saisie autorisée dans la semaine choisie", async () => {
    state.allowed = true;
    state.save.mockResolvedValue(undefined);
    const { result } = renderHook(() => useMiseEnPlace("2026-11-16"));
    await waitFor(() => expect(result.current.map["ali-2"]).toBe(5));
    await act(() => result.current.save("ali-2", 12));
    expect(state.save).toHaveBeenCalledWith("ali-2", 12, "2026-11-16", undefined);
    expect(result.current.map["ali-2"]).toBe(12);
  });
  it("ne présente pas une saisie refusée comme enregistrée", async () => {
    state.allowed = true;
    state.save.mockRejectedValue(new Error("Permission refusée"));
    const { result } = renderHook(() => useMiseEnPlace("2026-11-16"));
    await waitFor(() => expect(result.current.map["ali-2"]).toBe(5));
    await act(() => result.current.save("ali-2", 12));
    expect(result.current.map["ali-2"]).toBe(5);
    expect(state.error).toHaveBeenCalled();
  });
});