import { describe, expect, it } from "vitest";
import { canDisplayAdminTable } from "./adminTableVisibility";

describe("Recettes et Inventaire: compte admin désigné uniquement", () => {
  it("autorise khadri1982@gmail.com avec rôle admin", () => {
    expect(canDisplayAdminTable("khadri1982@gmail.com", true)).toBe(true);
  });
  it("masque les tables pour gestion-mrmamoun même admin", () => {
    expect(canDisplayAdminTable("gestion-mrmamoun@oliveri.com", true)).toBe(false);
  });
  it("masque les tables pour les autres comptes admin", () => {
    expect(canDisplayAdminTable("other@oliveri.com", true)).toBe(false);
  });
  it("exige le rôle admin du compte désigné", () => {
    expect(canDisplayAdminTable("khadri1982@gmail.com", false)).toBe(false);
  });
});