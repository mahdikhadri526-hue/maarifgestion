import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  AutocontrolEntry,
  CtgExtraData,
  FICHE_TYPES,
  FicheType,
  addAutocontrol,
  deleteAutocontrol,
  getAutocontrols,
} from "@/lib/autocontrolData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PinPromptDialog } from "./PinPromptDialog";

const DEFAULT_ARTICLE_BY_FICHE: Record<FicheType, string> = {
  "Oranges/Bigarreaux confits": "Orange confit",
  "Décoration": "",
  "Panaché": "Panaché",
  "Cornet/Tulipe/Gaufrette": "Cornet",
  "Autre": "",
};

const ARTICLE_OPTIONS_BY_FICHE: Partial<Record<FicheType, string[]>> = {
  "Cornet/Tulipe/Gaufrette": ["Cornet", "Tulipe", "Gaufrette"],
  "Oranges/Bigarreaux confits": ["Orange confit", "Bigarreaux confits"],
};

const DEFAULT_CTG_INGREDIENTS = [
  "Farine",
  "Huile",
  "Eau",
  "Sucre semoule",
  "Poudre vanille",
  "Sel",
  "Beurre",
];

const initialCtgExtra = (): CtgExtraData => ({
  ingredients: DEFAULT_CTG_INGREDIENTS.map((name) => ({ name, lot: "", quantity: "" })),
  cleaning: {
    lavageMachine: false,
    lavageTorchons: false,
    desinfection: false,
    rangementUstensiles: false,
    notes: "",
  },
  managerControl: {
    etiquettes: false,
    cuisson: false,
    forme: false,
    nettoyage: false,
    notes: "",
  },
});

const initialForm = {
  ficheType: "Oranges/Bigarreaux confits" as FicheType,
  controlDate: new Date().toISOString().slice(0, 10),
  collaborateur: "",
  article: DEFAULT_ARTICLE_BY_FICHE["Oranges/Bigarreaux confits"],
  lotNumber: "",
  quantity: "",
  dlc: "",
  visaManager: "",
  notes: "",
  extraData: null as CtgExtraData | null,
};

