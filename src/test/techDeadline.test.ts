import { expect, it } from "vitest";
import { canCorrectTechDeadline, isChangedDeadline } from "@/lib/techDeadline";

it("reserves corrections to the technical responsible with management permission", () => {
  expect(canCorrectTechDeadline("gestion-technique@oliveri.com", true)).toBe(true);
  expect(canCorrectTechDeadline("khadri1982@gmail.com", true)).toBe(false);
  expect(canCorrectTechDeadline("gestion-technique@oliveri.com", false)).toBe(false);
  expect(canCorrectTechDeadline(undefined, true)).toBe(false);
});

it("accepts moving the deadline later", () => {
  expect(isChangedDeadline("2026-10-21", "2026-10-22")).toBe(true);
});
it("accepts moving the deadline earlier", () => {
  expect(isChangedDeadline("2026-10-21", "2026-10-20")).toBe(true);
});
it("rejects unchanged, missing or invalid dates", () => {
  expect(isChangedDeadline("2026-10-21", "2026-10-21")).toBe(false);
  expect(isChangedDeadline(null, "2026-10-22")).toBe(false);
  expect(isChangedDeadline("2026-10-21", "")).toBe(false);
  expect(isChangedDeadline("2026-10-21", "2026-02-30")).toBe(false);
});