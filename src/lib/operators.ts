const KEY = "stockmaarif:operators";

export function getOperators(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function rememberOperator(name: string): string[] {
  const clean = name.trim();
  if (!clean) return getOperators();
  const existing = getOperators();
  // Case-insensitive dedupe, keep most recent first
  const filtered = existing.filter((o) => o.toLowerCase() !== clean.toLowerCase());
  const next = [clean, ...filtered].slice(0, 50);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}
