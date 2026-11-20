import { describe, expect, it } from "vitest";
import { hasEffectivePermission, type PermissionState } from "@/lib/effectivePermissions";

const state = (patch: Partial<PermissionState> = {}): PermissionState => ({
  signedIn: true, unrestrictedAdmin: false, individualOnly: false,
  hasCustomPermissions: true, permissions: new Set(["edit_stock"]),
  pdvPermissions: new Set(["edit_remaining_stock", "view_recipes"]),
  pdvDenied: new Set(), ...patch,
});

describe("permissions effectives", () => {
  it("ne déverrouille pas Stock restant avec le droit Stock initial", () => {
    expect(hasEffectivePermission(state(), "edit_stock")).toBe(true);
    expect(hasEffectivePermission(state(), "edit_remaining_stock")).toBe(false);
  });
  it("une case utilisateur décochée n'hérite pas du droit du PDV", () => {
    expect(hasEffectivePermission(state(), "view_recipes")).toBe(false);
  });
  it("une interdiction PDV bloque Stock restant même accordé à l'utilisateur", () => {
    expect(hasEffectivePermission(state({ permissions: new Set(["edit_remaining_stock"]), pdvDenied: new Set(["edit_remaining_stock"]) }), "edit_remaining_stock")).toBe(false);
  });
  it("hérite des droits PDV uniquement sans configuration individuelle", () => {
    expect(hasEffectivePermission(state({ hasCustomPermissions: false, permissions: new Set() }), "view_recipes")).toBe(true);
  });
  it("permet le droit explicitement coché et refuse une session absente", () => {
    expect(hasEffectivePermission(state({ permissions: new Set(["edit_remaining_stock"]) }), "edit_remaining_stock")).toBe(true);
    expect(hasEffectivePermission(state({ signedIn: false, unrestrictedAdmin: true }), "edit_remaining_stock")).toBe(false);
  });
});