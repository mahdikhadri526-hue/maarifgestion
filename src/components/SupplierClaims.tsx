import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPdvId } from "@/lib/pdvStore";
import { useAuth } from "@/contexts/AuthContext";
import { QUALITY_ACCOUNT_EMAIL } from "@/lib/cleaningData";
import { formatDateFR } from "@/lib/utils";
import { printStructuredPdf } from "@/lib/printExport";

const STATUTS = ["Ouverte", "En cours", "Clôturée"];
const today = () => new Date().toISOString().slice(0, 10);
const empty = () => ({
  claim_date: today(), responsable: "", fournisseur: "", produit: "", lot_number: "",
  description: "", quantite_nc: "", action_prise: "", statut: "Ouverte", pieces_jointes: "",
});

export function SupplierClaims({ standalone = false }: { standalone?: boolean }) {
  const { user, pdv, pdvs, isAdmin, hasAdminRole } = useAuth();
  const isQuality = (user?.email ?? "").toLowerCase() === QUALITY_ACCOUNT_EMAIL;
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const db = supabase as any;
  const [photo, setPhoto] = useState<File | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selPdvId, setSelPdvId] = useState<string>("");
  const activePdvId = getCurrentPdvId() ?? (selPdvId || null);
  const activePdvName = pdv?.name ?? pdvs.find((p) => p.id === activePdvId)?.name ?? "—";

  const load = useCallback(async () => {
    if (!activePdvId) { setRows([]); return; }
    const { data, error } = await db.from("supplier_claims").select("*")
      .eq("pdv_id", activePdvId).order("claim_date", { ascending: true }).order("created_at");
    if (error) return toast.error("Erreur de chargement", { description: error.message });
    setRows(data ?? []);
    const paths = (data ?? []).map((r: any) => r.pieces_jointes).filter(Boolean);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("supplier-claims").createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      (signed ?? []).forEach((x: any) => { if (x.signedUrl && x.path) m[x.path] = x.signedUrl; });
      setUrls(m);
    }
  }, [activePdvId]);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.produit || !form.description) return toast.error("Produit et description obligatoires");
    if (!activePdvId) return toast.error("Choisissez d'abord le point de vente");
    setSaving(true);
    let pj: string | null = null;
    if (photo) {
      const path = `${activePdvId}/${Date.now()}-${photo.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("supplier-claims").upload(path, photo, { contentType: photo.type });
      if (up.error) { setSaving(false); return toast.error("Photo non envoyée", { description: up.error.message }); }
      pj = path;
    }
    const { error } = await db.from("supplier_claims").insert({ ...form, pieces_jointes: pj, pdv_id: activePdvId, created_by: user?.id });
    setSaving(false);
    if (error) return toast.error("Erreur", { description: error.message });
    toast.success("Réclamation enregistrée");
    setForm(empty());
    setPhoto(null);
    load();
  };

  const updateField = async (id: string, k: string, v: string) => {
    const { error } = await db.from("supplier_claims").update({ [k]: v }).eq("id", id);
    if (error) return toast.error("Erreur", { description: error.message });
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer cette réclamation ?")) return;
    const { error } = await db.from("supplier_claims").delete().eq("id", id);
    if (error) return toast.error("Erreur", { description: error.message });
    load();
  };

  const print = () => printStructuredPdf({
    filename: `QC-ENSR-001-${today()}`,
    title: "Suivi des réclamations (QC-ENSR 001)",
    subtitle: activePdvName,
    meta: [`Nombre : ${rows.length}`],
    sections: [{
      title: "Réclamations",
      columns: [
        { header: "N°", dataKey: "n", width: 10 }, { header: "Date", dataKey: "date", width: 22 },
        { header: "PDV", dataKey: "pdv" }, { header: "Responsable", dataKey: "responsable" },
        { header: "Fournisseur", dataKey: "fournisseur" }, { header: "Produit", dataKey: "produit" },
        { header: "N° lot", dataKey: "lot" }, { header: "Description", dataKey: "description" },
        { header: "Qté NC", dataKey: "qte" }, { header: "Action prise", dataKey: "action" },
        { header: "Statut", dataKey: "statut" }, { header: "Pièces jointes", dataKey: "pj" },
      ],
      rows: rows.map((r, i) => ({
        n: String(i + 1), date: formatDateFR(r.claim_date), pdv: activePdvName, responsable: r.responsable ?? "",
        fournisseur: r.fournisseur ?? "", produit: r.produit ?? "", lot: r.lot_number ?? "",
        description: r.description ?? "", qte: r.quantite_nc ?? "", action: r.action_prise ?? "",
        statut: r.statut ?? "", pj: r.pieces_jointes ? "Photo" : "",
      })),
    }],
  });

  const field = (k: keyof ReturnType<typeof empty>, label: string, type = "text") => (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input type={type} value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  if (!isQuality && !hasAdminRole) return null;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold">Suivi des réclamations</h2>
          <p className="text-xs text-muted-foreground">QC-ENSR 001 — rempli par le service qualité · PDV : {activePdvName}</p>
        </div>
        {standalone && (
          <div className="w-56">
            <Select value={selPdvId} onValueChange={setSelPdvId}>
              <SelectTrigger><SelectValue placeholder="Choisir le PDV concerné" /></SelectTrigger>
              <SelectContent>
                {pdvs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={print}><Printer className="h-4 w-4 mr-1" /> Imprimer</Button>
      </div>

      {isQuality ? (
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 border-b">
          {field("claim_date", "Date de réclamation *", "date")}
          {field("responsable", "Responsable")}
          {field("fournisseur", "Fournisseur")}
          {field("produit", "Produit *")}
          {field("lot_number", "N° de lot")}
          {field("quantite_nc", "Quantités non conformes")}
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">Description de la réclamation *</label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Action prise</label>
            <Textarea rows={2} value={form.action_prise} onChange={(e) => set("action_prise", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Statut</label>
            <Select value={form.statut} onValueChange={(v) => set("statut", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">Pièce jointe (photo)</label>
            <label className="flex items-center gap-2 border rounded-md p-2 cursor-pointer text-sm">
              <Camera className="h-4 w-4 text-primary" />
              {photo ? photo.name : "Prendre une photo"}
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </form>
      ) : (
        <p className="p-4 border-b text-xs text-muted-foreground">Consultation seule : cette fiche est remplie uniquement par le service qualité.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead className="bg-muted/60">
            <tr>
              {["N°", "Date", "PDV", "Responsable", "Fournisseur", "Produit", "N° de lot", "Description", "Qté non conforme", "Action prise", "Statut", "Pièces jointes"].map((h) => (
                <th key={h} className="border p-2">{h}</th>
              ))}
              {isQuality && <th className="border p-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={13} className="border p-4 text-center text-muted-foreground">Aucune réclamation</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="border p-2 text-center">{i + 1}</td>
                <td className="border p-2 whitespace-nowrap">{formatDateFR(r.claim_date)}</td>
                <td className="border p-2">{pdv?.name ?? ""}</td>
                <td className="border p-2">{r.responsable || "—"}</td>
                <td className="border p-2">{r.fournisseur || "—"}</td>
                <td className="border p-2">{r.produit || "—"}</td>
                <td className="border p-2">{r.lot_number || "—"}</td>
                <td className="border p-2">{r.description || "—"}</td>
                <td className="border p-2">{r.quantite_nc || "—"}</td>
                <td className="border p-2">{r.action_prise || "—"}</td>
                <td className="border p-2">
                  {isQuality ? (
                    <Select value={r.statut} onValueChange={(v) => updateField(r.id, "statut", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : r.statut}
                </td>
                <td className="border p-2">{r.pieces_jointes && urls[r.pieces_jointes] ? (
                  <a href={urls[r.pieces_jointes]} target="_blank" rel="noreferrer"><img src={urls[r.pieces_jointes]} alt="Pièce jointe" className="h-12 w-12 object-cover rounded" /></a>
                ) : "—"}</td>
                {isQuality && (
                  <td className="border p-1 text-center">
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SupplierClaims;
