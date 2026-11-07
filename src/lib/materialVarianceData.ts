import { supabase } from "@/lib/db";
import { fetchAllRows } from "@/lib/supabasePaginate";
import { requireCurrentPdvId } from "@/lib/pdvStore";
import { latestRecipeVersions } from "@/lib/recipeVersions";
import { getProducts, getMovements, getInitialStocks, getGlaceAggregateForRange, getToppingsBreakdown, roundStockQuantity } from "@/lib/stockData";
import { getMiseEnPlaceStocksForWeek, getMiseEnPlaceStocks, weekStartOf, inventoryDayOfWeek } from "@/lib/miseEnPlaceData";
import { formatISODate } from "@/lib/stockWeeklyAggregates";
import { materialActualReference, materialSalesSection, type MaterialActual, type MaterialRecipe, type MaterialIngredient } from "@/lib/materialVariance";
import { stockRecipeIngredients, stockRecipePeriodTotals } from "@/lib/stockRecipeIngredients";
import { CHANTILLY_AGG_ID, type WeeklyTrackingOrderRecord } from "@/lib/stockWeeklyAggregates";

export interface MaterialFinishedProduct { id: string; name: string; category: string | null; active: boolean }

export async function loadMaterialAnalysis(start: string, end: string) {
  const pdvId = requireCurrentPdvId();
  const week = weekStartOf(new Date(`${end}T00:00:00`));
  const [products, recipeRows, ingredients, movements, initial, references, salesRows, weeklyMep, stockArticleRows] = await Promise.all([
    fetchAllRows<MaterialFinishedProduct>(() => supabase.from("finished_products").select("id,name,category,active").order("name")),
    fetchAllRows<MaterialRecipe>(() => supabase.from("recipes").select("id,finished_product_id,version,active")),
    fetchAllRows<MaterialIngredient>(() => supabase.from("recipe_ingredients").select("recipe_id,product_id,category,quantity,unit,notes")),
    getMovements(), getInitialStocks(),
    fetchAllRows<{ product_id: string; conversion: string; unit_ref: string }>(() => supabase.from("stock_ref_conversions").select("product_id,conversion,unit_ref")),
    fetchAllRows<{ item: string; qty: number }>(() => supabase.from("ecart_lines").select("item,qty").eq("pdv_id", pdvId).eq("entry_date", start).eq("section", materialSalesSection(end))),
    getMiseEnPlaceStocksForWeek(week),
    fetchAllRows<WeeklyTrackingOrderRecord>(() => supabase.from("weekly_tracking")
      .select("article,sorties,entrees,stock_initial,day_of_week,week_start,row_index")
      .eq("fiche_type", "Mouvement glaces & tartes").in("article", stockRecipeIngredients.map(row => row.name))),
  ]);
  const inventoryDate = formatISODate(inventoryDayOfWeek(week));
  let mep = weeklyMep;
  if (week === weekStartOf() && !Object.keys(mep).length) mep = await getMiseEnPlaceStocks(true);
  if (inventoryDate < start || inventoryDate > end) mep = {};
  const refs = new Map(references.map(row => [row.product_id, row]));
  const totals: Record<string, { initial: number; receipts: number; outputs: number }> = {};
  for (const product of getProducts()) totals[product.id] = { initial: initial[product.id] ?? 0, receipts: 0, outputs: 0 };
  for (const movement of movements) {
    const totalsRow = totals[movement.productId];
    if (!totalsRow) continue;
    const date = movement.date.slice(0, 10);
    const quantity = roundStockQuantity(movement.quantity);
    if (date < start) totalsRow.initial += movement.type === "entree" ? quantity : -quantity;
    else if (date <= end) {
      if (movement.type === "entree") totalsRow.receipts += quantity;
      else totalsRow.outputs += quantity;
    }
  }
  // Shared stock APIs preserve the ice cream and TOPPINGS period formulas.
  const stockProducts = getProducts();
  const special = await Promise.all(stockProducts.map(async product => {
    if (product.name === "GLACE") return { id: product.id, totals: await getGlaceAggregateForRange(start, end) };
    if (product.name === "TOPPINGS") {
      const parts = await getToppingsBreakdown(date => date >= start && date <= end, date => date < start, {});
      return { id: product.id, totals: { stockInitial: parts.reduce((sum, part) => sum + part.stockInitial, 0), entrees: parts.reduce((sum, part) => sum + part.entrees, 0), stockRestant: parts.reduce((sum, part) => sum + part.stockRestant, 0) } };
    }
    return null;
  }));
  const specialMap = new Map(special.flatMap(row => row ? [[row.id, row.totals] as const] : []));
  const actuals: Record<string, MaterialActual> = {};
  for (const product of stockProducts) {
    const row = totals[product.id];
    if (!row) continue;
    const override = specialMap.get(product.id);
    const si = roundStockQuantity(override?.stockInitial ?? row.initial);
    const receipts = roundStockQuantity(override?.entrees ?? row.receipts);
    const remaining = roundStockQuantity(override?.stockRestant ?? row.initial + row.receipts - row.outputs);
    const ref = refs.get(product.id);
    actuals[product.id] = { name: product.name, category: product.category, unit: ref?.unit_ref ?? "", quantity: materialActualReference(si, receipts, remaining, mep[product.id] ?? 0, ref?.conversion ?? "") };
  }
  for (const row of stockRecipePeriodTotals(stockArticleRows, start, end)) {
    const ref = refs.get(row.id);
    // Stock article rows display native quantities, not invented kg/piece conversions.
    // Cream's general stock row explicitly uses kg; other unlabelled units need checking.
    actuals[row.id] = { name: row.name, category: row.category,
      quantity: ref ? materialActualReference(row.stockInitial, row.entrees, row.stockRestant, mep[row.id] ?? 0, ref.conversion) : row.sorties,
      unit: ref?.unit_ref ?? (row.id === CHANTILLY_AGG_ID ? "kg" : "STOCK"),
    };
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