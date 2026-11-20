import { describe, expect, it } from "vitest";
import { applyWeeklyArticleSettings, isWeeklyArticleVisible, resolveWeeklyArticles, validateWeeklyArticle, WEEKLY_CATEGORIES, WEEKLY_DEFAULTS, type WeeklyArticleSetting } from "@/lib/weeklyArticleSettings";
import { canDisplayAdminTable } from "@/lib/adminTableVisibility";

describe("weekly article settings", () => {
  it("hides a removed article in stock, orders and material displays while preserving source values", () => {
    const settings: WeeklyArticleSetting[] = [{ pdv_id: "A", category: "glace", article: "Sans sucre", active: false }];
    const source = { id: "weekly:Sans sucre", name: "Sans sucre", sorties: 4, stock: 10 };
    expect(applyWeeklyArticleSettings([source.name, "Vanille"], "A", "glace", settings)).toEqual(["Vanille"]);
    expect(isWeeklyArticleVisible("A", settings, source.id, source.name)).toBe(false);
    expect(isWeeklyArticleVisible("A", settings, "Sans sucre")).toBe(false);
    expect(isWeeklyArticleVisible("B", settings, source.id, source.name)).toBe(true);
    expect(isWeeklyArticleVisible("A", [{ ...settings[0], active: true }], source.id, source.name)).toBe(true);
    expect(source).toEqual({ id: "weekly:Sans sucre", name: "Sans sucre", sorties: 4, stock: 10 });
  });
  it("matches legacy links without hiding unrelated totals or ingredients", () => {
    const settings: WeeklyArticleSetting[] = [{ pdv_id: "A", category: "tarte", article: "Tarte 6", active: false }];
    expect(isWeeklyArticleVisible("A", settings, "weekly:Tarte 6")).toBe(false);
    expect(isWeeklyArticleVisible("A", settings, "Tarte 8")).toBe(true);
    expect(isWeeklyArticleVisible("A", settings, "ali-57", "GLACE")).toBe(true);
  });
  it.each(WEEKLY_CATEGORIES)("adds an article only to the selected PDV and %s follow-up", category => {
    const settings: WeeklyArticleSetting[] = [{ pdv_id: "A", category, article: "Nouvel article", active: true }];
    expect(resolveWeeklyArticles("A", category, settings)).toContain("Nouvel article");
    expect(resolveWeeklyArticles("B", category, settings)).not.toContain("Nouvel article");
    for (const other of WEEKLY_CATEGORIES.filter(c => c !== category)) expect(resolveWeeklyArticles("A", other, settings)).not.toContain("Nouvel article");
  });
  it.each(WEEKLY_CATEGORIES)("removes and restores a default article without changing historical identities in %s", category => {
    const article = WEEKLY_DEFAULTS[category][0];
    const defaults = [...WEEKLY_DEFAULTS[category]];
    const settings: WeeklyArticleSetting[] = [{ pdv_id: "A", category, article, active: false }];
    expect(resolveWeeklyArticles("A", category, settings)).not.toContain(article);
    expect(resolveWeeklyArticles("B", category, settings)).toContain(article);
    expect(resolveWeeklyArticles("A", category, settings, true)).toContain(article);
    expect(resolveWeeklyArticles("A", category, [{ ...settings[0], active: true }])).toEqual(defaults);
    expect(WEEKLY_DEFAULTS[category]).toEqual(defaults);
  });
  it("keeps custom identities available for restoration", () => {
    const settings: WeeklyArticleSetting[] = [{ pdv_id: "A", category: "glace", article: "Glace test", active: false }];
    expect(resolveWeeklyArticles("A", "glace", settings)).not.toContain("Glace test");
    expect(resolveWeeklyArticles("A", "glace", settings, true)).toContain("Glace test");
    expect(resolveWeeklyArticles("A", "glace", [{ ...settings[0], active: true }])).toContain("Glace test");
  });
  it("avoids sharing a historical article identity between two follow-ups", () => {
    expect(validateWeeklyArticle(" Orange fruits ", "glace", "A", [])).not.toBeNull();
    expect(validateWeeklyArticle(" vanille ", "glace", "A", [])).not.toBeNull();
    expect(validateWeeklyArticle("Fruit test", "fruits", "A", [])).toBeNull();
  });
  it("reserves article management to the designated administrator", () => {
    expect(canDisplayAdminTable("khadri1982@gmail.com", true)).toBe(true);
    expect(canDisplayAdminTable("khadri1982@gmail.com", false)).toBe(false);
    expect(canDisplayAdminTable("autre@example.com", true)).toBe(false);
  });
});