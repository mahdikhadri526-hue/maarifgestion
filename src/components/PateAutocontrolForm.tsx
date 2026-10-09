import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProducts } from "@/lib/stockData";
import { useManagers } from "@/lib/roster";
import { supabase } from "@/lib/db";
import { addAutocontrol, type FicheType, type ConformityStatus } from "@/lib/autocontrolData";
import { formatDateFR } from "@/lib/utils";

export const PATE_FICHES: Record<string, { article: string; ingredients: string[] }> = {
  "Pâte à crêpe": {
    article: "Pâte à crêpe",
    ingredients: ["Œuf", "Sucre granulé", "Beurre", "Lait"],
  },
  "Pâte à gaufre": {
    article: "Pâte à gaufre",
    ingredients: ["Œuf", "Sucre granulé", "Beurre", "Lait", "Farine", "Levure déshydratée", "Sel"],
  },
};

// Ingrédients dont le lot est importé automatiquement (FIFO Gestion des lots). L'œuf reste manuel.
const LOT_PATTERN: Record<string, RegExp> = {
  "Sucre granulé": /SUCRE\s*GRANUL/i,
  "Beurre": /BEURRE/i,
  "Lait": /LAIT/i,
  "Farine": /FARINE/i,
  "Levure déshydratée": /LEVURE/i,
  "Sel": /^SEL\b/i,
};

export const isPateFiche = (t: string) => t in PATE_FICHES;

const CONTROLS: { key: "etiquettes" | "aspectOdeur" | "conservation"; label: string }[] = [
  { key: "etiquettes", label: "Étiquette" },
  { key: "aspectOdeur", label: "Aspect / odeur" },
  { key: "conservation", label: "Conservation" },
];

const localIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const today = () => localIso();
// Date du jour au format JJ.MM.AAAA, utilisée pour préremplir « N° lot / Date de production ».
const todayFr = () => formatDateFR(localIso());

