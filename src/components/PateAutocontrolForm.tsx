import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addAutocontrol, type FicheType, type ConformityStatus } from "@/lib/autocontrolData";

export const PATE_FICHES: Record<string, { article: string; ingredients: string[] }> = {
  "Pâte à crêpe": {
    article: "Pâte à crêpe",
    ingredients: ["Œuf", "Sucre semoule", "Beurre", "Lait"],
  },
  "Pâte à gaufre": {
    article: "Pâte à gaufre",
    ingredients: ["Œuf", "Sucre semoule", "Beurre", "Lait", "Farine", "Levure déshydratée", "Sel"],
  },
};

export const isPateFiche = (t: string) => t in PATE_FICHES;

const CONTROLS: { key: "etiquettes" | "aspectOdeur" | "conservation"; label: string }[] = [
  { key: "etiquettes", label: "Étiquette" },
  { key: "aspectOdeur", label: "Aspect / odeur" },
  { key: "conservation", label: "Conservation" },
];

const today = () => new Date().toISOString().slice(0, 10);

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
  const [lot, setLot] = useState("");
  const [controls, setControls] = useState<Record<string, ConformityStatus>>({});
  const [visa, setVisa] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIngs(def.ingredients.map((name) => ({ name, quantity: "", lot: "" })));
    setControls({});
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
      setLot("");
      setControls({});
      setVisa("");
      setNotes("");
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
                  <Input
                    className="h-8 min-w-[110px]"
                    value={i.lot}
                    onChange={(e) =>
                      setIngs((s) => s.map((x, j) => (j === idx ? { ...x, lot: e.target.value } : x)))
                    }
                  />
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
          <Input value={visa} onChange={(e) => setVisa(e.target.value)} placeholder="Nom du manager" />
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
