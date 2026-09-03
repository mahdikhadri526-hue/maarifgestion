import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ShieldCheck, Settings2, UserPlus, Trash2, KeyRound, Search, Store, Users, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PERMISSIONS, AppRole, useAuth } from "@/contexts/AuthContext";
import { PdvManagement } from "@/components/pdv/PdvManagement";
import { RosterManagement } from "@/components/roster/RosterManagement";

const PROTECTED_EMAILS = ["gestionmaarif1@gmail.com"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  regional_admin: "Admin régional",
  manager: "Manager",
  operator: "Opérateur",
  viewer: "Lecteur",
};

const PERMISSION_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Tableau de bord & rapports", keys: ["view_dashboard", "view_reports"] },
  { title: "Stock", keys: ["view_stock", "edit_stock", "delete_stock", "edit_remaining_stock"] },
  { title: "Mouvements", keys: ["view_movements", "edit_movements", "delete_movements"] },
  { title: "Réquisitions", keys: ["view_requisitions", "edit_requisitions", "delete_requisitions"] },
  { title: "Lots & DLC", keys: ["view_lots", "edit_lots", "delete_lots"] },
  { title: "Autocontrôle", keys: ["view_autocontrol", "edit_autocontrol", "delete_autocontrol"] },
  { title: "Suivi hebdomadaire", keys: ["view_weekly", "edit_weekly", "delete_weekly"] },
  { title: "Températures", keys: ["view_temperatures", "edit_temperatures", "delete_temperatures"] },
  { title: "Gestion des matériels – Température", keys: ["view_equipments", "edit_equipments", "delete_equipments"] },
  { title: "Catalogue produits – Alimentaire & Emballage", keys: ["view_products", "edit_products", "delete_products"] },
  { title: "Nettoyage", keys: ["view_cleaning", "edit_cleaning", "delete_cleaning"] },
  { title: "Inventaire", keys: ["view_inventory", "manage_inventory"] },
  { title: "Calcul des écarts", keys: ["view_ecarts", "edit_ecarts"] },
  { title: "Recettes", keys: ["view_recipes", "edit_recipes"] },
  { title: "Agenda PEP", keys: ["view_pep", "manage_pep"] },
  { title: "Suivi Technique", keys: ["view_tech", "manage_tech"] },
  { title: "Administration", keys: ["manage_roster"] },
];

interface ProfileRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

const ROLE_PRESETS: Record<AppRole, string[]> = {
  admin: ALL_PERMISSIONS.map((p) => p.key),
  regional_admin: ALL_PERMISSIONS.map((p) => p.key),
  manager: [
    "view_dashboard", "view_stock", "edit_stock",
    "view_movements", "edit_movements", "delete_movements",
    "view_requisitions", "edit_requisitions", "delete_requisitions",
    "view_lots", "edit_lots", "delete_lots",
    "view_autocontrol", "edit_autocontrol",
    "view_weekly", "edit_weekly",
    "view_temperatures", "edit_temperatures",
    "view_reports",
    "view_recipes", "edit_recipes",
  ],
  operator: [
    "view_dashboard", "view_movements", "edit_movements",
    "view_requisitions", "edit_requisitions",
    "view_lots", "edit_lots",
    "view_autocontrol", "edit_autocontrol",
    "view_weekly", "edit_weekly",
    "view_temperatures", "edit_temperatures",
  ],
  viewer: ["view_dashboard"],
};

