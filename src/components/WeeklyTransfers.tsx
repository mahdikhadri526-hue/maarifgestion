import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Plus, ChevronDown, Undo2 } from "lucide-react";
import { cn, formatDateFR } from "@/lib/utils";
import { useOperators } from "@/lib/roster";

const TRANSFER_LOCATIONS = [
  "Dar Bouazza", "Corniche", "Almaz", "Sidi Maarouf", "Bouskoura", "Hassan 2",
  "Anfa place", "Tachfine", "Rabat", "Morocco Mall", "Mohamedia", "Californie",
  "Franchise", "Événement", "Ville verte",
];

type Direction = "recu" | "envoye";
type Kind = "pret" | "emprunt" | "retour_pret" | "retour_emprunt";

// Prêt = envoyé ; Emprunt = reçu. Retour de prêt = le prêt nous revient (reçu) ;
// Retour d'emprunt = nous rendons ce qui a été emprunté (envoyé).
function kindOf(r: { direction: Direction; is_return?: boolean | null }): Kind {
  if (r.is_return) return r.direction === "recu" ? "retour_pret" : "retour_emprunt";
  return r.direction === "envoye" ? "pret" : "emprunt";
}
const KIND_LABEL: Record<Kind, string> = {
  pret: "Prêt",
  emprunt: "Emprunt",
  retour_pret: "Retour de prêt",
  retour_emprunt: "Retour d'emprunt",
};
const KIND_STYLE: Record<Kind, string> = {
  pret: "bg-destructive/10 text-destructive",
  emprunt: "bg-success/10 text-success",
  retour_pret: "bg-primary/10 text-primary",
  retour_emprunt: "bg-warning/15 text-warning",
};

interface TransferRow {
  id: string;
  fiche_type: string;
  week_start: string;
  transfer_date: string;
  direction: Direction;
  article: string | null;
  quantity: number | null;
  lot_number: string | null;
  location: string | null;
  performed_by: string | null;
  notes: string | null;
  is_return?: boolean | null;
  return_of_id?: string | null;
}

