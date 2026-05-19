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
  updateAutocontrol,
} from "@/lib/autocontrolData";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateFR } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardCheck, Trash2, Plus, FileCheck } from "lucide-react";
import { OPERATORS } from "@/lib/operators";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PinPromptDialog } from "./PinPromptDialog";

const DEFAULT_ARTICLE_BY_FICHE: Record<FicheType, string> = {
  "Oranges/Bigarreaux confits": "Orange confit",
  "Décoration": "",
  "Panaché": "",
  "Cornet/Tulipe/Gaufrette": "Cornet",
  "Autre": "",
};

const ARTICLE_OPTIONS_BY_FICHE: Partial<Record<FicheType, string[]>> = {
  "Cornet/Tulipe/Gaufrette": ["Cornet", "Tulipe", "Gaufrette"],
  "Oranges/Bigarreaux confits": ["Orange confit", "Bigarreaux confits"],
  "Décoration": [
    "Tarte 10",
    "Tarte 6",
    "Tarte 12",
    "Tarte spéciale",
    "Tarte spéciale 8",
    "Tarte sorbet",
    "Tarte macarons",
    "Tranche napolitaine",
    "Tranche macarons",
    "Tranche sorbet",
    "Bûche normale",
    "Bûche spéciale",
    "Cassate sicilienne",
  ],
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

const PANACHE_MATIERES = [
  "Vanille",
  "Parfait café",
  "Nougat",
  "Chocolat",
  "Caramel",
  "Biscuit",
];

const initialPanacheExtra = (): CtgExtraData => ({
  matieresPremieres: PANACHE_MATIERES.map((name) => ({ name, lot: "" })),
  managerControl: {
    etiquettes: null,
    poids: null,
    remplissage: null,
  },
}) as any;

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
    etiquettes: null,
    cuisson: null,
    forme: null,
    nettoyage: null,
    notes: "",
  },
});

type CtgProductKey = "Cornet" | "Tulipe" | "Gaufrette";
const CTG_PRODUCTS: CtgProductKey[] = ["Cornet", "Tulipe", "Gaufrette"];
type CtgProductRow = { selected: boolean; quantity: string; lotNumber: string; dlc: string };
const initialCtgProducts = (): Record<CtgProductKey, CtgProductRow> => ({
  Cornet: { selected: true, quantity: "", lotNumber: "", dlc: "" },
  Tulipe: { selected: false, quantity: "", lotNumber: "", dlc: "" },
  Gaufrette: { selected: false, quantity: "", lotNumber: "", dlc: "" },
});

type DecoProductRow = { selected: boolean; quantity: string; lotNumber: string };
const initialDecoProducts = (): Record<string, DecoProductRow> => {
  const arr = ARTICLE_OPTIONS_BY_FICHE["Décoration"] ?? [];
  return Object.fromEntries(arr.map((a) => [a, { selected: false, quantity: "", lotNumber: "" }]));
};

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

const conformity = (label: string) =>
  z.enum(["conforme", "non_conforme"], {
    errorMap: () => ({ message: `${label} : cocher Conforme ou Non conforme` }),
  });

const ctgIngredientsSchema = z.object({
  ingredients: z.array(z.object({
    name: requiredText("Ingrédient", 80),
    quantity: requiredText("Quantité ingrédient", 80),
    lot: requiredText("N° lot ingrédient", 120),
  })).length(DEFAULT_CTG_INGREDIENTS.length, "Tous les ingrédients doivent être remplis"),
});

const ctgManagerSchema = z.object({
  cleaning: z.object({
    lavageMachine: z.literal(true, { errorMap: () => ({ message: "Lavage machine : cocher Fait" }) }),
    lavageTorchons: z.literal(true, { errorMap: () => ({ message: "Lavage torchons : cocher Fait" }) }),
    desinfection: z.literal(true, { errorMap: () => ({ message: "Désinfection : cocher Fait" }) }),
    rangementUstensiles: z.literal(true, { errorMap: () => ({ message: "Rangement ustensiles : cocher Fait" }) }),
    notes: z.string().optional(),
  }),
  managerControl: z.object({
    etiquettes: conformity("Étiquettes"),
    cuisson: conformity("Cuisson"),
    forme: conformity("Forme"),
    nettoyage: conformity("Nettoyage"),
    notes: z.string().optional(),
  }),
});

