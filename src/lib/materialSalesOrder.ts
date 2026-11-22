export function orderMaterialSales<T extends { id: string }>(products: T[], order: string[]): T[] {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...products].sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
}

export function moveMaterialSale(order: string[], visibleIds: string[], id: string, direction: -1 | 1): string[] {
  const index = visibleIds.indexOf(id);
  const neighbour = visibleIds[index + direction];
  if (index < 0 || !neighbour) return order;
  const next = [...order];
  const from = next.indexOf(id);
  const to = next.indexOf(neighbour);
  if (from < 0 || to < 0) return order;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function readMaterialSalesOrder(pdvId: string | null): string[] {
  if (!pdvId) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`material-sales-order:${pdvId}`) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
  } catch { return []; }
}