const requiredText = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} obligatoire`).max(max, `${label} trop long`);

const ctgExtraSchema = z.object({
  ingredients: z.array(z.object({
    name: requiredText("Ingrédient", 80),
    quantity: requiredText("Quantité ingrédient", 80),
    lot: requiredText("N° lot ingrédient", 120),
  })).length(DEFAULT_CTG_INGREDIENTS.length, "Tous les ingrédients doivent être remplis"),
  cleaning: z.object({
    lavageMachine: z.literal(true, { errorMap: () => ({ message: "Lavage machine à cocher" }) }),
    lavageTorchons: z.literal(true, { errorMap: () => ({ message: "Lavage torchons à cocher" }) }),
    desinfection: z.literal(true, { errorMap: () => ({ message: "Désinfection à cocher" }) }),
    rangementUstensiles: z.literal(true, { errorMap: () => ({ message: "Rangement ustensiles à cocher" }) }),
    notes: z.string().optional(),
  }),
  managerControl: z.object({
    etiquettes: z.literal(true, { errorMap: () => ({ message: "Étiquettes à cocher" }) }),
    cuisson: z.literal(true, { errorMap: () => ({ message: "Cuisson à cocher" }) }),
    forme: z.literal(true, { errorMap: () => ({ message: "Forme à cocher" }) }),
    nettoyage: z.literal(true, { errorMap: () => ({ message: "Nettoyage manager à cocher" }) }),
    notes: z.string().optional(),
  }),
});

const baseAutocontrolSchema = z.object({
  controlDate: requiredText("Date", 20),
  collaborateur: requiredText("Collaborateur", 100),
  article: requiredText("Désignation", 120),
  lotNumber: requiredText("N° de lot", 120),
  quantity: z.coerce.number({ invalid_type_error: "Quantité obligatoire" }).positive("Quantité obligatoire"),
  dlc: requiredText("DLC", 20),
  notes: requiredText("Observations", 1000),
  visaManager: requiredText("Visa manager", 100),
});

export function AutocontrolManager() {
  const [entries, setEntries] = useState<AutocontrolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("__all__");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isCtg = form.ficheType === "Cornet/Tulipe/Gaufrette";

  const refresh = useCallback(async () => {
    try {
      const data = await getAutocontrols();
      setEntries(data);
    } catch (e: any) {
      toast.error("Erreur de chargement", { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("autocontrols-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "autocontrols" },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const baseResult = baseAutocontrolSchema.safeParse(form);
    if (!baseResult.success) {
      toast.error("Fiche incomplète", { description: baseResult.error.issues[0]?.message });
      return;
    }

    const extraData = isCtg ? form.extraData : null;
    if (isCtg) {
      const extraResult = ctgExtraSchema.safeParse(extraData);
      if (!extraResult.success) {
        toast.error("Fiche incomplète", { description: extraResult.error.issues[0]?.message });
        return;
      }
    }

    if (!Number.isFinite(baseResult.data.quantity)) {
      toast.error("Fiche incomplète", { description: "Quantité obligatoire" });
      return;
    }

    setSubmitting(true);
    try {
      await addAutocontrol({
        ficheType: form.ficheType,
        controlDate: baseResult.data.controlDate,
        collaborateur: baseResult.data.collaborateur,
        article: baseResult.data.article,
        lotNumber: baseResult.data.lotNumber,
        quantity: baseResult.data.quantity,
        dlc: baseResult.data.dlc,
        visaManager: baseResult.data.visaManager,
        notes: baseResult.data.notes,
        extraData,
      });
      toast.success("Fiche ajoutée");
      await refresh();
      setForm({
        ...initialForm,
        ficheType: form.ficheType,
        article: DEFAULT_ARTICLE_BY_FICHE[form.ficheType] ?? "",
        extraData: isCtg ? initialCtgExtra() : null,
      });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAutocontrol(deleteId);
      toast.success("Fiche supprimée");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setDeleteId(null);
    }
  };

  const filtered =
    filterType === "__all__"
      ? entries
      : entries.filter((e) => e.ficheType === filterType);

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-card rounded-xl border p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Nouvelle fiche d'autocontrôle</h2>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Type de fiche *</label>
            <Select
              value={form.ficheType}
              onValueChange={(v) => {
                const newType = v as FicheType;
                setForm((f) => ({
                  ...f,
                  ficheType: newType,
                  article: DEFAULT_ARTICLE_BY_FICHE[newType] ?? f.article,
                  extraData:
                    newType === "Cornet/Tulipe/Gaufrette"
                      ? f.extraData ?? initialCtgExtra()
                      : null,
                }));
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FICHE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date *</label>
            <Input
              type="date"
              value={form.controlDate}
              onChange={(e) => setForm((f) => ({ ...f, controlDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Collaborateur *</label>
            <Input
              value={form.collaborateur}
              onChange={(e) => setForm((f) => ({ ...f, collaborateur: e.target.value }))}
              placeholder="Prénom"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Article / Désignation *</label>
            {ARTICLE_OPTIONS_BY_FICHE[form.ficheType] ? (
              <Select
                value={form.article}
                onValueChange={(v) => setForm((f) => ({ ...f, article: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {ARTICLE_OPTIONS_BY_FICHE[form.ficheType]!.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.article}
                onChange={(e) => setForm((f) => ({ ...f, article: e.target.value }))}
                required
              />
            )}
          </div>

          {isCtg && form.extraData && (
            <div className="sm:col-span-2">
              <h4 className="text-sm font-semibold mb-2">Ingrédients (recette)</h4>
              <div className="space-y-2">
                {form.extraData.ingredients.map((ing, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 text-sm font-medium px-2 py-2 bg-muted/40 rounded">
                      {ing.name}
                    </div>
                    <Input
                      className="col-span-3"
                      placeholder="Quantité"
                      value={ing.quantity}
                      onChange={(e) =>
                        setForm((f) => {
                          const arr = [...f.extraData!.ingredients];
                          arr[idx] = { ...arr[idx], quantity: e.target.value };
                          return { ...f, extraData: { ...f.extraData!, ingredients: arr } };
                        })
                      }
                    />
                    <Input
                      className="col-span-4"
                      placeholder="N° lot"
                      value={ing.lot}
                      onChange={(e) =>
                        setForm((f) => {
                          const arr = [...f.extraData!.ingredients];
                          arr[idx] = { ...arr[idx], lot: e.target.value };
                          return { ...f, extraData: { ...f.extraData!, ingredients: arr } };
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Quantité</label>
            <Input
              type="number"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">N° de lot</label>
            <Input
              value={form.lotNumber}
              onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">DLC</label>
            <Input
              type="date"
              value={form.dlc}
              onChange={(e) => setForm((f) => ({ ...f, dlc: e.target.value }))}
            />
          </div>

          {isCtg && form.extraData && (
            <div className="sm:col-span-2 space-y-4 mt-2 border-t pt-4">
              {/* Nettoyage */}
              <div className="bg-muted/30 rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2">Nettoyage</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    ["lavageMachine", "Lavage machine"],
                    ["lavageTorchons", "Lavage torchons"],
                    ["desinfection", "Désinfection"],
                    ["rangementUstensiles", "Rangement ustensiles"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.extraData!.cleaning[key]}
                        onCheckedChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            extraData: {
                              ...f.extraData!,
                              cleaning: { ...f.extraData!.cleaning, [key]: !!v },
                            },
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Contrôle manager */}
              <div className="bg-primary/5 rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2">Contrôle manager</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    ["etiquettes", "Étiquettes"],
                    ["cuisson", "Cuisson"],
                    ["forme", "Forme"],
                    ["nettoyage", "Nettoyage"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.extraData!.managerControl[key]}
                        onCheckedChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            extraData: {
                              ...f.extraData!,
                              managerControl: { ...f.extraData!.managerControl, [key]: !!v },
                            },
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Observations</label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Visa manager</label>
            <Input
              value={form.visaManager}
              onChange={(e) => setForm((f) => ({ ...f, visaManager: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting} className="w-full">
              <Plus className="h-4 w-4 mr-1" />
              {submitting ? "Ajout..." : "Ajouter la fiche"}
            </Button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-card rounded-xl border p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">Historique des autocontrôles</h3>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes les fiches</SelectItem>
              {FICHE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune fiche enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground text-xs uppercase">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Fiche</th>
                  <th className="py-2 pr-2">Collaborateur</th>
                  <th className="py-2 pr-2">Article</th>
                  <th className="py-2 pr-2">Lot</th>
                  <th className="py-2 pr-2">Qté</th>
                  <th className="py-2 pr-2">DLC</th>
                  <th className="py-2 pr-2">Visa</th>
                  <th className="py-2 pr-2">Notes</th>
                  <th className="py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 pr-2 whitespace-nowrap">{e.controlDate}</td>
                    <td className="py-2 pr-2">{e.ficheType}</td>
                    <td className="py-2 pr-2">{e.collaborateur}</td>
                    <td className="py-2 pr-2">{e.article}</td>
                    <td className="py-2 pr-2">{e.lotNumber || "—"}</td>
                    <td className="py-2 pr-2">{e.quantity ?? "—"}</td>
                    <td className="py-2 pr-2">{e.dlc || "—"}</td>
                    <td className="py-2 pr-2">{e.visaManager || "—"}</td>
                    <td className="py-2 pr-2 max-w-[260px]">
                      {e.extraData ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-primary">Détails</summary>
                          <div className="mt-1 space-y-1">
                            {e.extraData.ingredients?.length > 0 && (
                              <div>
                                <strong>Ingrédients :</strong>
                                <ul className="ml-3 list-disc">
                                  {e.extraData.ingredients.map((i, k) => (
                                    <li key={k}>
                                      {i.name} — {i.quantity} (lot {i.lot || "—"})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div>
                              <strong>Nettoyage :</strong>{" "}
                              {Object.entries(e.extraData.cleaning)
                                .filter(([k, v]) => k !== "notes" && v === true)
                                .map(([k]) => k)
                                .join(", ") || "—"}
                            </div>
                            <div>
                              <strong>Contrôle :</strong>{" "}
                              {Object.entries(e.extraData.managerControl)
                                .filter(([k, v]) => k !== "notes" && v === true)
                                .map(([k]) => k)
                                .join(", ") || "—"}
                            </div>
                            {e.notes && <div><strong>Obs :</strong> {e.notes}</div>}
                          </div>
                        </details>
                      ) : (
                        <span className="truncate block" title={e.notes || ""}>
                          {e.notes || "—"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(e.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PinPromptDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Confirmer la suppression"
        description="Entrez le code PIN pour supprimer cette fiche."
      />
    </div>
  );
}
