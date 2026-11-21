export interface WeeklyEntryRow {
  week_start?: string;
  day_of_week?: string;
  article?: string | null;
  row_index?: number | null;
  entrees?: unknown;
  lot_number?: unknown;
}

export interface WeeklyEntry {
  rowIndex: number;
  entree: any;
  lot: any;
}

export const weeklyEntryKey = (week: string, day: string, article: string) =>
  JSON.stringify([week, day, article]);

// One pass per data change, rather than scanning all history for every cell.
export function buildWeeklyEntryIndex(rows: WeeklyEntryRow[]) {
  const index = new Map<string, WeeklyEntry[]>();
  for (const row of rows) {
    if (!row.week_start || !row.day_of_week || !row.article) continue;
    if (row.entrees == null && !row.lot_number) continue;
    const key = weeklyEntryKey(row.week_start, row.day_of_week, row.article);
    const entries = index.get(key) ?? [];
    entries.push({ rowIndex: row.row_index ?? 0, entree: row.entrees, lot: row.lot_number });
    index.set(key, entries);
  }
  for (const entries of index.values()) entries.sort((a, b) => a.rowIndex - b.rowIndex);
  return index;
}