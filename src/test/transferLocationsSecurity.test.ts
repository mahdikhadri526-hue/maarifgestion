import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("transfer destination read authorization", () => {
  it("requires an assigned role instead of admitting every registered account", () => {
    const sql = readFileSync("drizzle/migrations/0056_restrict_transfer_locations_read.sql", "utf8");
    expect(sql.trim()).toBe('ALTER POLICY "Authenticated users read transfer locations" ON public.transfer_locations TO authenticated USING (public.has_any_role(auth.uid()));');
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });
});