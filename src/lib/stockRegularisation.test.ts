import { describe, it, expect } from "vitest";
import { splitRegularisation } from "./stockRegularisation";
import { movementFlow } from "./stockData";

describe("régularisation", () => {
  it("ne touche jamais les entrées", () => {
    expect(movementFlow({ type: "entree", source: "regularisation" }, 5)).toEqual({ e: 0, s: -5 });
    expect(movementFlow({ type: "sortie", source: "regularisation" }, 5)).toEqual({ e: 0, s: 5 });
  });
  it("prend sur la veille si les sorties du jour sont insuffisantes", () => {
    const mv = [
      { date: "2026-11-18", type: "sortie", quantity: 6 },
      { date: "2026-11-19", type: "sortie", quantity: 3 },
    ];
    expect(splitRegularisation(5, "2026-11-19", mv)).toEqual([
      { date: "2026-11-19", quantity: 3 },
      { date: "2026-11-18", quantity: 2 },
    ]);
  });
});
