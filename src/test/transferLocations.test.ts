import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSFER_LOCATIONS, mergeTransferLocations, validateTransferLocation } from "@/lib/transferLocations";

describe("transfer destination sites", () => {
  it("keeps every existing destination when adding a site", () => {
    expect(mergeTransferLocations(["Nouveau site"])).toEqual([...DEFAULT_TRANSFER_LOCATIONS, "Nouveau site"]);
  });
  it("does not duplicate existing destinations", () => {
    expect(mergeTransferLocations(["  corniche  ", "Nouveau site", "nouveau site"])).toEqual([...DEFAULT_TRANSFER_LOCATIONS, "Nouveau site"]);
    expect(validateTransferLocation(" CORNICHE ", DEFAULT_TRANSFER_LOCATIONS)).toBe("Ce site existe déjà");
  });
  it("rejects empty site names", () => {
    expect(validateTransferLocation("   ", [])).not.toBeNull();
    expect(validateTransferLocation("Site ajouté", [])).toBeNull();
  });
});