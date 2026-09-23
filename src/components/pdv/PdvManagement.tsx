import { useEffect, useState } from "react";
import { Building2, Trash2, Settings2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, AppRole, useAuth } from "@/contexts/AuthContext";

const PDV_ROLE_PRESETS: Record<AppRole, string[]> = {
  admin: ALL_PERMISSIONS.map((p) => p.key),
  regional_admin: ALL_PERMISSIONS.map((p) => p.key),
  manager: [
    "view_dashboard", "view_stock", "edit_stock",
    "view_movements", "edit_movements", "delete_movements",
    "view_requisitions", "edit_requisitions", "delete_requisitions",
    "view_lots", "edit_lots", "delete_lots",
    "view_autocontrol", "edit_autocontrol",
    "view_claims", "edit_claims",
    "view_glace", "edit_glace",
    "view_weekly", "edit_weekly",
    "view_temperatures", "edit_temperatures",
    "view_cleaning", "edit_cleaning",
    "view_reports", "view_recipes", "edit_recipes",
    "view_ecarts", "edit_ecarts",
    "view_planning", "manage_planning",
  ],
  operator: [
    "view_dashboard", "view_movements", "edit_movements",
    "view_requisitions", "edit_requisitions",
    "view_lots", "edit_lots",
    "view_autocontrol", "edit_autocontrol",
    "view_claims", "edit_claims",
    "view_glace", "edit_glace",
    "view_weekly", "edit_weekly",
    "view_temperatures", "edit_temperatures",
    "view_cleaning", "edit_cleaning",
    "view_planning",
  ],
  viewer: ["view_dashboard", "view_stock", "view_movements", "view_requisitions", "view_lots", "view_reports"],
};

export function PdvManagement({ onChanged }: { onChanged?: () => void }) {
  const { pdvs, refreshPdvs, pdvId, isAdmin, isRegionalAdmin, permissions, can } = useAuth();
  const canEditPerms = isAdmin || isRegionalAdmin;
  // Chaque compte ne voit que les permissions qu'il détient lui-même.
  const visibleGroups = isAdmin
    ? PERMISSION_GROUPS
    : PERMISSION_GROUPS.map((g) => ({ ...g, keys: g.keys.filter((k) => can(k)) })).filter(
        (g) => g.keys.length > 0,
      );
  const canTogglePerm = (_key: string) => isAdmin || isRegionalAdmin;
  const [pdvRoles, setPdvRoles] = useState<Record<string, AppRole>>({});
  const [pdvPerms, setPdvPerms] = useState<Record<string, Set<string>>>({});
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newAccessCode, setNewAccessCode] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRights = async () => {
    const [{ data: rows }, { data: perms }] = await Promise.all([
      supabase.from("pdvs").select("id, default_role" as any),
      supabase.from("pdv_permissions" as any).select("pdv_id, permission_key, allowed"),
    ]);
    const rMap: Record<string, AppRole> = {};
    ((rows ?? []) as any[]).forEach((r) => { rMap[r.id] = (r.default_role ?? "operator") as AppRole; });
    setPdvRoles(rMap);
    const pMap: Record<string, Set<string>> = {};
    ((perms ?? []) as any[]).forEach((p) => {
      if (!pMap[p.pdv_id]) pMap[p.pdv_id] = new Set();
      if (p.allowed) pMap[p.pdv_id].add(p.permission_key);
    });
    setPdvPerms(pMap);
  };

  useEffect(() => {
    loadRights();
  }, [pdvs.length]);

  const reload = async () => {
    await refreshPdvs();
    await loadRights();
    onChanged?.();
  };

  const setPdvRole = async (id: string, role: AppRole) => {
    const { error } = await supabase.from("pdvs").update({ default_role: role } as any).eq("id", id);
    if (error) { toast.error("Erreur : " + error.message); return; }
    await supabase.from("pdv_permissions" as any).delete().eq("pdv_id", id);
    const keys = PDV_ROLE_PRESETS[role];
    if (keys.length > 0) {
      await supabase.from("pdv_permissions" as any).insert(
        keys.map((k) => ({ pdv_id: id, permission_key: k, allowed: true })),
      );
    }
    toast.success("Rôle du point de vente mis à jour");
    reload();
  };

  const togglePdvPerm = async (id: string, key: string, current: boolean) => {
    if (!canTogglePerm(key)) return;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      toast.error("Session expirée — reconnectez-vous pour modifier les permissions.");
      return;
    }
    const next = !current;
    const { data, error } = await supabase.from("pdv_permissions" as any).upsert(
      { pdv_id: id, permission_key: key, allowed: next },
      { onConflict: "pdv_id,permission_key" },
    ).select("pdv_id, permission_key, allowed");
    if (error) { toast.error("Erreur : " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Modification refusée : votre compte n'a pas le droit de modifier ce point de vente.");
      return;
    }
    setPdvPerms((previous) => {
      const updated = { ...previous };
      const permissionsForPdv = new Set(updated[id] ?? []);
      if (next) permissionsForPdv.add(key);
      else permissionsForPdv.delete(key);
      updated[id] = permissionsForPdv;
      return updated;
    });
    toast.success(next ? "Permission activée" : "Permission désactivée");
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
              disabled={!isAdmin}
              onBlur={(e) => e.target.value !== p.name && rename(p.id, e.target.value)}
            />
            <Input
              placeholder="Code d'accès"
              className="h-8 w-32"
              disabled={!isAdmin}
              onBlur={(e) => e.target.value && setPdvAccessCode(p.id, e.target.value)}
            />
            <Select
              value={pdvRoles[p.id] ?? "operator"}
              onValueChange={(v) => setPdvRole(p.id, v as AppRole)}
              disabled={!isAdmin}
            >
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="operator">Opérateur</SelectItem>
                <SelectItem value="viewer">Lecture</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setEditing({ id: p.id, name: p.name })}
            >
              {canEditPerms ? <Settings2 className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
              Permissions ({pdvPerms[p.id]?.size ?? 0})
            </Button>
            {p.id === pdvId && <Badge className="shrink-0">Actuel</Badge>}
            <Button variant="ghost" size="icon" className="shrink-0" disabled={!isAdmin} onClick={() => remove(p.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions du PDV {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-2">
              {!canEditPerms && (
                <p className="text-xs text-muted-foreground">Lecture seule — seul l'administrateur peut modifier.</p>
              )}
              {isRegionalAdmin && (
                <p className="text-xs text-muted-foreground">
                  Vous gérez les permissions de vos points de vente.
                </p>
              )}
              {visibleGroups.map((group) => (
                <div key={group.title} className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground pt-2 border-t">
                    {group.title}
                  </div>
                  {group.keys.map((key) => {
                    const perm = ALL_PERMISSIONS.find((p) => p.key === key);
                    if (!perm) return null;
                    const has = pdvPerms[editing.id]?.has(key) ?? false;
                    return (
                      <label key={key} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={has}
                          disabled={!canTogglePerm(key)}
                          onCheckedChange={() => togglePdvPerm(editing.id, key, has)}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{perm.label}</div>
                          <div className="text-xs text-muted-foreground">{key}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setEditing(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
