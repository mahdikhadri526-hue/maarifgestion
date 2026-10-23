import { useEffect, useState } from "react";
import { Building2, Trash2, Settings2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CLEANING_ZONES, CLEANING_ZONE_OFF_PREFIX } from "@/lib/cleaningData";
import { ZONES as FRIDGE_ZONES, FRIDGE_ZONE_OFF_PREFIX } from "@/lib/fridgeData";
import { Thermometer, Plus, RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { addCustomZone, deleteCustomZone, fetchCustomZones, type CustomZone } from "@/lib/pdvZones";
import { ALL_PERMISSIONS, publishedPermissionGroups, AppRole, useAuth } from "@/contexts/AuthContext";

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
  const { pdvs, refreshPdvs, pdvId, hasAdminRole, isRegionalAdmin, permissions, can, user } = useAuth();
  const canEditPerms = hasAdminRole || isRegionalAdmin;
  // Chaque compte ne voit que les permissions qu'il détient lui-même.
  const visibleGroups = hasAdminRole
    ? publishedPermissionGroups()
    : publishedPermissionGroups().map((g) => ({ ...g, keys: g.keys.filter((k) => can(k)) })).filter(
        (g) => g.keys.length > 0,
      );
  const canTogglePerm = (_key: string) => hasAdminRole || isRegionalAdmin;
  const [pdvRoles, setPdvRoles] = useState<Record<string, AppRole>>({});
  const [pdvPerms, setPdvPerms] = useState<Record<string, Set<string>>>({});
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [zonesFor, setZonesFor] = useState<{ id: string; name: string } | null>(null);
  const [fridgeZonesFor, setFridgeZonesFor] = useState<{ id: string; name: string } | null>(null);

  const [customZones, setCustomZones] = useState<CustomZone[]>([]);
  const [newZone, setNewZone] = useState("");
  const [newTasks, setNewTasks] = useState("");
  const loadCustomZones = async () => {
    const ids = pdvs.map((p) => p.id);
    const all: CustomZone[] = [];
    for (const id of ids) { try { all.push(...(await fetchCustomZones(id))); } catch { /* ignore */ } }
    setCustomZones(all);
  };
  useEffect(() => { void loadCustomZones(); }, [pdvs.length]);
  const zonesOf = (pdv: string, kind: "cleaning" | "fridge") => customZones.filter((z) => z.pdvId === pdv && z.kind === kind);

  const submitZone = async (pdv: string, kind: "cleaning" | "fridge") => {
    const label = newZone.trim();
    if (!label) return;
    const tasks = newTasks.split("\n").map((t) => t.trim()).filter(Boolean);
    if (kind === "cleaning" && tasks.length === 0) { toast.error("Ajoutez au moins une tâche (une par ligne)."); return; }
    const exists = kind === "cleaning"
      ? CLEANING_ZONES.some((z) => z.label.toLowerCase() === label.toLowerCase()) || zonesOf(pdv, kind).some((z) => z.label.toLowerCase() === label.toLowerCase())
      : FRIDGE_ZONES.some((z) => z.toLowerCase() === label.toLowerCase()) || zonesOf(pdv, kind).some((z) => z.label.toLowerCase() === label.toLowerCase());
    if (exists) { toast.error("Cette zone existe déjà."); return; }
    try {
      await addCustomZone(pdv, kind, label, kind === "cleaning" ? tasks : []);
      setNewZone(""); setNewTasks("");
      toast.success("Zone ajoutée");
      await loadCustomZones();
    } catch (e: any) { toast.error("Erreur : " + (e?.message ?? "ajout impossible")); }
  };

  const removeCustomZone = async (z: CustomZone) => {
    if (!confirm(`Supprimer la zone « ${z.label} » ? L'historique déjà saisi est conservé.`)) return;
    try { await deleteCustomZone(z.id); toast.success("Zone supprimée"); await loadCustomZones(); }
    catch (e: any) { toast.error("Erreur : " + (e?.message ?? "suppression impossible")); }
  };

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
    await supabase.from("pdv_permissions" as any).delete().eq("pdv_id", id).not("permission_key", "like", `${CLEANING_ZONE_OFF_PREFIX}%`).not("permission_key", "like", `${FRIDGE_ZONE_OFF_PREFIX}%`);
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

  const HIDDEN_PDVS = ["admin mohammedia", "mohammedia", "miramar", "mansouria"];
  const HIDDEN_ACCOUNTS = ["oliverimohammedia2016", "oliverimohammedia2026", "gestion-mohammedia", "gestion-miramar", "gestion-mansouria"];
  const meHidden = HIDDEN_ACCOUNTS.includes((user?.email ?? "").toLowerCase().split("@")[0]);
  const visiblePdvs = meHidden
    ? pdvs
    : pdvs.filter((p) => !HIDDEN_PDVS.includes(p.name.trim().toLowerCase()));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Points de vente ({visiblePdvs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visiblePdvs.map((p) => (
          <div key={p.id} className="flex items-center gap-2 p-2 border rounded-lg flex-wrap">
            <Badge variant="secondary" className="shrink-0">{p.code}</Badge>
            <Input
              defaultValue={p.name}
              className="h-8 flex-1 min-w-[140px]"
              disabled={!hasAdminRole}
              onBlur={(e) => e.target.value !== p.name && rename(p.id, e.target.value)}
            />
            <Input
              placeholder="Code d'accès"
              className="h-8 w-32"
              disabled={!hasAdminRole}
              onBlur={(e) => e.target.value && setPdvAccessCode(p.id, e.target.value)}
            />
            <Select
              value={pdvRoles[p.id] ?? "operator"}
              onValueChange={(v) => setPdvRole(p.id, v as AppRole)}
              disabled={!hasAdminRole}
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
              Permissions ({[...(pdvPerms[p.id] ?? [])].filter((k) => !k.startsWith(CLEANING_ZONE_OFF_PREFIX) && !k.startsWith(FRIDGE_ZONE_OFF_PREFIX)).length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setZonesFor({ id: p.id, name: p.name })}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Zones nettoyage ({CLEANING_ZONES.filter((z) => !pdvPerms[p.id]?.has(CLEANING_ZONE_OFF_PREFIX + z.key)).length + zonesOf(p.id, "cleaning").length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setFridgeZonesFor({ id: p.id, name: p.name })}
            >
              <Thermometer className="h-4 w-4 mr-1" />
              Zones température ({FRIDGE_ZONES.filter((z) => !pdvPerms[p.id]?.has(FRIDGE_ZONE_OFF_PREFIX + z)).length + zonesOf(p.id, "fridge").length})
            </Button>
            {p.id === pdvId && <Badge className="shrink-0">Actuel</Badge>}
            <Button variant="ghost" size="icon" className="shrink-0" disabled={!hasAdminRole} onClick={() => remove(p.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!zonesFor} onOpenChange={(o) => !o && setZonesFor(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zones de nettoyage — {zonesFor?.name}</DialogTitle>
          </DialogHeader>
          {zonesFor && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground pb-2">
                Ajoutez ou supprimez les zones de nettoyage de ce PDV. Les saisies déjà faites sont conservées.
              </p>
              {CLEANING_ZONES.map((z) => {
                const offKey = CLEANING_ZONE_OFF_PREFIX + z.key;
                const off = pdvPerms[zonesFor.id]?.has(offKey) ?? false;
                return (
                  <div key={z.key} className="flex items-center justify-between gap-3 p-2 rounded border">
                    <div className={"text-sm font-medium " + (off ? "line-through text-muted-foreground" : "")}>{z.label}</div>
                    {canEditPerms && (off ? (
                      <Button variant="ghost" size="sm" onClick={() => togglePdvPerm(zonesFor.id, offKey, off)}>
                        <RotateCcw className="h-4 w-4 mr-1" />Restaurer
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Supprimer cette zone de ce PDV ? L'historique est conservé.")) togglePdvPerm(zonesFor.id, offKey, off); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ))}
                  </div>
                );
              })}
              {zonesOf(zonesFor.id, "cleaning").map((z) => (
                <div key={z.id} className="flex items-center justify-between gap-3 p-2 rounded border">
                  <div className="text-sm font-medium">{z.label}{z.tasks.length > 0 && <span className="text-xs text-muted-foreground"> — {z.tasks.length} tâche(s)</span>}</div>
                  {canEditPerms && (
                    <Button variant="ghost" size="icon" onClick={() => removeCustomZone(z)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {canEditPerms && (
                <div className="space-y-2 pt-3 border-t mt-2">
                  <div className="text-sm font-medium">Ajouter une zone</div>
                  <Input placeholder="Nom de la zone" value={newZone} onChange={(e) => setNewZone(e.target.value)} />
                  {"cleaning" === "cleaning" && (
                    <Textarea placeholder="Tâches (une par ligne)" rows={4} value={newTasks} onChange={(e) => setNewTasks(e.target.value)} />
                  )}
                  <Button size="sm" onClick={() => submitZone(zonesFor.id, "cleaning")} disabled={!newZone.trim()}>
                    <Plus className="h-4 w-4 mr-1" />Ajouter
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setZonesFor(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fridgeZonesFor} onOpenChange={(o) => !o && setFridgeZonesFor(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zones température — {fridgeZonesFor?.name}</DialogTitle>
          </DialogHeader>
          {fridgeZonesFor && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground pb-2">
                Ajoutez ou supprimez les zones température de ce PDV. Les relevés déjà faits sont conservés.
              </p>
              {FRIDGE_ZONES.map((z) => {
                const offKey = FRIDGE_ZONE_OFF_PREFIX + z;
                const off = pdvPerms[fridgeZonesFor.id]?.has(offKey) ?? false;
                return (
                  <div key={z} className="flex items-center justify-between gap-3 p-2 rounded border">
                    <div className={"text-sm font-medium " + (off ? "line-through text-muted-foreground" : "")}>{z}</div>
                    {canEditPerms && (off ? (
                      <Button variant="ghost" size="sm" onClick={() => togglePdvPerm(fridgeZonesFor.id, offKey, off)}>
                        <RotateCcw className="h-4 w-4 mr-1" />Restaurer
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Supprimer cette zone de ce PDV ? L'historique est conservé.")) togglePdvPerm(fridgeZonesFor.id, offKey, off); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ))}
                  </div>
                );
              })}
              {zonesOf(fridgeZonesFor.id, "fridge").map((z) => (
                <div key={z.id} className="flex items-center justify-between gap-3 p-2 rounded border">
                  <div className="text-sm font-medium">{z.label}{z.tasks.length > 0 && <span className="text-xs text-muted-foreground"> — {z.tasks.length} tâche(s)</span>}</div>
                  {canEditPerms && (
                    <Button variant="ghost" size="icon" onClick={() => removeCustomZone(z)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {canEditPerms && (
                <div className="space-y-2 pt-3 border-t mt-2">
                  <div className="text-sm font-medium">Ajouter une zone</div>
                  <Input placeholder="Nom de la zone" value={newZone} onChange={(e) => setNewZone(e.target.value)} />
                  {"fridge" === "cleaning" && (
                    <Textarea placeholder="Tâches (une par ligne)" rows={4} value={newTasks} onChange={(e) => setNewTasks(e.target.value)} />
                  )}
                  <Button size="sm" onClick={() => submitZone(fridgeZonesFor.id, "fridge")} disabled={!newZone.trim()}>
                    <Plus className="h-4 w-4 mr-1" />Ajouter
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setFridgeZonesFor(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
