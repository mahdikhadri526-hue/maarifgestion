import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AutocontrolEntry,
  FICHE_TYPES,
  FicheType,
  addAutocontrol,
  deleteAutocontrol,
  getAutocontrols,
} from "@/lib/autocontrolData";
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
import { ClipboardCheck, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PinPromptDialog } from "./PinPromptDialog";

const initialForm = {
  ficheType: "Oranges/Bigarreaux confits" as FicheType,
  controlDate: new Date().toISOString().slice(0, 10),
  collaborateur: "",
  article: "",
  lotNumber: "",
  quantity: "",
  dlc: "",
  visaManager: "",
  notes: "",
};

export function AutocontrolManager() {
  const [entries, setEntries] = useState<AutocontrolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("__all__");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    if (!form.collaborateur.trim() || !form.article.trim()) {
      toast.error("Collaborateur et Article sont obligatoires");
      return;
    }
    setSubmitting(true);
    try {
      await addAutocontrol({
        ficheType: form.ficheType,
        controlDate: form.controlDate,
        collaborateur: form.collaborateur.trim(),
        article: form.article.trim(),
        lotNumber: form.lotNumber.trim() || null,
        quantity: form.quantity === "" ? null : Number(form.quantity),
        dlc: form.dlc || null,
        visaManager: form.visaManager.trim() || null,
        notes: form.notes.trim() || null,
      });
      toast.success("Fiche ajoutée");
      setForm({ ...initialForm, ficheType: form.ficheType });
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
              onValueChange={(v) => setForm((f) => ({ ...f, ficheType: v as FicheType }))}
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
            <Input
              value={form.article}
              onChange={(e) => setForm((f) => ({ ...f, article: e.target.value }))}
              required
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
            <label className="text-xs font-medium text-muted-foreground">Quantité</label>
            <Input
              type="number"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
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
          <div>
            <label className="text-xs font-medium text-muted-foreground">Visa manager</label>
            <Input
              value={form.visaManager}
              onChange={(e) => setForm((f) => ({ ...f, visaManager: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Observations</label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
                    <td className="py-2 pr-2 max-w-[200px] truncate" title={e.notes || ""}>
                      {e.notes || "—"}
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
