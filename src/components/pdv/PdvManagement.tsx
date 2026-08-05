import { useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function PdvManagement({ onChanged }: { onChanged?: () => void }) {
  const { pdvs, refreshPdvs, pdvId } = useAuth();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    await refreshPdvs();
    onChanged?.();
  };

  const addPdv = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error("Code et nom obligatoires");
      return;
    }
    if (!accessCode.trim()) {
      toast.error("Code d'accès obligatoire");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("pdvs")
      .insert({ code: code.trim(), name: name.trim(), access_code: accessCode.trim() } as any);
    setSaving(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    setCode("");
    setName("");
    setAccessCode("");
    toast.success("Point de vente ajouté");
    reload();
  };

  const rename = async (id: string, newName: string) => {
    const { error } = await supabase.from("pdvs").update({ name: newName }).eq("id", id);
    if (error) toast.error("Erreur : " + error.message);
    else reload();
  };

  const setPdvAccessCode = async (id: string, value: string) => {
    if (!value.trim()) return;
    const { error } = await supabase.from("pdvs").update({ access_code: value.trim() } as any).eq("id", id);
    if (error) toast.error("Erreur : " + error.message);
    else toast.success("Code d'accès mis à jour");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("pdvs").update({ active: false }).eq("id", id);
    if (error) toast.error("Erreur : " + error.message);
    else {
      toast.success("Point de vente désactivé");
      reload();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Points de vente ({pdvs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pdvs.map((p) => (
          <div key={p.id} className="flex items-center gap-2 p-2 border rounded-lg flex-wrap">
            <Badge variant="secondary" className="shrink-0">{p.code}</Badge>
            <Input
              defaultValue={p.name}
              className="h-8 flex-1 min-w-[140px]"
              onBlur={(e) => e.target.value !== p.name && rename(p.id, e.target.value)}
            />
            <Input
              placeholder="Code d'accès"
              className="h-8 w-32"
              onBlur={(e) => e.target.value && setPdvAccessCode(p.id, e.target.value)}
            />
            {p.id === pdvId && <Badge className="shrink-0">Actuel</Badge>}
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => remove(p.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2 pt-2 border-t">
          <Input placeholder="Code" className="w-24 h-9" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input placeholder="Nom du point de vente" className="h-9" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Code d'accès" className="w-32 h-9" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />
          <Button size="sm" onClick={addPdv} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
