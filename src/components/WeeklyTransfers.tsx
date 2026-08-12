import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2, ChevronDown } from "lucide-react";
import { cn, formatDateFR } from "@/lib/utils";
import { useOperators } from "@/lib/roster";

const TRANSFER_LOCATIONS = [
  "Dar Bouazza", "Corniche", "Almaz", "Sidi Maarouf", "Bouskoura", "Hassan 2",
  "Anfa place", "Tachfine", "Rabat", "Morocco Mall", "Mohamedia", "Californie",
  "Franchise", "Événement", "Ville verte",
];

type Direction = "recu" | "envoye";

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
  const [saving, setSaving] = useState(false);

  const [direction, setDirection] = useState<Direction>("recu");
  const [transferDate, setTransferDate] = useState(todayIso());
  const [article, setArticle] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [location, setLocation] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("weekly_transfers")
      .select("id,fiche_type,week_start,transfer_date,direction,article,quantity,lot_number,location,performed_by,notes")
      .eq("fiche_type", ficheKey)
      .eq("week_start", weekStart)
      .order("transfer_date", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setRows((data ?? []) as TransferRow[]);
  }, [ficheKey, weekStart]);

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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("weekly_transfers").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="mt-3 no-print">
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
                  <SelectItem value="recu">Reçu</SelectItem>
                  <SelectItem value="envoye">Envoyé</SelectItem>
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

          <div className="rounded-md border overflow-auto max-h-[40vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">Sens</th>
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
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">
                      <span className={cn("inline-flex items-center gap-1 font-medium", r.direction === "recu" ? "text-success" : "text-destructive")}>
                        {r.direction === "recu" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                        {r.direction === "recu" ? "Reçu" : "Envoyé"}
                      </span>
                    </td>
                    <td className="p-2 whitespace-nowrap">{formatDateFR(r.transfer_date)}</td>
                    <td className="p-2">{r.article ?? "—"}</td>
                    <td className="p-2">{r.quantity ?? "—"}</td>
                    <td className="p-2">{r.lot_number ?? "—"}</td>
                    <td className="p-2">{r.location ?? "—"}</td>
                    <td className="p-2">{r.performed_by ?? "—"}</td>
                    <td className="p-2">{r.notes ?? "—"}</td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-muted-foreground">
                      {loading ? "Chargement..." : "Aucun transfert enregistré pour cette semaine."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-muted-foreground">
            Total reçu : <span className="text-success font-semibold">{totals.recu}</span> · Total envoyé :{" "}
            <span className="text-destructive font-semibold">{totals.envoye}</span>
          </div>
        </div>
      )}
    </div>
  );
}
