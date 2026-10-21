import { expect, it } from "vitest";
import { canExtendTechDeadline, isLaterDeadline } from "@/lib/techDeadline";

it("reserves extensions to the technical responsible with management permission", () => {
  expect(canExtendTechDeadline("gestion-technique@oliveri.com", true)).toBe(true);
  expect(canExtendTechDeadline("khadri1982@gmail.com", true)).toBe(false);
  expect(canExtendTechDeadline("gestion-technique@oliveri.com", false)).toBe(false);
  expect(canExtendTechDeadline(undefined, true)).toBe(false);
});

it("only accepts a deadline later than the existing deadline", () => {
  expect(isLaterDeadline("2026-10-21", "2026-10-22")).toBe(true);
  expect(isLaterDeadline("2026-10-21", "2026-10-21")).toBe(false);
  expect(isLaterDeadline("2026-10-21", "2026-10-20")).toBe(false);
  expect(isLaterDeadline(null, "2026-10-22")).toBe(false);
  expect(isLaterDeadline("2026-10-21", "")).toBe(false);
});