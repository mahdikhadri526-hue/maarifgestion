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
  const [printing, setPrinting] = useState(false);
  const db = supabase as any;
  const [photos, setPhotos] = useState<File[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selPdvId, setSelPdvId] = useState<string>("");
  const ALL = "__all__";
  const viewAll = selPdvId === ALL;
  const activePdvId = getCurrentPdvId() ?? (selPdvId && !viewAll ? selPdvId : null);
  const viewPdvId = viewAll ? null : (selPdvId || activePdvId);
  const pdvName = (id: string | null) => pdvs.find((p) => p.id === id)?.name ?? (id === activePdvId ? pdv?.name : undefined) ?? "—";
  const activePdvName = viewAll ? "Tous les PDV" : pdvName(viewPdvId);
  const splitPj = (v: string | null) => (v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

  const load = useCallback(async () => {
    if (!viewAll && !viewPdvId) { setRows([]); return; }
    let q = db.from("supplier_claims").select("*");
    if (!viewAll) q = q.eq("pdv_id", viewPdvId);
    const { data, error } = await q.order("claim_date", { ascending: true }).order("created_at");
    if (error) return toast.error("Erreur de chargement", { description: error.message });
    setRows(data ?? []);
    const paths = (data ?? []).flatMap((r: any) => splitPj(r.pieces_jointes));
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("supplier-claims").createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      (signed ?? []).forEach((x: any) => { if (x.signedUrl && x.path) m[x.path] = x.signedUrl; });
      setUrls(m);
    }
  }, [viewAll, viewPdvId]);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.produit || !form.description) return toast.error("Produit et description obligatoires");
    if (!activePdvId) return toast.error("Choisissez d'abord le point de vente");
    setSaving(true);
    const paths: string[] = [];
    for (const [i, photo] of photos.entries()) {
      const path = `${activePdvId}/${Date.now()}-${i}-${photo.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("supplier-claims").upload(path, photo, { contentType: photo.type });
      if (up.error) { setSaving(false); return toast.error("Photo non envoyée", { description: up.error.message }); }
      paths.push(path);
    }
    const pj = paths.length ? paths.join("\n") : null;
    const { error } = await db.from("supplier_claims").insert({ ...form, pieces_jointes: pj, pdv_id: activePdvId, created_by: user?.id });
    setSaving(false);
    if (error) return toast.error("Erreur", { description: error.message });
    toast.success("Réclamation enregistrée");
    setForm(empty());
    setPhotos([]);
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

  const print = async () => {
    setPrinting(true);
    try {
      const paths = [...new Set(rows.flatMap((r) => splitPj(r.pieces_jointes)))];
      const photoUrls: Record<string, string> = {};
      if (paths.length) {
        const { data, error } = await supabase.storage.from("supplier-claims").createSignedUrls(paths, 3600);
        if (error) throw error;
        for (const item of data ?? []) {
          if (item.path && item.signedUrl) photoUrls[item.path] = item.signedUrl;
        }
        if (paths.some((path) => !photoUrls[path])) throw new Error("Une photo est indisponible. Réessayez avant de télécharger le PDF.");
      }
      await printStructuredPdf({
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
        n: String(i + 1), date: formatDateFR(r.claim_date), pdv: pdvName(r.pdv_id), responsable: r.responsable ?? "",
        fournisseur: r.fournisseur ?? "", produit: r.produit ?? "", lot: r.lot_number ?? "",
        description: r.description ?? "", qte: r.quantite_nc ?? "", action: r.action_prise ?? "",
        statut: r.statut ?? "", pj: splitPj(r.pieces_jointes).length ? `${splitPj(r.pieces_jointes).length} photo(s)` : "",
      })),
    }],
    imageSections: rows.flatMap((r, i) => {
      const attachments = splitPj(r.pieces_jointes);
      return attachments.length ? [{
        title: `Réclamation n° ${i + 1} - ${formatDateFR(r.claim_date)} - ${pdvName(r.pdv_id)} - ${r.produit ?? ""}`,
        images: attachments.map((path, index) => ({ src: photoUrls[path], caption: `Photo ${index + 1}` })),
      }] : [];
    }),
  });
    } catch (error) {
      toast.error("PDF non généré", { description: error instanceof Error ? error.message : "Impossible de charger les photos. Réessayez." });
    } finally {
      setPrinting(false);
    }
  };

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
        {(
          <div className="w-56">
            <Select value={selPdvId} onValueChange={setSelPdvId}>
              <SelectTrigger><SelectValue placeholder="Choisir le PDV concerné" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les PDV</SelectItem>
                {pdvs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={print} disabled={printing}><Printer className="h-4 w-4 mr-1" /> {printing ? "Préparation des photos…" : "Imprimer"}</Button>
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
            <label className="text-xs font-medium text-muted-foreground">Pièces jointes (photos)</label>
            <div className="flex flex-wrap gap-2">
              {photos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 object-cover rounded border" />
                  <button type="button" className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-5 w-5 text-xs"
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <label className="flex items-center gap-2 border rounded-md p-2 cursor-pointer text-sm">
                <Camera className="h-4 w-4 text-primary" />
                {photos.length ? "Ajouter une photo" : "Prendre une photo"}
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotos((p) => [...p, f]); e.target.value = ""; }} />
              </label>
              <label className="flex items-center gap-2 border rounded-md p-2 cursor-pointer text-sm">
                Galerie (plusieurs)
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { const fs = Array.from(e.target.files ?? []); setPhotos((p) => [...p, ...fs]); e.target.value = ""; }} />
              </label>
            </div>
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
                <td className="border p-2">{pdvName(r.pdv_id)}</td>
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
                <td className="border p-2">{splitPj(r.pieces_jointes).some((p) => urls[p]) ? (
                  <div className="flex flex-wrap gap-1">{splitPj(r.pieces_jointes).filter((p) => urls[p]).map((p) => (
                    <a key={p} href={urls[p]} target="_blank" rel="noreferrer"><img src={urls[p]} alt="Pièce jointe" className="h-12 w-12 object-cover rounded" /></a>
                  ))}</div>
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