interface Props {
  ficheKey: string;
  weekStart: string;
  articles?: string[];
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeeklyTransfers({ ficheKey, weekStart, articles = [] }: Props) {
  const operators = useOperators();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [saving, setSaving] = useState(false);

  const [direction, setDirection] = useState<Direction>("recu");
  const [transferDate, setTransferDate] = useState(todayIso());
  const [article, setArticle] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [location, setLocation] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [notes, setNotes] = useState("");

  // Tous les transferts de toutes les périodes (pas seulement la semaine affichée)
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("weekly_transfers")
      .select("id,fiche_type,week_start,transfer_date,direction,article,quantity,lot_number,location,performed_by,notes,is_return,return_of_id")
      .eq("fiche_type", ficheKey)
      .order("transfer_date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setRows((data ?? []) as TransferRow[]);
  }, [ficheKey]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const totals = useMemo(() => {
    let recu = 0, envoye = 0;
    rows.forEach((r) => {
      const q = Number(r.quantity ?? 0);
      if (r.direction === "recu") recu += q;
      else envoye += q;
    });
    return { recu, envoye };
  }, [rows]);

  // Totaux cumulés par article (toutes périodes confondues)
  const byArticle = useMemo(() => {
    const m = new Map<string, { recu: number; envoye: number; count: number }>();
    rows.forEach((r) => {
      const key = r.article?.trim() || "— (sans article)";
      const cur = m.get(key) ?? { recu: 0, envoye: 0, count: 0 };
      const q = Number(r.quantity ?? 0);
      if (r.direction === "recu") cur.recu += q;
      else cur.envoye += q;
      cur.count += 1;
      m.set(key, cur);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [rows]);

  const kindStats = useMemo(() => {
    const st: Record<Kind, { count: number; qty: number }> = {
      pret: { count: 0, qty: 0 }, emprunt: { count: 0, qty: 0 },
      retour_pret: { count: 0, qty: 0 }, retour_emprunt: { count: 0, qty: 0 },
    };
    rows.forEach((r) => { const k = kindOf(r); st[k].count += 1; st[k].qty += Number(r.quantity ?? 0); });
    return st;
  }, [rows]);

  const visibleRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => kindOf(r) === filter)),
    [rows, filter],
  );

  const returnedIds = useMemo(
    () => new Set(rows.filter((r) => r.return_of_id).map((r) => r.return_of_id as string)),
    [rows],
  );

  const reset = () => {
    setArticle("");
    setQuantity("");
    setLotNumber("");
    setLocation("");
    setNotes("");
  };

  const handleAdd = async () => {
    if (!location) return toast.error("Choisissez la provenance / destination");
    if (!performedBy) return toast.error("Indiquez qui a effectué le transfert");
    setSaving(true);
    const { error } = await supabase.from("weekly_transfers").insert({
      fiche_type: ficheKey,
      week_start: weekStart,
      transfer_date: transferDate,
      direction,
      article: article || null,
      quantity: quantity === "" ? null : Number(quantity),
      lot_number: lotNumber || null,
      location,
      performed_by: performedBy,
      notes: notes || null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error("Enregistrement impossible");
      console.error(error);
      return;
    }
    toast.success(direction === "recu" ? "Transfert reçu enregistré" : "Transfert envoyé enregistré");
    reset();
    load();
  };

  // Retour d'un transfert déjà effectué : crée le mouvement inverse
  const handleReturn = async (r: TransferRow) => {
    const who = performedBy || r.performed_by;
    if (!who) return toast.error("Choisissez d'abord qui effectue le retour");
    const reverse: Direction = r.direction === "recu" ? "envoye" : "recu";
    const { error } = await supabase.from("weekly_transfers").insert({
      fiche_type: ficheKey,
      week_start: weekStart,
      transfer_date: todayIso(),
      direction: reverse,
      article: r.article,
      quantity: r.quantity,
      lot_number: r.lot_number,
      location: r.location,
      performed_by: who,
      notes: `${r.direction === "recu" ? "Retour d'emprunt" : "Retour de prêt"} du ${formatDateFR(r.transfer_date)}${r.notes ? ` — ${r.notes}` : ""}`,
      is_return: true,
      return_of_id: r.id,
    } as any);
    if (error) {
      toast.error("Retour impossible");
      console.error(error);
      return;
    }
    toast.success(reverse === "envoye" ? "Retour d'emprunt enregistré" : "Retour de prêt enregistré");
    load();
  };


  return (
    <div className="mt-3 no-print">
      <h3 className="mb-2 text-base font-semibold">Transferts reçus / envoyés</h3>
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} className="shadow-sm">
        <ArrowDownLeft className="h-4 w-4 mr-1 text-success" />
        <ArrowUpRight className="h-4 w-4 mr-2 text-destructive" />
        Transferts reçus / envoyés
        {rows.length > 0 && (
          <span className="ml-2 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">{rows.length}</span>
        )}
        <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="mt-3 rounded-lg border bg-card p-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Sens</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="recu">Reçu (emprunt)</SelectItem>
                  <SelectItem value="envoye">Envoyé (prêt)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{direction === "recu" ? "Provenance" : "Destination"}</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent className="bg-popover z-50 max-h-64">
                  {TRANSFER_LOCATIONS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Effectué par</Label>
              <Select value={performedBy} onValueChange={setPerformedBy}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent className="bg-popover z-50 max-h-64">
                  {operators.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Article</Label>
              {articles.length > 0 ? (
                <Select value={article} onValueChange={setArticle}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-64">
                    {articles.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={article} onChange={(e) => setArticle(e.target.value)} placeholder="Article" />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantité</Label>
              <Input type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">N° de lot</Label>
              <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Remarques</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel" />
            </div>
          </div>

          <Button size="sm" onClick={handleAdd} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" />
            {saving ? "Enregistrement..." : "Ajouter le transfert"}
          </Button>

          {/* Détail des transferts — toutes périodes confondues */}
          {rows.length === 0 && (
            <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
              {loading ? "Chargement..." : "Aucun transfert enregistré."}
            </div>
          )}
          {rows.length > 0 && (
            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter((f) => (f === k ? "all" : k))}
                  className={cn("rounded-md border p-2 text-left transition-colors", KIND_STYLE[k], filter === k && "ring-2 ring-primary")}
                >
                  <div className="text-xs font-semibold">{KIND_LABEL[k]}s</div>
                  <div className="text-lg font-bold leading-tight">{kindStats[k].count}</div>
                  <div className="text-[11px] opacity-80">Qté totale : {kindStats[k].qty}</div>
                </button>
              ))}
            </div>
          )}
          {rows.length > 0 && (
            <div className="rounded-md border">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Détail des transferts ({visibleRows.length}) — toutes périodes</span>
                <div className="ml-auto flex flex-wrap gap-1">
                  {(["all", "pret", "emprunt", "retour_pret", "retour_emprunt"] as const).map((k) => (
                    <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setFilter(k)}>
                      {k === "all" ? "Tout" : `${KIND_LABEL[k]}s`}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="overflow-auto max-h-[50vh] border-t">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Article</th>
                      <th className="p-2 text-left">Qté</th>
                      <th className="p-2 text-left">N° lot</th>
                      <th className="p-2 text-left">Provenance / Destination</th>
                      <th className="p-2 text-left">Effectué par</th>
                      <th className="p-2 text-left">Remarques</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">
                          <span className={cn("inline-flex items-center gap-1 font-medium", r.direction === "recu" ? "text-success" : "text-destructive")}>
                            {r.direction === "recu" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            {r.direction === "recu" ? "Reçu" : "Envoyé"}
                          </span>
                          <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold align-middle whitespace-nowrap", KIND_STYLE[kindOf(r)])}>
                            {KIND_LABEL[kindOf(r)]}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">{formatDateFR(r.transfer_date)}</td>
                        <td className="p-2">{r.article ?? "—"}</td>
                        <td className="p-2">{r.quantity ?? "—"}</td>
                        <td className="p-2">{r.lot_number ?? "—"}</td>
                        <td className="p-2">{r.location ?? "—"}</td>
                        <td className="p-2">{r.performed_by ?? "—"}</td>
                        <td className="p-2">{r.notes ?? "—"}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {!r.is_return && (
                            returnedIds.has(r.id) ? (
                              <span className="mr-1 text-[10px] text-muted-foreground">{r.direction === "envoye" ? "Prêt rendu" : "Emprunt rendu"}</span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mr-1 h-7 px-2 text-xs"
                                onClick={() => handleReturn(r)}
                                title={r.direction === "recu" ? "Rendre cet emprunt" : "Enregistrer le retour de ce prêt"}
                              >
                                <Undo2 className="h-3.5 w-3.5 mr-1" />
                                {r.direction === "recu" ? "Rendre l'emprunt" : "Retour du prêt"}
                              </Button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
