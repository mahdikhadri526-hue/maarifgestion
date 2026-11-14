import { supabase } from "@/lib/db";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { latestRecipeVersions } from "@/lib/recipeVersions";
import { getMovements, getStockLevels, getProductUnits, getGlaceAggregateForRange, getToppingsBreakdown, roundStockQuantity } from "@/lib/stockData";
import { getMiseEnPlaceStocksForWeek, getMiseEnPlaceStocks, weekStartOf, inventoryDayOfWeek } from "@/lib/miseEnPlaceData";
import { formatISODate } from "@/lib/stockWeeklyAggregates";
import { materialSalesSection, type MaterialRecipe, type MaterialIngredient } from "@/lib/materialVariance";
import { stockRecipeIngredients } from "@/lib/stockRecipeIngredients";
import { MACARON_ARTICLES, SIROP_CARAMEL_WEEKLY_ARTICLE, AMANDES_WEEKLY_ARTICLE, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";
import { buildMaterialStockActuals } from "@/lib/materialStockActuals";
import { loadCustomStockGroups, loadGroupSources, customGroupMaterialActual, groupIngredientId } from "@/lib/customStockGroups";

export interface MaterialFinishedProduct { id: string; name: string; category: string | null; active: boolean }

export async function loadMaterialAnalysis(start: string, end: string) {
  const pdvId = requireCurrentPdvId();
  const week = weekStartOf(new Date(`${end}T00:00:00`));
  const [products, recipeRows, ingredients, movements, levels, references, salesRows, weeklyMep, stockArticleRows, stockUnits] = await Promise.all([
    fetchAllRows<MaterialFinishedProduct>(() => supabase.from("finished_products").select("id,name,category,active").order("name")),
    fetchAllRows<MaterialRecipe>(() => supabase.from("recipes").select("id,finished_product_id,version,active")),
    fetchAllRows<MaterialIngredient>(() => supabase.from("recipe_ingredients").select("recipe_id,product_id,category,quantity,unit,notes")),
    getMovements(), getStockLevels(),
    fetchAllRows<{ product_id: string; conversion: string; unit_ref: string }>(() => supabase.from("stock_ref_conversions").select("product_id,conversion,unit_ref")),
    fetchAllRows<{ item: string; qty: number }>(() => supabase.from("ecart_lines").select("item,qty").eq("pdv_id", pdvId).eq("entry_date", start).eq("section", materialSalesSection(end))),
    getMiseEnPlaceStocksForWeek(week),
    fetchAllRows<WeeklyTrackingOrderRecord>(() => supabase.from("weekly_tracking")
      .select("article,sorties,entrees,stock_initial,day_of_week,week_start,row_index")
      .eq("fiche_type", "Mouvement glaces & tartes").in("article", [...new Set([...stockRecipeIngredients.map(row => row.name), ...MACARON_ARTICLES, SIROP_CARAMEL_WEEKLY_ARTICLE, AMANDES_WEEKLY_ARTICLE])])
      .order("id")),
    getProductUnits(),
  ]);
  const inventoryDate = formatISODate(inventoryDayOfWeek(week));
  let mep = weeklyMep;
  if (week === weekStartOf() && !Object.keys(mep).length) mep = await getMiseEnPlaceStocks(true);
  if (inventoryDate < start || inventoryDate > end) mep = {};
  // Shared stock APIs preserve the ice cream and TOPPINGS period formulas.
  const special = await Promise.all(levels.map(async product => {
    if (product.productName === "GLACE") return { id: product.productId, totals: await getGlaceAggregateForRange(start, end) };
    if (product.productName === "TOPPINGS") {
      const parts = await getToppingsBreakdown(date => date >= start && date <= end, date => date < start, {});
      const sum = (key: "stockInitial" | "entrees" | "sorties" | "stockRestant") => roundStockQuantity(parts.reduce((total, part) => total + part[key], 0));
      return { id: product.productId, totals: { stockInitial: sum("stockInitial"), entrees: sum("entrees"), sorties: sum("sorties"), stockRestant: sum("stockRestant") } };
    }
    return null;
  }));
  const actuals = buildMaterialStockActuals(levels, movements, start, end, references, mep, stockArticleRows,
    Object.fromEntries(special.flatMap(row => row ? [[row.id, row.totals]] : [])), stockUnits);
  const exports = (await loadCustomStockGroups()).filter(row => row.exported);
  if (exports.length) {
    const sources = await loadGroupSources(start, end);
    const groupReferences = Object.fromEntries(references.map(row => [row.product_id, { conversion: row.conversion, unitRef: row.unit_ref }]));
    for (const group of exports) {
      const id = groupIngredientId(group);
      // Existing individual outputs remain untouched; only add missing references.
      if (group.source_ids.length === 1 && actuals[id]) continue;
      try {
        actuals[id] = customGroupMaterialActual(group, sources, mep, groupReferences);
      } catch {
        actuals[id] = { name: group.name, category: "alimentaire", quantity: null, unit: "", conversionMissing: true };
      }
    }
  }
  return { products, recipes: latestRecipeVersions(recipeRows).filter(row => row.active), ingredients, actuals, sales: Object.fromEntries(salesRows.map(row => [row.item, Number(row.qty)])) as Record<string, number> };
}

export async function saveMaterialSales(start: string, end: string, sales: Record<string, number>) {
  const pdv_id = requireCurrentPdvId();
  const rows = Object.entries(sales).map(([item, qty]) => {
    if (!Number.isFinite(qty) || qty < 0) throw new Error("Les quantités vendues doivent être positives ou nulles.");
    return { pdv_id, entry_date: start, section: materialSalesSection(end), item, qty };
  });
  if (!rows.length) return;
  const { error } = await supabase.from("ecart_lines").upsert(rows, { onConflict: "pdv_id,entry_date,section,item" });
  if (error) throw error;
}