import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "operator" | "viewer";

export const ALL_PERMISSIONS = [
  { key: "view_dashboard", label: "Voir le tableau de bord" },
  { key: "view_stock", label: "Voir le stock initial" },
  { key: "edit_stock", label: "Modifier le stock initial" },
  { key: "delete_stock", label: "Supprimer du stock initial" },
  { key: "edit_remaining_stock", label: "Modifier le stock restant" },
  { key: "view_movements", label: "Voir les mouvements" },
  { key: "edit_movements", label: "Ajouter / modifier des mouvements" },
  { key: "delete_movements", label: "Supprimer des mouvements" },
  { key: "view_requisitions", label: "Voir les réquisitions" },
  { key: "edit_requisitions", label: "Ajouter / modifier des réquisitions" },
  { key: "delete_requisitions", label: "Supprimer des réquisitions" },
  { key: "view_lots", label: "Voir les lots / DLC" },
  { key: "edit_lots", label: "Modifier les lots" },
  { key: "delete_lots", label: "Supprimer des lots" },
  { key: "view_autocontrol", label: "Voir l'autocontrôle" },
  { key: "edit_autocontrol", label: "Modifier l'autocontrôle" },
  { key: "delete_autocontrol", label: "Supprimer de l'autocontrôle" },
  { key: "view_weekly", label: "Voir le suivi hebdomadaire" },
  { key: "edit_weekly", label: "Modifier le suivi hebdomadaire" },
  { key: "delete_weekly", label: "Supprimer du suivi hebdomadaire" },
  { key: "view_temperatures", label: "Voir les températures frigos" },
  { key: "edit_temperatures", label: "Modifier les températures frigos" },
  { key: "delete_temperatures", label: "Supprimer des températures frigos" },
  { key: "view_reports", label: "Voir les rapports / stock restant" },
  { key: "view_recipes", label: "Voir les recettes / produits finis" },
  { key: "edit_recipes", label: "Modifier les recettes / produits finis" },
  { key: "view_cleaning", label: "Voir le suivi de nettoyage quotidien" },
  { key: "edit_cleaning", label: "Modifier le suivi de nettoyage quotidien" },
  { key: "delete_cleaning", label: "Supprimer du suivi de nettoyage quotidien" },
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number]["key"];

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  permissions: Set<string>;
  isAdmin: boolean;
  can: (key: string) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadRoleAndPerms = useCallback(async (uid: string) => {
    const [{ data: roles }, { data: perms }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_permissions").select("permission_key, allowed").eq("user_id", uid),
    ]);
    let r: AppRole | null = null;
    if (roles && roles.length > 0) {
      const order: AppRole[] = ["admin", "manager", "operator", "viewer"];
      r = order.find((o) => roles.some((x) => x.role === o)) ?? (roles[0].role as AppRole);
    }
    setRole(r);
    const set = new Set<string>();
    (perms ?? []).forEach((p: any) => {
      if (p.allowed) set.add(p.permission_key);
    });
    setPermissions(set);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadRoleAndPerms(sess.user.id), 0);
      } else {
        setRole(null);
        setPermissions(new Set());
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        loadRoleAndPerms(sess.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadRoleAndPerms]);

  const isAdmin = role === "admin";

  const can = useCallback(
    (key: string) => {
      if (!user) return false;
      if (isAdmin) return true;
      return permissions.has(key);
    },
    [user, isAdmin, permissions],
  );

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadRoleAndPerms(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, permissions, isAdmin, can, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