export function UserManagement({ onBack }: { onBack: () => void }) {
  const { user: currentUser, multiPdvEnabled, pdvs, isAdmin, can } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole | null>>({});
  const [perms, setPerms] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [userPdvs, setUserPdvs] = useState<Record<string, string[]>>({});
  const [pdvEditing, setPdvEditing] = useState<ProfileRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("operator");
  const [newPdv, setNewPdv] = useState<string>("");
  const [pwdTarget, setPwdTarget] = useState<ProfileRow | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [search, setSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const isProtected = (email?: string | null) =>
    !!email && PROTECTED_EMAILS.includes(email.toLowerCase());

  const callAdmin = async (payload: Record<string, unknown>) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    setBusy(false);
    if (error) {
      const msg = (data as any)?.error ?? error.message;
      toast.error("Erreur : " + msg);
      return false;
    }
    if ((data as any)?.error) {
      toast.error("Erreur : " + (data as any).error);
      return false;
    }
    return true;
  };

  const load = async () => {
    setLoading(true);
    const [{ data: profs }, { data: allRoles }, { data: allPerms }, { data: allUserPdvs }] = await Promise.all([
      supabase.from("profiles").select("user_id, email, display_name").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_permissions").select("user_id, permission_key, allowed"),
      supabase.from("user_pdvs").select("user_id, pdv_id"),
    ]);
    setUsers(profs ?? []);
    const upMap: Record<string, string[]> = {};
    ((allUserPdvs ?? []) as any[]).forEach((r) => {
      (upMap[r.user_id] ??= []).push(r.pdv_id);
    });
    setUserPdvs(upMap);
    const rMap: Record<string, AppRole | null> = {};
    const order: AppRole[] = ["admin", "regional_admin", "manager", "operator", "viewer"];
    (allRoles ?? []).forEach((r: any) => {
      const cur = rMap[r.user_id];
      if (!cur || order.indexOf(r.role) < order.indexOf(cur)) rMap[r.user_id] = r.role;
    });
    setRoles(rMap);
    const pMap: Record<string, Set<string>> = {};
    (allPerms ?? []).forEach((p: any) => {
      if (!pMap[p.user_id]) pMap[p.user_id] = new Set();
      if (p.allowed) pMap[p.user_id].add(p.permission_key);
    });
    setPerms(pMap);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, []);

  const setUserRole = async (userId: string, role: AppRole) => {
    if (role === "regional_admin") {
      const others = Object.entries(roles).filter(([id, r]) => r === "regional_admin" && id !== userId);
      if (others.length >= 2) {
        toast.error("Limite atteinte : 2 comptes Admin régional maximum");
        return;
      }
    }
    // remove existing roles
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    // apply preset permissions
    await supabase.from("user_permissions").delete().eq("user_id", userId);
    const presetKeys = ROLE_PRESETS[role];
    if (presetKeys.length > 0) {
      await supabase.from("user_permissions").insert(
        presetKeys.map((k) => ({ user_id: userId, permission_key: k, allowed: true })),
      );
    }
    toast.success("Rôle mis à jour");
    load();
  };

  const togglePerm = async (userId: string, key: string, current: boolean) => {
    // Mise à jour optimiste pour un retour visuel immédiat
    setPerms((prev) => {
      const next = new Set(prev[userId] ?? []);
      if (current) next.delete(key); else next.add(key);
      return { ...prev, [userId]: next };
    });
    const { error } = current
      ? await supabase.from("user_permissions").delete().eq("user_id", userId).eq("permission_key", key)
      : await supabase.from("user_permissions").upsert(
          { user_id: userId, permission_key: key, allowed: true },
          { onConflict: "user_id,permission_key" },
        );
    if (error) toast.error("Erreur : " + error.message);
    load();
  };

  const createUser = async () => {
    if (!newEmail.trim() || newPassword.length < 6) {
      toast.error("Email et mot de passe (6 caractères minimum) requis");
      return;
    }
    const ok = await callAdmin({
      action: "create",
      email: newEmail.trim(),
      password: newPassword,
      role: newRole,
      pdv_id: newPdv || null,
    });
    if (!ok) return;
    toast.success("Utilisateur créé");
    setNewEmail(""); setNewPassword(""); setNewPdv("");
    load();
  };

  const deleteUser = async (u: ProfileRow) => {
    if (!confirm(`Supprimer définitivement ${u.email} ?`)) return;
    const ok = await callAdmin({ action: "delete", user_id: u.user_id });
    if (!ok) return;
    toast.success("Utilisateur supprimé");
    load();
  };

  const changePassword = async () => {
    if (!pwdTarget) return;
    const ok = await callAdmin({ action: "password", user_id: pwdTarget.user_id, password: pwdValue });
    if (!ok) return;
    toast.success("Mot de passe mis à jour");
    setPwdTarget(null); setPwdValue("");
  };

  const assignPdv = async (userId: string, pdvIdValue: string) => {
    const ok = await callAdmin({ action: "assign_pdv", user_id: userId, pdv_id: pdvIdValue || null });
    if (!ok) return;
    toast.success("Point de vente mis à jour");
    load();
  };

  const toggleUserPdv = async (userId: string, pdvIdValue: string) => {
    const current = userPdvs[userId] ?? [];
    const next = current.includes(pdvIdValue)
      ? current.filter((x) => x !== pdvIdValue)
      : [...current, pdvIdValue];
    setUserPdvs((prev) => ({ ...prev, [userId]: next }));
    const ok = await callAdmin({ action: "assign_pdvs", user_id: userId, pdv_ids: next });
    if (!ok) {
      setUserPdvs((prev) => ({ ...prev, [userId]: current }));
      return;
    }
    load();
  };

  const setGroupPerms = async (userId: string, keys: string[], enable: boolean) => {
    const { error } = enable
      ? await supabase.from("user_permissions").upsert(
          keys.map((k) => ({ user_id: userId, permission_key: k, allowed: true })),
          { onConflict: "user_id,permission_key" },
        )
      : await supabase.from("user_permissions").delete().eq("user_id", userId).in("permission_key", keys);
    if (error) toast.error("Erreur : " + error.message);
    load();
  };

  const permLabel = (key: string) =>
    ALL_PERMISSIONS.find((p) => p.key === key)?.label ?? key;

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.display_name ?? "").toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || (roles[u.user_id] ?? "viewer") === roleFilter;
    return matchQ && matchRole;
  });

  const renderUserRow = (u: ProfileRow) => {
    const r = roles[u.user_id] ?? "viewer";
    const isMe = u.user_id === currentUser?.id;
    const locked = isProtected(u.email);
    const assigned = userPdvs[u.user_id] ?? [];
    const permCount = perms[u.user_id]?.size ?? 0;
    return (
      <div
        key={u.user_id}
        className="rounded-lg border bg-card p-3 space-y-3 transition-colors hover:border-primary/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{u.display_name || u.email}</span>
              {isMe && <Badge variant="secondary">Vous</Badge>}
              {locked && <Badge variant="outline">Protégé</Badge>}
              <Badge variant={r === "admin" || r === "regional_admin" ? "default" : "secondary"}>
                {ROLE_LABELS[r]}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {assigned.length > 0
                ? assigned.map((id) => pdvs.find((p) => p.id === id)?.name ?? "—").join(" · ")
                : "Aucun point de vente"}
              {r !== "admin" && ` — ${permCount} permission${permCount > 1 ? "s" : ""}`}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              title="Changer le mot de passe"
              onClick={() => { setPwdTarget(u); setPwdValue(""); }}
              disabled={locked}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              title="Supprimer l'utilisateur"
              onClick={() => deleteUser(u)}
              disabled={isMe || locked || busy}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Rôle</label>
            <Select value={r} onValueChange={(v) => setUserRole(u.user_id, v as AppRole)} disabled={isMe || locked}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="regional_admin">Admin régional</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="operator">Opérateur</SelectItem>
                <SelectItem value="viewer">Lecteur</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Point(s) de vente</label>
            {r === "regional_admin" ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 justify-start"
                onClick={() => setPdvEditing(u)}
                disabled={locked || busy}
              >
                <Store className="h-4 w-4 mr-2" /> {assigned.length} sélectionné(s)
              </Button>
            ) : (
              <Select
                value={assigned[0] ?? ""}
                onValueChange={(v) => assignPdv(u.user_id, v)}
                disabled={locked || busy}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Point de vente" /></SelectTrigger>
                <SelectContent>
                  {pdvs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Permissions</label>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 justify-start"
              onClick={() => { setPermSearch(""); setEditing(u); }}
              disabled={isMe || r === "admin" || locked}
            >
              <Settings2 className="h-4 w-4 mr-2" /> Configurer
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {isAdmin ? "Gestion des utilisateurs" : "Permissions de mes points de vente"}
        </h2>
      </div>

      {!isAdmin && (
        <div className="space-y-4">
          {multiPdvEnabled && <PdvManagement />}
          {can("manage_roster") && <RosterManagement />}
        </div>
      )}

      {isAdmin && (
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" /> Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="pdvs" className="gap-2">
              <Store className="h-4 w-4" /> Points de vente
            </TabsTrigger>
            <TabsTrigger value="roster" className="gap-2">
              <ListChecks className="h-4 w-4" /> Listes de noms
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4 mt-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" /> Ajouter un utilisateur
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-5">
                <Input placeholder="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <Input placeholder="Mot de passe" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="regional_admin">Admin régional</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="operator">Opérateur</SelectItem>
                    <SelectItem value="viewer">Lecteur</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newPdv} onValueChange={setNewPdv}>
                  <SelectTrigger><SelectValue placeholder="Point de vente" /></SelectTrigger>
                  <SelectContent>
                    {pdvs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={createUser} disabled={busy}>Créer</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 space-y-3">
                <CardTitle className="text-base">
                  Utilisateurs ({filteredUsers.length}/{users.length})
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un utilisateur…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les rôles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="regional_admin">Admin régional</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="operator">Opérateur</SelectItem>
                      <SelectItem value="viewer">Lecteur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
                ) : (
                  <div className="space-y-3">{filteredUsers.map(renderUserRow)}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdvs" className="mt-0">
            {multiPdvEnabled ? (
              <PdvManagement onChanged={load} />
            ) : (
              <Card><CardContent className="py-6 text-sm text-muted-foreground">Le mode multi-PDV est désactivé.</CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="roster" className="mt-0">
            <RosterManagement />
          </TabsContent>
        </Tabs>
      )}


      <Dialog open={!!pdvEditing} onOpenChange={(o) => !o && setPdvEditing(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Points de vente — {pdvEditing?.display_name || pdvEditing?.email}</DialogTitle>
          </DialogHeader>
          {pdvEditing && (
            <div className="space-y-1">
              {pdvs.map((p) => {
                const checked = (userPdvs[pdvEditing.user_id] ?? []).includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleUserPdv(pdvEditing.user_id, p.id)}
                      disabled={busy}
                    />
                    <span className="text-sm">{p.name}</span>
                  </label>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPdvEditing(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwdTarget} onOpenChange={(o) => !o && setPwdTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouveau mot de passe — {pwdTarget?.email}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nouveau mot de passe"
            value={pwdValue}
            onChange={(e) => setPwdValue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdTarget(null)}>Annuler</Button>
            <Button onClick={changePassword} disabled={busy || pwdValue.length < 6}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions — {editing?.display_name || editing?.email}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              {(userPdvs[editing.user_id]?.length ?? 0) > 0 && roles[editing.user_id] !== "regional_admin" && (
                <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                  Ces permissions individuelles s'ajoutent à celles du point de vente rattaché (onglet « Points de vente »).
                  L'utilisateur doit se reconnecter ou actualiser pour voir le changement.
                </p>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrer les permissions…"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              {PERMISSION_GROUPS.map((g) => {
                const q = permSearch.trim().toLowerCase();
                const keys = g.keys.filter(
                  (k) => !q || permLabel(k).toLowerCase().includes(q) || k.includes(q),
                );
                if (keys.length === 0) return null;
                const userPerms = perms[editing.user_id];
                const allOn = keys.every((k) => userPerms?.has(k));
                return (
                  <div key={g.title} className="rounded-lg border">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 rounded-t-lg">
                      <span className="text-sm font-semibold">{g.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setGroupPerms(editing.user_id, keys, !allOn)}
                      >
                        {allOn ? "Tout décocher" : "Tout cocher"}
                      </Button>
                    </div>
                    <div className="p-1">
                      {keys.map((k) => {
                        const has = userPerms?.has(k) ?? false;
                        return (
                          <label
                            key={k}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox checked={has} onCheckedChange={() => togglePerm(editing.user_id, k, has)} />
                            <span className="text-sm flex-1">{permLabel(k)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setEditing(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