export function PateAutocontrolForm({
  ficheType,
  operatorOptions,
  onSaved,
}: {
  ficheType: FicheType;
  operatorOptions: string[];
  onSaved: () => void;
}) {
  const def = PATE_FICHES[ficheType];
  const [date, setDate] = useState(today());
  const [agent, setAgent] = useState("");
  const [ings, setIngs] = useState(def.ingredients.map((name) => ({ name, quantity: "", lot: "" })));
  const [qty, setQty] = useState("");
  const [lot, setLot] = useState(todayFr());
  const [controls, setControls] = useState<Record<string, ConformityStatus>>({});
  const [visa, setVisa] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const managerOptions = useManagers();

  const [lotChoices, setLotChoices] = useState<Record<string, string[]>>({});

  // Trois derniers lots enregistrés pour chaque matière première (sauf l'œuf, saisi à la main).
  const autoFillLots = async () => {
    const products = getProducts("alimentaire");
    const entries = await Promise.all(
      def.ingredients.map(async (name) => {
        const pat = LOT_PATTERN[name];
        const prod = pat && products.find((p) => pat.test(p.name));
        if (!prod) return [name, []] as const;
        const { data } = await supabase
          .from("lot_entries")
          .select("lot_number, entry_date, created_at")
          .eq("product_id", prod.id)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(20);
        const uniq = Array.from(new Set((data ?? []).map((r: any) => String(r.lot_number ?? "").trim()).filter(Boolean)));
        return [name, uniq.slice(0, 3)] as const;
      }),
    );
    const map = Object.fromEntries(entries) as Record<string, string[]>;
    setLotChoices(map);
    setIngs((s) => s.map((x) => (LOT_PATTERN[x.name] ? { ...x, lot: map[x.name]?.[0] ?? "" } : x)));
  };

  useEffect(() => {
    setIngs(def.ingredients.map((name) => ({ name, quantity: "", lot: "" })));
    setControls({});
    setLot(todayFr());
    autoFillLots();
  }, [ficheType]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];
    if (!date) errors.push("Date obligatoire");
    if (!agent) errors.push("Agent de production obligatoire");
    ings.forEach((i) => {
      if (!(Number(i.quantity) > 0)) errors.push(`${i.name} : quantité (g) obligatoire`);
      if (!i.lot.trim()) errors.push(`${i.name} : N° de lot obligatoire`);
    });
    if (!(Number(qty) > 0)) errors.push("Quantité produite obligatoire");
    if (!lot.trim()) errors.push("N° lot / date de production obligatoire");
    if (visa.trim()) {
      CONTROLS.forEach((c) => {
        if (!controls[c.key]) errors.push(`${c.label} : cocher C ou NC`);
      });
    }
    if (errors.length) {
      toast.error("Fiche incomplète — remplissez tous les champs", {
        description: errors.slice(0, 6).join(" • ") + (errors.length > 6 ? "…" : ""),
      });
      return;
    }
    setSaving(true);
    try {
      await addAutocontrol({
        ficheType,
        controlDate: date,
        collaborateur: agent,
        article: def.article,
        lotNumber: lot.trim(),
        quantity: Number(qty),
        dlc: null,
        visaManager: visa.trim() || null,
        notes:
          [ings.map((i) => `${i.name} ${i.quantity} g (lot ${i.lot})`).join(" ; "), notes.trim()]
            .filter(Boolean)
            .join(" — ") || null,
        extraData: {
          ingredients: ings.map((i) => ({ ...i, quantity: String(i.quantity) })),
          managerControl: { ...controls } as any,
        },
      });
      toast.success(`Fiche ${def.article} enregistrée`);
      setIngs(def.ingredients.map((name) => ({ name, quantity: "", lot: "" })));
      setQty("");
      setLot(todayFr());
      setControls({});
      setVisa("");
      setNotes("");
      autoFillLots();
      onSaved();
    } catch (err: any) {
      toast.error("Erreur d'enregistrement", { description: err?.message ?? String(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Date *</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Agent de production *</label>
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un opérateur" /></SelectTrigger>
            <SelectContent>
              {operatorOptions.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Ingrédient</th>
              <th className="p-2 text-left">Quantité (g) *</th>
              <th className="p-2 text-left">N° de lot *</th>
            </tr>
          </thead>
          <tbody>
            {ings.map((i, idx) => (
              <tr key={i.name} className="border-t">
                <td className="p-2 font-medium whitespace-nowrap">{i.name}</td>
                <td className="p-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    className="h-8 min-w-[90px]"
                    value={i.quantity}
                    onChange={(e) =>
                      setIngs((s) => s.map((x, j) => (j === idx ? { ...x, quantity: e.target.value } : x)))
                    }
                  />
                </td>
                <td className="p-1">
                  {LOT_PATTERN[i.name] ? (
                    (lotChoices[i.name]?.length ?? 0) > 0 ? (
                      <Select
                        value={i.lot}
                        onValueChange={(v) =>
                          setIngs((s) => s.map((x, j) => (j === idx ? { ...x, lot: v } : x)))
                        }
                      >
                        <SelectTrigger className="h-8 min-w-[110px]"><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          {lotChoices[i.name].map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun lot en stock</span>
                    )
                  ) : (
                    <Input
                      className="h-8 min-w-[110px]"
                      placeholder="Saisir"
                      value={i.lot}
                      onChange={(e) =>
                        setIngs((s) => s.map((x, j) => (j === idx ? { ...x, lot: e.target.value } : x)))
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Quantité produite *</label>
          <Input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">N° lot / Date de production *</label>
          <Input value={lot} onChange={(e) => setLot(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <p className="text-sm font-semibold">Contrôle du manager</p>
        {CONTROLS.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2">
            <span className="text-sm">{c.label}</span>
            <div className="flex gap-1">
              {(["conforme", "non_conforme"] as const).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={controls[c.key] === v ? (v === "conforme" ? "default" : "destructive") : "outline"}
                  onClick={() => setControls((s) => ({ ...s, [c.key]: v }))}
                >
                  {v === "conforme" ? "C" : "NC"}
                </Button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Visa manager</label>
          <Select value={visa || "__none__"} onValueChange={(v) => setVisa(v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un manager" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Aucun —</SelectItem>
              {managerOptions.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Observations</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving ? "Enregistrement…" : "Enregistrer la fiche"}
      </Button>
    </form>
  );
}
