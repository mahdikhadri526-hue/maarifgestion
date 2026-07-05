import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PERMISSIONS, AppRole, useAuth } from "@/contexts/AuthContext";

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
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole | null>>({});
  const [perms, setPerms] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProfileRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profs }, { data: allRoles }, { data: allPerms }] = await Promise.all([
      supabase.from("profiles").select("user_id, email, display_name").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_permissions").select("user_id, permission_key, allowed"),
    ]);
    setUsers(profs ?? []);
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
    // Atomic role change via SECURITY DEFINER RPC (avoids losing role on failure)
    const { error } = await supabase.rpc("admin_set_user_role", {
      _target_user_id: userId,
      _new_role: role,
    });
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
                return (
                  <div key={u.user_id} className="flex items-center justify-between gap-3 p-3 border rounded-lg flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{u.display_name || u.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isMe && <Badge variant="secondary">Vous</Badge>}
                      <Select value={r} onValueChange={(v) => setUserRole(u.user_id, v as AppRole)} disabled={isMe}>
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
                      <Button variant="outline" size="sm" onClick={() => setEditing(u)} disabled={isMe || r === "admin"}>
                        <Settings2 className="h-4 w-4 mr-1" /> Permissions
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
