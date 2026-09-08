import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquareWarning, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useManagers } from "@/lib/roster";
import { formatDateFR } from "@/lib/utils";
import { printStructuredPdf } from "@/lib/printExport";
import {
  addClaim,
  CLAIM_ORIGINES,
  CLAIM_PRODUITS,
  CLAIM_TYPES,
  ClaimEntry,
  ClaimKind,
  deleteClaim,
  getClaims,
} from "@/lib/claimsData";

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowHM = () =>
  `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

const emptyForm = () => ({
  entryDate: todayISO(),
  entryTime: nowHM(),
  manager: "",
  origine: "",
  claimType: "",
  produit: "",
  description: "",
  actionCorrective: "",
});

export function ClaimsReturns() {
  const [kind, setKind] = useState<ClaimKind>("reclamation");
  const [rows, setRows] = useState<ClaimEntry[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const managerOptions = useManagers();
  const isClaim = kind === "reclamation";

  const load = useCallback(async () => {
    try {
      setRows(await getClaims(kind));
    } catch (e: any) {
      toast.error("Erreur de chargement", { description: e.message });
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.manager) {
      toast.error("Manager obligatoire");
      return;
    }
    if (isClaim && (!form.origine || !form.claimType)) {
      toast.error("Origine et type de réclamation obligatoires");
      return;
    }
    if (!isClaim && !form.produit) {
      toast.error("Produit obligatoire");
      return;
    }
    setSaving(true);
    try {
      await addClaim({
        kind,
        entryDate: form.entryDate,
        entryTime: form.entryTime || null,
        manager: form.manager,
        origine: isClaim ? form.origine : null,
        claimType: isClaim ? form.claimType : null,
        produit: form.produit || null,
        description: form.description || null,
        actionCorrective: form.actionCorrective || null,
      });
      toast.success(isClaim ? "Réclamation enregistrée" : "Retour enregistré");
      setForm(emptyForm());
      await load();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteClaim(id);
      setRows((r) => r.filter((x) => x.id !== id));
      toast.success("Supprimé");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handlePrint = async () => {
    await printStructuredPdf({
      filename: `${isClaim ? "reclamations" : "retours"}-${todayISO()}`,
      title: isClaim ? "Registre des réclamations" : "Registre des retours",
      subtitle: formatDateFR(todayISO()),
      meta: [`Nombre de fiches : ${rows.length}`],
      sections: [
        {
          title: isClaim ? "Réclamations" : "Retours",
          columns: isClaim
            ? [
                { header: "Date", dataKey: "date", width: 24 },
                { header: "Heure", dataKey: "time", width: 18 },
                { header: "Manager", dataKey: "manager" },
                { header: "Origine", dataKey: "origine" },
                { header: "Type", dataKey: "type" },
                { header: "Description", dataKey: "description" },
                { header: "Action corrective", dataKey: "action" },
              ]
            : [
                { header: "Date", dataKey: "date", width: 24 },
                { header: "Heure", dataKey: "time", width: 18 },
                { header: "Manager", dataKey: "manager" },
                { header: "Produit", dataKey: "produit" },
                { header: "Description", dataKey: "description" },
                { header: "Action corrective", dataKey: "action" },
              ],
          rows: rows.map((r) => ({
            date: formatDateFR(r.entryDate),
            time: r.entryTime ?? "",
            manager: r.manager ?? "",
            origine: r.origine ?? "",
            type: r.claimType ?? "",
            produit: r.produit ?? "",
            description: r.description ?? "",
            action: r.actionCorrective ?? "",
          })),
        },
      ],
    });
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b">
        <MessageSquareWarning className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold mr-auto">Réclamations & Retours</h2>
        <Select value={kind} onValueChange={(v) => setKind(v as ClaimKind)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="reclamation">Réclamations</SelectItem>
            <SelectItem value="retour">Retours</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Imprimer
        </Button>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border-b">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Date *</label>
          <Input
            type="date"
            value={form.entryDate}
            onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Heure</label>
          <Input
            type="time"
            value={form.entryTime}
            onChange={(e) => setForm((f) => ({ ...f, entryTime: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Manager *</label>
          <Select value={form.manager} onValueChange={(v) => setForm((f) => ({ ...f, manager: v }))}>
            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>
              {managerOptions.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isClaim ? (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Origine de la réclamation *</label>
              <Select value={form.origine} onValueChange={(v) => setForm((f) => ({ ...f, origine: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {CLAIM_ORIGINES.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type de la réclamation *</label>
              <Select value={form.claimType} onValueChange={(v) => setForm((f) => ({ ...f, claimType: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {CLAIM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Produit {isClaim ? "" : "*"}
          </label>
          <Select value={form.produit} onValueChange={(v) => setForm((f) => ({ ...f, produit: v }))}>
            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent className="max-h-72">
              {CLAIM_PRODUITS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Action corrective</label>
          <Textarea
            rows={2}
            value={form.actionCorrective}
            onChange={(e) => setForm((f) => ({ ...f, actionCorrective: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[800px]">
          <thead className="bg-muted/60">
            <tr>
              <th className="border p-2 w-[90px]">Date</th>
              <th className="border p-2 w-[60px]">Heure</th>
              <th className="border p-2">Manager</th>
              {isClaim && <th className="border p-2">Origine</th>}
              {isClaim && <th className="border p-2">Type</th>}
              <th className="border p-2">Produit</th>
              <th className="border p-2">Description</th>
              <th className="border p-2">Action corrective</th>
              <th className="border p-2 w-[50px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={isClaim ? 9 : 7} className="border p-4 text-center text-muted-foreground">
                  Aucune fiche enregistrée
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="border p-2 whitespace-nowrap">{formatDateFR(r.entryDate)}</td>
                <td className="border p-2 text-center">{r.entryTime ?? "—"}</td>
                <td className="border p-2">{r.manager ?? "—"}</td>
                {isClaim && <td className="border p-2">{r.origine ?? "—"}</td>}
                {isClaim && <td className="border p-2">{r.claimType ?? "—"}</td>}
                <td className="border p-2">{r.produit ?? "—"}</td>
                <td className="border p-2">{r.description ?? "—"}</td>
                <td className="border p-2">{r.actionCorrective ?? "—"}</td>
                <td className="border p-1 text-center">
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ClaimsReturns;
