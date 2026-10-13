import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, update, eq, result } = vi.hoisted(() => ({
  insert: vi.fn(), update: vi.fn(), eq: vi.fn(), result: { data: [] as unknown[], error: null },
}));
vi.mock("@/lib/db", () => ({ supabase: { from: () => ({
  insert, update, select: () => ({ order: () => ({ order: () => Promise.resolve(result) }) }),
}) } }));
import { addCleaningLog, getCleaningLogs, updateCleaningLog } from "@/lib/cleaningData";

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
  eq.mockResolvedValue({ error: null });
  update.mockReturnValue({ eq });
  result.data = [];
});

describe("validations nettoyage indépendantes", () => {
  it("enregistre la validation qualité sans remplacer celle du manager", async () => {
    await addCleaningLog({ zone: "production", logDate: "2026-10-13", collaborateur: "Amina", tasks: { Sol: "F" }, visaManager: "Mr Mahdi Khadri", qualityValidator: "Mme Hajar", qualityConformity: "C", notes: null });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ visa_manager: "Mr Mahdi Khadri", quality_validator: "Mme Hajar", quality_conformity: "C", tasks: { Sol: "F" } }));
  });
  it("une décision Non conforme ne modifie ni le visa manager ni les tâches", async () => {
    await updateCleaningLog("fiche", { qualityConformity: "NC" });
    expect(update).toHaveBeenCalledWith({ quality_conformity: "NC" });
    expect(eq).toHaveBeenCalledWith("id", "fiche");
  });
  it("les anciennes fiches restent non évaluées par la qualité", async () => {
    result.data = [{ id: "ancien", visa_manager: "Manager", tasks: { Sol: "C" } }];
    expect((await getCleaningLogs())[0]).toMatchObject({ visaManager: "Manager", qualityValidator: null, qualityConformity: null, tasks: { Sol: "C" } });
  });
});