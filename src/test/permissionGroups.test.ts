import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "@/contexts/AuthContext";

describe("permissions des ajouts récents", () => {
  it("retire les permissions Inventaire proposées sans retirer les droits Recettes et Stock restant", () => {
    const keys = ALL_PERMISSIONS.map(permission => permission.key) as string[];
    expect(keys).not.toContain("view_inventory");
    expect(keys).not.toContain("manage_inventory");
    expect(PERMISSION_GROUPS.flatMap(group => group.keys)).not.toContain("view_inventory");
    expect(keys).toContain("view_recipes");
    expect(keys).toContain("edit_remaining_stock");
  });

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

  it("déclare le droit partagé de modification du stock et des regroupements une seule fois", () => {
    const groups = PERMISSION_GROUPS.filter(group => group.keys.includes("edit_stock"));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe("Stock restant, mise en place & regroupements");
    expect(ALL_PERMISSIONS.filter(permission => permission.key === "edit_stock")).toHaveLength(1);
  });

  it("ne propose que des clés de permissions reconnues", () => {
    const known = new Set<string>(ALL_PERMISSIONS.map(permission => permission.key));
    for (const group of PERMISSION_GROUPS) {
      for (const key of group.keys) expect(known.has(key)).toBe(true);
    }
  });
});