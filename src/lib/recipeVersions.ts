export function latestRecipeVersions<T extends { id: string; finished_product_id: string; version: number; active: boolean }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.finished_product_id);
    if (!current || (row.active && !current.active) || (row.active === current.active && row.version > current.version)) latest.set(row.finished_product_id, row);
  }
  return [...latest.values()];
}