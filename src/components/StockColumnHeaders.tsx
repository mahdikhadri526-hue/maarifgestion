export function StockColumnHeaders({ showRefCols, showMepCols }: { showRefCols: boolean; showMepCols: boolean }) {
  const columns = [
    "Unité", "Conversion", "Unité Réf.", "Catégorie", "Stock Initial",
    ...(showMepCols ? ["Stock initial total", ...(showRefCols ? ["Stock initial total Réf."] : [])] : []),
    "Entrées", ...(showRefCols ? ["Entrées Réf."] : []),
    "Sorties", ...(showRefCols ? ["Sorties Réf."] : []),
    "Stock", ...(showRefCols ? ["Stock Réf."] : []),
    ...(showMepCols ? ["Stock mise en place", ...(showRefCols ? ["Stock mise en place Réf."] : []), "Sorties total", ...(showRefCols ? ["Sorties total Réf."] : []), "Stock total", ...(showRefCols ? ["Stock total Réf."] : [])] : []),
  ];
  return <>{columns.map(column => <th key={column} className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">{column}</th>)}</>;
}