const baseAutocontrolSchema = z.object({
  controlDate: requiredText("Date", 20),
  collaborateur: requiredText("Collaborateur", 100),
  article: requiredText("Désignation", 120),
  lotNumber: requiredText("N° de lot", 120),
  quantity: z.coerce.number({ invalid_type_error: "Quantité obligatoire" }).positive("Quantité obligatoire"),
  dlc: z.string().max(20, "DLC trop long").optional().or(z.literal("")),
  notes: requiredText("Observations", 1000),
  visaManager: z.string().max(100, "Visa manager trop long").optional().or(z.literal("")),
});

const decorationExtraSchema = z.object({
  managerControl: z.object({
    etiquettesInterneExterne: conformity("Étiquette interne et externe"),
    conformiteDecoration: conformity("Conformité de décoration"),
    etatEmballage: conformity("État de l'emballage"),
  }),
});

const panacheMatieresSchema = z.object({
  matieresPremieres: z.array(z.object({
    name: z.string(),
    lot: z.string(),
  }))
    .refine(
      (arr) => arr.length > 0 && arr.every((m) => m.lot.trim().length > 0),
      { message: "Saisir le N° de lot pour chaque matière première" },
    ),
});

const panacheManagerSchema = z.object({
  managerControl: z.object({
    etiquettes: conformity("Étiquettes"),
    poids: conformity("Poids"),
    remplissage: conformity("Remplissage"),
  }),
});

const initialDecorationExtra = (): CtgExtraData => ({
  ingredients: [],
  managerControl: {
    etiquettesInterneExterne: null,
    conformiteDecoration: null,
    etatEmballage: null,
  },
}) as any;

