import { describe, expect, it } from "vitest";
import { followupFicheKey, visibleFollowups, parseFollowupArticles, validateFollowupName, visibleStockFollowupCategories, type WeeklyFollowup } from "@/lib/weeklyFollowups";

describe("independent weekly followups", () => {
  const row: WeeklyFollowup = { id: "a", pdv_id: "pdv-a", name: "Pâtisserie", active: true, articles: [{ name: "Cake", active: true }] };
  it("removes a followup from display without erasing its articles", () => {
    expect(visibleFollowups([{ ...row, active: false }], "pdv-a")).toEqual([]);
    expect(row.articles).toEqual([{ name: "Cake", active: true }]);
    expect(visibleFollowups([row], "pdv-a")).toEqual([row]);
  });
  it("keeps each PDV independent", () => {
    expect(visibleFollowups([row], "pdv-b")).toEqual([]);
  });
  it("separates new followup records from Tartes and other followups", () => {
    expect(followupFicheKey("a")).toBe("Suivi personnalisé:a");
    expect(followupFicheKey("a")).not.toBe("Mouvement glaces & tartes");
    expect(followupFicheKey("a")).not.toBe(followupFicheKey("b"));
  });
  it("preserves removed article identities for restoration", () => {
    expect(parseFollowupArticles([{ name: "Cake", active: false }])).toEqual([{ name: "Cake", active: false }]);
  });
  it("rejects duplicate names instead of overwriting an existing followup", () => {
    expect(validateFollowupName(" pâtisserie ", ["Pâtisserie"])).not.toBeNull();
    expect(validateFollowupName("Viennoiseries", ["Pâtisserie"])).toBeNull();
  });
  it("hides removed built-in followups in Stock restant and Commande", () => {
    const hidden = new Set(["tarte", "glace"]);
    expect(visibleStockFollowupCategories(false, hidden)).toEqual(["creme", "fruits", "nettoyant"]);
    expect(visibleStockFollowupCategories(true, hidden)).toEqual(["fruits", "nettoyant"]);
  });
  it("keeps unrelated stock categories and other PDV followups unchanged", () => {
    expect(visibleStockFollowupCategories(false, new Set(["materiel"]))).toEqual(["creme", "tarte", "fruits", "glace", "nettoyant"]);
    expect(visibleStockFollowupCategories(true)).toEqual(["tarte", "fruits", "glace", "nettoyant"]);
  });
});