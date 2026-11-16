import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "@/contexts/AuthContext";

describe("permissions des ajouts récents", () => {
  it("expose les écarts ingrédients avec leurs droits existants sans accorder de nouveaux accès", () => {
    const group = PERMISSION_GROUPS.find(group => group.title.startsWith("Écarts ingrédients"));
    expect(group?.keys).toEqual(["view_ecarts", "edit_ecarts"]);
  });

  it("expose les droits existants du stock restant, de la mise en place et des regroupements", () => {
    const group = PERMISSION_GROUPS.find(group => group.title.startsWith("Stock restant"));
    expect(group?.keys).toEqual([
      "view_reports", "edit_stock", "edit_remaining_stock", "toggle_stock_extra_cols", "edit_storage_capacity",
    ]);
  });

  it("ne propose que des clés de permissions reconnues", () => {
    const known = new Set<string>(ALL_PERMISSIONS.map(permission => permission.key));
    for (const group of PERMISSION_GROUPS) {
      for (const key of group.keys) expect(known.has(key)).toBe(true);
    }
  });
});