export function AutocontrolManager() {
  const [entries, setEntries] = useState<AutocontrolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("__all__");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [ctgProducts, setCtgProducts] = useState<Record<CtgProductKey, CtgProductRow>>(initialCtgProducts());
  const [decoProducts, setDecoProducts] = useState<Record<string, DecoProductRow>>(initialDecoProducts());
  const [editEntry, setEditEntry] = useState<AutocontrolEntry | null>(null);
  const [editVisa, setEditVisa] = useState("");
  const [editExtra, setEditExtra] = useState<CtgExtraData | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const isCtg = form.ficheType === "Cornet/Tulipe/Gaufrette";
  const isConfit = form.article === "Orange confit" || form.article === "Bigarreaux confits";
  const isDecoration = form.ficheType === "Décoration";
  const isPanache = form.ficheType === "Panaché";

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

    const errors: string[] = [];
      // Pour Panaché on relâche l'exigence article (remplacé par matières premières)
      const formForBase = isPanache
      ? { ...form, article: form.article || "Panaché" }
      : isCtg
      ? { ...form, article: form.article || "Cornet", lotNumber: form.lotNumber || "_", quantity: form.quantity || "1", dlc: form.dlc || "" }
      : isDecoration
      ? { ...form, article: form.article || "Décoration", lotNumber: form.lotNumber || "_", quantity: form.quantity || "1", dlc: "" }
      : form;
    const baseResult = baseAutocontrolSchema.safeParse(formForBase);
    if (!baseResult.success) {
      baseResult.error.issues.forEach((i) => errors.push(i.message));
    }

    const extraData = isCtg ? form.extraData : null;
    if (isCtg) {
      const extraResult = ctgIngredientsSchema.safeParse(extraData);
      if (!extraResult.success) {
        extraResult.error.issues.forEach((i) => errors.push(i.message));
      }
      if (form.visaManager && form.visaManager.trim()) {
        const mgrRes = ctgManagerSchema.safeParse(extraData);
        if (!mgrRes.success) mgrRes.error.issues.forEach((i) => errors.push(i.message));
      }
      const selected = CTG_PRODUCTS.filter((p) => ctgProducts[p].selected);
      if (selected.length === 0) {
        errors.push("Sélectionner au moins un produit (Cornet / Tulipe / Gaufrette)");
      }
      selected.forEach((p) => {
        const row = ctgProducts[p];
        const qty = Number(row.quantity);
        if (!Number.isFinite(qty) || qty <= 0) errors.push(`${p} : quantité obligatoire`);
        if (!row.lotNumber.trim()) errors.push(`${p} : N° de lot obligatoire`);
      });
    }

    const decorationExtra = isDecoration ? form.extraData : null;
    if (isDecoration) {
      if (form.visaManager && form.visaManager.trim()) {
        const dRes = decorationExtraSchema.safeParse(decorationExtra);
        if (!dRes.success) {
          dRes.error.issues.forEach((i) => errors.push(i.message));
        }
      }
      const selectedDeco = Object.entries(decoProducts).filter(([, r]) => r.selected);
      if (selectedDeco.length === 0) {
        errors.push("Sélectionner au moins un article décoré");
      }
      selectedDeco.forEach(([name, row]) => {
        const qty = Number(row.quantity);
        if (!Number.isFinite(qty) || qty <= 0) errors.push(`${name} : quantité obligatoire`);
        if (!row.lotNumber.trim()) errors.push(`${name} : N° de lot obligatoire`);
      });
    }

    const panacheExtra = isPanache ? form.extraData : null;
    if (isPanache) {
      const pMatRes = panacheMatieresSchema.safeParse(panacheExtra);
      if (!pMatRes.success) pMatRes.error.issues.forEach((i) => errors.push(i.message));
      if (form.visaManager && form.visaManager.trim()) {
        const pRes = panacheManagerSchema.safeParse(panacheExtra);
        if (!pRes.success) pRes.error.issues.forEach((i) => errors.push(i.message));
      }
    }

    if (errors.length > 0) {
      const unique = Array.from(new Set(errors));
      toast.error("Fiche incomplète — remplissez tous les champs", {
        description: unique.slice(0, 6).join(" • ") + (unique.length > 6 ? "…" : ""),
      });
      return;
    }

    if (!baseResult.success || (isCtg && !extraData) || (isDecoration && !decorationExtra) || (isPanache && !panacheExtra)) return;
    if (!Number.isFinite(baseResult.data.quantity)) {
      toast.error("Fiche incomplète", { description: "Quantité obligatoire" });
      return;
    }

    setSubmitting(true);
    try {
      // Pour Panaché : afficher "Panaché" dans l'historique (les matières sont dans extraData)
      let articleToSave = baseResult.data.article;
      const lotToSave: string | null = baseResult.data.lotNumber;
      if (isPanache) {
        articleToSave = "Panaché";
      }
      if (isCtg) {
        const selected = CTG_PRODUCTS.filter((p) => ctgProducts[p].selected);
        for (const p of selected) {
          const row = ctgProducts[p];
          await addAutocontrol({
            ficheType: form.ficheType,
            controlDate: baseResult.data.controlDate,
            collaborateur: baseResult.data.collaborateur,
            article: p,
            lotNumber: row.lotNumber.trim(),
            quantity: Number(row.quantity),
            dlc: row.dlc || null,
            visaManager: baseResult.data.visaManager,
            notes: baseResult.data.notes,
            extraData,
          });
        }
      } else if (isDecoration) {
        const selectedDeco = Object.entries(decoProducts).filter(([, r]) => r.selected);
        for (const [name, row] of selectedDeco) {
          await addAutocontrol({
            ficheType: form.ficheType,
            controlDate: baseResult.data.controlDate,
            collaborateur: baseResult.data.collaborateur,
            article: name,
            lotNumber: row.lotNumber.trim(),
            quantity: Number(row.quantity),
            dlc: null,
            visaManager: baseResult.data.visaManager,
            notes: baseResult.data.notes,
            extraData: decorationExtra,
          });
        }
      } else {
      await addAutocontrol({
        ficheType: form.ficheType,
        controlDate: baseResult.data.controlDate,
        collaborateur: baseResult.data.collaborateur,
        article: articleToSave,
        lotNumber: lotToSave,
        quantity: baseResult.data.quantity,
          dlc: isDecoration ? null : (baseResult.data.dlc || null),
        visaManager: baseResult.data.visaManager,
        notes: baseResult.data.notes,
        extraData: isCtg ? extraData : isDecoration ? decorationExtra : isPanache ? panacheExtra : null,
      });
      }
      toast.success("Fiche ajoutée");
      await refresh();
      setForm({
        ...initialForm,
        ficheType: form.ficheType,
        article: DEFAULT_ARTICLE_BY_FICHE[form.ficheType] ?? "",
        extraData: isCtg ? initialCtgExtra() : isDecoration ? initialDecorationExtra() : isPanache ? initialPanacheExtra() : null,
      });
      if (isCtg) setCtgProducts(initialCtgProducts());
      if (isDecoration) setDecoProducts(initialDecoProducts());
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

  const pendingEntries = entries.filter((e) => !e.visaManager || !e.visaManager.trim());
  const filtered =
    filterType === "__all__"
      ? entries
      : filterType === "__pending__"
      ? pendingEntries
      : filterType === "__validated__"
      ? entries.filter((e) => !!e.visaManager && !!e.visaManager.trim())
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
                      ? initialCtgExtra()
                      : newType === "Décoration"
                      ? initialDecorationExtra()
                      : newType === "Panaché"
                      ? initialPanacheExtra()
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
              // validated by Zod
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Collaborateur *</label>
            <Select
              value={form.collaborateur}
              onValueChange={(v) => setForm((f) => ({ ...f, collaborateur: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un opérateur" /></SelectTrigger>
              <SelectContent>
                {OPERATORS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isPanache && !isCtg && !isDecoration && (
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Article / Désignation *</label>
            {ARTICLE_OPTIONS_BY_FICHE[form.ficheType] && ARTICLE_OPTIONS_BY_FICHE[form.ficheType]!.length > 0 ? (
              <Select
                value={form.article}
                onValueChange={(v) => setForm((f) => ({ ...f, article: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {(ARTICLE_OPTIONS_BY_FICHE[form.ficheType] ?? []).map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.article}
                onChange={(e) => setForm((f) => ({ ...f, article: e.target.value }))}
                maxLength={120}
                // validated by Zod
              />
            )}
          </div>
          )}

          {isDecoration && (
            <div className="sm:col-span-2 bg-muted/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold mb-1">Articles décorés *</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Cochez chaque article décoré et renseignez sa quantité et son N° de lot.
              </p>
              <div className="space-y-2">
                {(ARTICLE_OPTIONS_BY_FICHE["Décoration"] ?? []).map((name) => {
                  const row = decoProducts[name] ?? { selected: false, quantity: "", lotNumber: "" };
                  return (
                    <div key={name} className="border rounded-md p-2 bg-background">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={(v) =>
                            setDecoProducts((s) => ({ ...s, [name]: { ...row, selected: !!v } }))
                          }
                        />
                        <span className="font-medium text-sm">{name}</span>
                      </label>
                      {row.selected && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Quantité décorée *</label>
                            <Input
                              type="number"
                              step="any"
                              min="0.01"
                              value={row.quantity}
                              onChange={(e) =>
                                setDecoProducts((s) => ({ ...s, [name]: { ...row, quantity: e.target.value } }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">N° de lot *</label>
                            <Input
                              value={row.lotNumber}
                              maxLength={120}
                              onChange={(e) =>
                                setDecoProducts((s) => ({ ...s, [name]: { ...row, lotNumber: e.target.value } }))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isCtg && (
            <div className="sm:col-span-2 bg-muted/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold mb-1">Produits fabriqués *</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Cochez chaque produit fabriqué avec ces ingrédients et renseignez sa quantité, son N° de lot et sa DLC.
              </p>
              <div className="space-y-3">
                {CTG_PRODUCTS.map((p) => {
                  const row = ctgProducts[p];
                  return (
                    <div key={p} className="border rounded-md p-2 bg-background">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={(v) =>
                            setCtgProducts((s) => ({ ...s, [p]: { ...s[p], selected: !!v } }))
                          }
                        />
                        <span className="font-medium text-sm">{p}</span>
                      </label>
                      {row.selected && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Quantité *</label>
                            <Input
                              type="number"
                              step="any"
                              min="0.01"
                              value={row.quantity}
                              onChange={(e) =>
                                setCtgProducts((s) => ({ ...s, [p]: { ...s[p], quantity: e.target.value } }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">N° de lot *</label>
                            <Input
                              value={row.lotNumber}
                              maxLength={120}
                              onChange={(e) =>
                                setCtgProducts((s) => ({ ...s, [p]: { ...s[p], lotNumber: e.target.value } }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">DLC</label>
                            <Input
                              type="date"
                              value={row.dlc}
                              onChange={(e) =>
                                setCtgProducts((s) => ({ ...s, [p]: { ...s[p], dlc: e.target.value } }))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isPanache && form.extraData?.matieresPremieres && (
            <div className="sm:col-span-2 bg-muted/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold mb-2">Matières premières *</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Saisissez le N° de lot pour chaque matière première.
              </p>
              <div className="space-y-2">
                {form.extraData.matieresPremieres.map((mat, idx) => (
                  <div key={mat.name} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6 text-sm font-medium px-2 py-2 bg-muted/40 rounded">
                      {mat.name}
                    </div>
                    <Input
                      className="col-span-6"
                      placeholder="N° de lot"
                      value={mat.lot}
                      maxLength={120}
                      onChange={(e) =>
                        setForm((f) => {
                          const arr = [...(f.extraData!.matieresPremieres ?? [])];
                          arr[idx] = { ...arr[idx], lot: e.target.value };
                          return { ...f, extraData: { ...f.extraData!, matieresPremieres: arr } };
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {isConfit && (
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">N° de lot avant découpe *</label>
              <Input
                value={form.lotNumber}
                onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
                maxLength={120}
                placeholder="N° de lot avant découpe"
              />
            </div>
          )}

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
                      maxLength={80}
                      // validated by Zod
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
                      maxLength={120}
                      // validated by Zod
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

          {!isConfit && !isCtg && !isDecoration && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">N° de lot</label>
              <Input
                value={form.lotNumber}
                onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
                maxLength={120}
              />
            </div>
          )}
          {!isCtg && !isDecoration && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {isDecoration ? "Quantité décorée" : "Quantité"}
            </label>
            <Input
              type="number"
              step="any"
              min="0.01"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </div>
          )}
          {!isDecoration && !isCtg && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">DLC</label>
              <Input
                type="date"
                value={form.dlc}
                onChange={(e) => setForm((f) => ({ ...f, dlc: e.target.value }))}
              />
            </div>
          )}

          {isDecoration && form.extraData && (
            <div className="sm:col-span-2 bg-primary/5 rounded-lg p-3 mt-2">
              <h4 className="text-sm font-semibold mb-2">Contrôle manager</h4>
              <div className="space-y-2">
                {([
                  ["etiquettesInterneExterne", "Étiquette interne et externe"],
                  ["conformiteDecoration", "Conformité de décoration"],
                  ["etatEmballage", "État de l'emballage"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{label}</span>
                    <div className="flex items-center gap-3">
                      {(["conforme", "non_conforme"] as const).map((status) => (
                        <label key={status} className="flex items-center gap-1 cursor-pointer">
                          <Checkbox
                            checked={(form.extraData!.managerControl as any)?.[key] === status}
                            onCheckedChange={(v) =>
                              setForm((f) => ({
                                ...f,
                                extraData: {
                                  ...(f.extraData as any),
                                  managerControl: {
                                    ...((f.extraData as any)?.managerControl ?? {}),
                                    [key]: v ? status : null,
                                  },
                                },
                              }))
                            }
                          />
                          <span className={status === "conforme" ? "text-emerald-600" : "text-destructive"}>
                            {status === "conforme" ? "Conforme" : "Non conforme"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isPanache && form.extraData && (
            <div className="sm:col-span-2 bg-primary/5 rounded-lg p-3 mt-2">
              <h4 className="text-sm font-semibold mb-2">Contrôle manager</h4>
              <div className="space-y-2">
                {([
                  ["etiquettes", "Étiquettes"],
                  ["poids", "Poids"],
                  ["remplissage", "Remplissage"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{label}</span>
                    <div className="flex items-center gap-3">
                      {(["conforme", "non_conforme"] as const).map((status) => (
                        <label key={status} className="flex items-center gap-1 cursor-pointer">
                          <Checkbox
                            checked={(form.extraData!.managerControl as any)?.[key] === status}
                            onCheckedChange={(v) =>
                              setForm((f) => ({
                                ...f,
                                extraData: {
                                  ...(f.extraData as any),
                                  managerControl: {
                                    ...((f.extraData as any)?.managerControl ?? {}),
                                    [key]: v ? status : null,
                                  },
                                },
                              }))
                            }
                          />
                          <span className={status === "conforme" ? "text-emerald-600" : "text-destructive"}>
                            {status === "conforme" ? "Conforme" : "Non conforme"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCtg && form.extraData && (
            <div className="sm:col-span-2 space-y-4 mt-2 border-t pt-4">
              {/* Nettoyage */}
              <div className="bg-muted/30 rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2">Nettoyage</h4>
                <div className="space-y-2">
                  {([
                    ["lavageMachine", "Lavage machine"],
                    ["lavageTorchons", "Lavage torchons"],
                    ["desinfection", "Désinfection"],
                    ["rangementUstensiles", "Rangement ustensiles"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-2 text-sm cursor-pointer">
                      <span className="font-medium">{label}</span>
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={form.extraData!.cleaning[key] === true}
                          onCheckedChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              extraData: {
                                ...f.extraData!,
                                cleaning: {
                                  ...f.extraData!.cleaning,
                                  [key]: !!v,
                                },
                              },
                            }))
                          }
                        />
                        <span className="text-emerald-600">Fait</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Contrôle manager */}
              <div className="bg-primary/5 rounded-lg p-3">
                <h4 className="text-sm font-semibold mb-2">Contrôle manager</h4>
                <div className="space-y-2">
                  {([
                    ["etiquettes", "Étiquettes"],
                    ["cuisson", "Cuisson"],
                    ["forme", "Forme"],
                    ["nettoyage", "Nettoyage"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{label}</span>
                      <div className="flex items-center gap-3">
                        {(["conforme", "non_conforme"] as const).map((status) => (
                          <label key={status} className="flex items-center gap-1 cursor-pointer">
                            <Checkbox
                              checked={form.extraData!.managerControl[key] === status}
                              onCheckedChange={(v) =>
                                setForm((f) => ({
                                  ...f,
                                  extraData: {
                                    ...f.extraData!,
                                    managerControl: {
                                      ...f.extraData!.managerControl,
                                      [key]: v ? status : null,
                                    },
                                  },
                                }))
                              }
                            />
                            <span className={status === "conforme" ? "text-emerald-600" : "text-destructive"}>
                              {status === "conforme" ? "Conforme" : "Non conforme"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
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
              maxLength={1000}
              // validated by Zod
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Visa manager</label>
            <Input
              value={form.visaManager}
              onChange={(e) => setForm((f) => ({ ...f, visaManager: e.target.value }))}
              maxLength={100}
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
              <SelectItem value="__pending__">
                En attente de visa{pendingEntries.length > 0 ? ` (${pendingEntries.length})` : ""}
              </SelectItem>
              <SelectItem value="__validated__">Visées</SelectItem>
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
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateFR(e.controlDate)}</td>
                    <td className="py-2 pr-2">{e.ficheType}</td>
                    <td className="py-2 pr-2">{e.collaborateur}</td>
                    <td className="py-2 pr-2">{e.article}</td>
                    <td className="py-2 pr-2">{e.lotNumber || "—"}</td>
                    <td className="py-2 pr-2">{e.quantity ?? "—"}</td>
                    <td className="py-2 pr-2">{e.dlc ? formatDateFR(e.dlc) : "—"}</td>
                    <td className="py-2 pr-2">
                      {e.visaManager && e.visaManager.trim() ? (
                        e.visaManager
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium whitespace-nowrap">
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 max-w-[260px]">
                      {e.extraData ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-primary">Détails</summary>
                          <div className="mt-1 space-y-1">
                            {e.extraData.ingredients && e.extraData.ingredients.length > 0 && (
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
                            {e.extraData.matieresPremieres && e.extraData.matieresPremieres.length > 0 && (
                              <div>
                                <strong>Matières premières :</strong>
                                <ul className="ml-3 list-disc">
                                  {e.extraData.matieresPremieres.map((m, k) => (
                                    <li key={k}>{m.name} — lot {m.lot || "—"}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {e.extraData.cleaning && (
                              <div>
                                <strong>Nettoyage :</strong>{" "}
                                {Object.entries(e.extraData.cleaning)
                                  .filter(([k]) => k !== "notes")
                                  .map(([k, v]) => `${k}: ${v === true || v === "conforme" ? "✓ Fait" : "—"}`)
                                  .join(" • ") || "—"}
                              </div>
                            )}
                            {e.extraData.managerControl && (
                              <div>
                                <strong>Contrôle :</strong>{" "}
                                {Object.entries(e.extraData.managerControl)
                                  .filter(([k]) => k !== "notes")
                                  .map(([k, v]) => `${k}: ${v === "conforme" || v === true ? "✓ Conforme" : v === "non_conforme" ? "✗ Non conforme" : "—"}`)
                                  .join(" • ") || "—"}
                              </div>
                            )}
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
                      {(!e.visaManager || !e.visaManager.trim()) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Compléter la fiche (visa + contrôle manager)"
                        onClick={() => {
                          setEditEntry(e);
                          setEditVisa(e.visaManager ?? "");
                          setEditExtra(
                            e.extraData
                              ? JSON.parse(JSON.stringify(e.extraData))
                              : null,
                          );
                        }}
                      >
                        <FileCheck className="h-4 w-4 text-primary" />
                      </Button>
                      )}
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

      <Dialog
        open={editEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditEntry(null);
            setEditExtra(null);
            setEditVisa("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compléter la fiche</DialogTitle>
          </DialogHeader>
          {editEntry && (
            <div className="space-y-4 text-sm">
              <div className="bg-muted/40 rounded p-3 space-y-1 text-xs">
                <div><strong>{editEntry.ficheType}</strong> — {formatDateFR(editEntry.controlDate)}</div>
                <div>Collaborateur : {editEntry.collaborateur}</div>
                <div>Article : {editEntry.article} {editEntry.lotNumber ? `(lot ${editEntry.lotNumber})` : ""}</div>
                <div>Quantité : {editEntry.quantity ?? "—"}{editEntry.dlc ? ` • DLC ${formatDateFR(editEntry.dlc)}` : ""}</div>
                {editEntry.notes && <div>Observations : {editEntry.notes}</div>}
              </div>

              {editEntry.ficheType === "Cornet/Tulipe/Gaufrette" && editExtra && (
                <>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <h4 className="text-sm font-semibold mb-2">Nettoyage</h4>
                    <div className="space-y-2">
                      {([
                        ["lavageMachine", "Lavage machine"],
                        ["lavageTorchons", "Lavage torchons"],
                        ["desinfection", "Désinfection"],
                        ["rangementUstensiles", "Rangement ustensiles"],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center justify-between gap-2 cursor-pointer">
                          <span className="font-medium">{label}</span>
                          <div className="flex items-center gap-1">
                            <Checkbox
                              checked={(editExtra.cleaning as any)?.[key] === true}
                              onCheckedChange={(v) =>
                                setEditExtra((x) => ({
                                  ...(x as any),
                                  cleaning: { ...((x as any)?.cleaning ?? {}), [key]: !!v },
                                }))
                              }
                            />
                            <span className="text-emerald-600">Fait</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <ManagerControlEditor
                    extra={editExtra}
                    onChange={setEditExtra}
                    fields={[
                      ["etiquettes", "Étiquettes"],
                      ["cuisson", "Cuisson"],
                      ["forme", "Forme"],
                      ["nettoyage", "Nettoyage"],
                    ]}
                  />
                </>
              )}

              {editEntry.ficheType === "Décoration" && (
                <ManagerControlEditor
                  extra={editExtra ?? initialDecorationExtra()}
                  onChange={setEditExtra}
                  fields={[
                    ["etiquettesInterneExterne", "Étiquette interne et externe"],
                    ["conformiteDecoration", "Conformité de décoration"],
                    ["etatEmballage", "État de l'emballage"],
                  ]}
                />
              )}

              {editEntry.ficheType === "Panaché" && (
                <ManagerControlEditor
                  extra={editExtra ?? { managerControl: {} } as any}
                  onChange={setEditExtra}
                  fields={[
                    ["etiquettes", "Étiquettes"],
                    ["poids", "Poids"],
                    ["remplissage", "Remplissage"],
                  ]}
                />
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Visa manager</label>
                <Input
                  value={editVisa}
                  maxLength={100}
                  onChange={(e) => setEditVisa(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditEntry(null)}
            >
              Annuler
            </Button>
            <Button
              disabled={savingEdit}
              onClick={async () => {
                if (!editEntry) return;
                setSavingEdit(true);
                try {
                  await updateAutocontrol(editEntry.id, {
                    visaManager: editVisa.trim() || null as any,
                    extraData: editExtra,
                  });
                  toast.success("Fiche mise à jour");
                  setEditEntry(null);
                  setEditExtra(null);
                  setEditVisa("");
                  await refresh();
                } catch (err: any) {
                  toast.error("Erreur", { description: err.message });
                } finally {
                  setSavingEdit(false);
                }
              }}
            >
              {savingEdit ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManagerControlEditor({
  extra,
  onChange,
  fields,
}: {
  extra: CtgExtraData | null;
  onChange: (v: CtgExtraData | null) => void;
  fields: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div className="bg-primary/5 rounded-lg p-3">
      <h4 className="text-sm font-semibold mb-2">Contrôle manager</h4>
      <div className="space-y-2">
        {fields.map(([key, label]) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{label}</span>
            <div className="flex items-center gap-3">
              {(["conforme", "non_conforme"] as const).map((status) => (
                <label key={status} className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={(extra?.managerControl as any)?.[key] === status}
                    onCheckedChange={(v) =>
                      onChange({
                        ...(extra as any),
                        managerControl: {
                          ...((extra as any)?.managerControl ?? {}),
                          [key]: v ? status : null,
                        },
                      })
                    }
                  />
                  <span className={status === "conforme" ? "text-emerald-600" : "text-destructive"}>
                    {status === "conforme" ? "Conforme" : "Non conforme"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
