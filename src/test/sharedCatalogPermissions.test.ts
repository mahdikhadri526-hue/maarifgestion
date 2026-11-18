import { describe, expect, it } from "vitest";
import { canDisplayAdminTable } from "@/lib/adminTableVisibility";

describe("Gestion du catalogue partagé", () => {
  it("réserve les modifications de recettes, produits et regroupements à khadri1982@gmail.com admin", () => {
    expect(canDisplayAdminTable("khadri1982@gmail.com", true)).toBe(true);
    expect(canDisplayAdminTable("khadri1982@gmail.com", false)).toBe(false);
  });
  it("refuse les modifications aux autres administrateurs et collaborateurs", () => {
    expect(canDisplayAdminTable("gestion-mrmamoun@oliveri.com", true)).toBe(false);
    expect(canDisplayAdminTable("gestion-mrmamoun@oliveri.com", false)).toBe(false);
  });
});