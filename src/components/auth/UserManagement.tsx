import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldCheck, Settings2, UserPlus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PERMISSIONS, AppRole, useAuth } from "@/contexts/AuthContext";
import { PdvManagement } from "@/components/pdv/PdvManagement";

const PROTECTED_EMAILS = ["gestionmaarif1@gmail.com"];

interface ProfileRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

const ROLE_PRESETS: Record<AppRole, string[]> = {
  admin: ALL_PERMISSIONS.map((p) => p.key),
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
  const { user: currentUser, multiPdvEnabled, pdvs } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole | null>>({});
  const [perms, setPerms] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [userPdvs, setUserPdvs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("operator");
  const [newPdv, setNewPdv] = useState<string>("");
  const [pwdTarget, setPwdTarget] = useState<ProfileRow | null>(null);
  const [pwdValue, setPwdValue] = useState("");

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
    const upMap: Record<string, string> = {};
    ((allUserPdvs ?? []) as any[]).forEach((r) => { upMap[r.user_id] = r.pdv_id; });
    setUserPdvs(upMap);
    const rMap: Record<string, AppRole | null> = {};
    const order: AppRole[] = ["admin", "manager", "operator", "viewer"];
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
    load();
  }, []);

  const setUserRole = async (userId: string, role: AppRole) => {
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
    if (current) {
      await supabase.from("user_permissions").delete().eq("user_id", userId).eq("permission_key", key);
    } else {
      await supabase.from("user_permissions").upsert(
        { user_id: userId, permission_key: key, allowed: true },
        { onConflict: "user_id,permission_key" },
      );
    }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Gestion des utilisateurs
        </h2>
      </div>

      <Card>
        <CardHeader>
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
        <CardHeader>
          <CardTitle className="text-base">Utilisateurs ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <div className="space-y-3">
              {users.map((u) => {
                const r = roles[u.user_id] ?? "viewer";
                const isMe = u.user_id === currentUser?.id;
                const locked = isProtected(u.email);
                return (
                  <div key={u.user_id} className="flex items-center justify-between gap-3 p-3 border rounded-lg flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{u.display_name || u.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isMe && <Badge variant="secondary">Vous</Badge>}
                      {locked && <Badge variant="outline">Protégé</Badge>}
                      <Select
                        value={userPdvs[u.user_id] ?? ""}
                        onValueChange={(v) => assignPdv(u.user_id, v)}
                        disabled={locked || busy}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Point de vente" />
                        </SelectTrigger>
                        <SelectContent>
                          {pdvs.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={r} onValueChange={(v) => setUserRole(u.user_id, v as AppRole)} disabled={isMe || locked}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="operator">Opérateur</SelectItem>
                          <SelectItem value="viewer">Lecteur</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => setEditing(u)} disabled={isMe || r === "admin" || locked}>
                        <Settings2 className="h-4 w-4 mr-1" /> Permissions
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setPwdTarget(u); setPwdValue(""); }} disabled={locked}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteUser(u)}
                        disabled={isMe || locked || busy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {multiPdvEnabled && <PdvManagement onChanged={load} />}

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
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissions de {editing?.display_name || editing?.email}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-2">
              {ALL_PERMISSIONS.map((p) => {
                const has = perms[editing.user_id]?.has(p.key) ?? false;
                return (
                  <label key={p.key} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={has} onCheckedChange={() => togglePerm(editing.user_id, p.key, has)} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.key}</div>
                    </div>
                  </label>
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
