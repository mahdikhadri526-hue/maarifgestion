import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentPdvId, getStoredPdvId, setCurrentPdvId } from "@/lib/pdvStore";
import { DEFAULT_PDV_ID, ENABLE_MULTI_PDV, MULTI_PDV_ADMIN_ONLY } from "@/lib/featureFlags";

export interface Pdv {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export type AppRole = "admin" | "regional_admin" | "manager" | "operator" | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  regional_admin: "Admin régional",
  manager: "Manager",
  operator: "Opérateur",
  viewer: "Lecteur",
};

export const ROLE_ORDER: AppRole[] = ["admin", "regional_admin", "manager", "operator", "viewer"];

// Liste complète des permissions, regroupées par tableau / module de l'application.
export const PERMISSION_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Tableau de bord & rapports", keys: ["view_dashboard", "view_reports"] },
  { title: "Stock initial", keys: ["view_stock", "edit_stock", "delete_stock", "edit_remaining_stock"] },
  { title: "Mouvements", keys: ["view_movements", "edit_movements", "delete_movements"] },
  { title: "Réquisitions", keys: ["view_requisitions", "edit_requisitions", "delete_requisitions"] },
  { title: "Lots & DLC", keys: ["view_lots", "edit_lots", "delete_lots"] },
  { title: "Autocontrôle", keys: ["view_autocontrol", "edit_autocontrol", "delete_autocontrol"] },
  { title: "Réclamations & retours", keys: ["view_claims", "edit_claims", "delete_claims"] },
  { title: "Contrôle STUFFS de glace", keys: ["view_glace", "edit_glace", "delete_glace"] },
  { title: "Suivi hebdomadaire & transferts", keys: ["view_weekly", "edit_weekly", "delete_weekly"] },
  { title: "Températures frigos", keys: ["view_temperatures", "edit_temperatures", "delete_temperatures"] },
  { title: "Gestion des matériels – Température", keys: ["view_equipments", "edit_equipments", "delete_equipments"] },
  { title: "Catalogue produits – Alimentaire & Emballage", keys: ["view_products", "edit_products", "delete_products"] },
  { title: "Nettoyage", keys: ["view_cleaning", "edit_cleaning", "delete_cleaning"] },
  { title: "Inventaire", keys: ["view_inventory", "manage_inventory"] },
  { title: "Calcul des écarts", keys: ["view_ecarts", "edit_ecarts"] },
  { title: "Recettes & produits finis", keys: ["view_recipes", "edit_recipes"] },
  { title: "Agenda PEP", keys: ["view_pep", "manage_pep"] },
  { title: "Suivi Technique", keys: ["view_tech", "manage_tech"] },
  { title: "Pointage (reconnaissance faciale)", keys: ["view_attendance", "manage_attendance"] },
  { title: "RH — Plannings", keys: ["view_hr", "manage_hr"] },
  { title: "Planning", keys: ["view_planning", "manage_planning"] },
  { title: "Centre des anomalies", keys: ["view_anomalies"] },
  { title: "Administration", keys: ["manage_roster"] },
];

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
  { key: "view_claims", label: "Voir les réclamations & retours" },
  { key: "edit_claims", label: "Saisir / modifier les réclamations & retours" },
  { key: "delete_claims", label: "Supprimer des réclamations & retours" },
  { key: "view_glace", label: "Voir le contrôle STUFFS de glace" },
  { key: "edit_glace", label: "Saisir / modifier le contrôle STUFFS de glace" },
  { key: "delete_glace", label: "Supprimer du contrôle STUFFS de glace" },
  { key: "view_weekly", label: "Voir le suivi hebdomadaire (et transferts)" },
  { key: "edit_weekly", label: "Modifier le suivi hebdomadaire (et transferts)" },
  { key: "delete_weekly", label: "Supprimer du suivi hebdomadaire" },
  { key: "view_temperatures", label: "Voir les températures frigos" },
  { key: "edit_temperatures", label: "Modifier les températures frigos" },
  { key: "delete_temperatures", label: "Supprimer des températures frigos" },
  { key: "view_equipments", label: "Voir la gestion des matériels (température)" },
  { key: "edit_equipments", label: "Ajouter / modifier des matériels (température)" },
  { key: "delete_equipments", label: "Supprimer des matériels (température)" },
  { key: "view_products", label: "Voir le catalogue produits (alimentaire / emballage)" },
  { key: "edit_products", label: "Ajouter / modifier des produits (alimentaire / emballage)" },
  { key: "delete_products", label: "Supprimer des produits (alimentaire / emballage)" },
  { key: "view_reports", label: "Voir les rapports / stock restant" },
  { key: "view_recipes", label: "Voir les recettes / produits finis" },
  { key: "edit_recipes", label: "Modifier les recettes / produits finis" },
  { key: "view_cleaning", label: "Voir le suivi de nettoyage quotidien" },
  { key: "edit_cleaning", label: "Modifier le suivi de nettoyage quotidien" },
  { key: "delete_cleaning", label: "Supprimer du suivi de nettoyage quotidien" },
  { key: "view_inventory", label: "Participer à l'inventaire" },
  { key: "manage_inventory", label: "Gérer / rapprocher les inventaires" },
  { key: "manage_roster", label: "Ajouter / supprimer des noms (collaborateurs, effectué par, visa manager)" },
  { key: "view_ecarts", label: "Voir le calcul des écarts" },
  { key: "edit_ecarts", label: "Saisir / modifier le calcul des écarts" },
  { key: "view_pep", label: "Voir l'agenda PEP" },
  { key: "manage_pep", label: "Gestion Agenda PEP (tâches, fréquences, jours fériés)" },
  { key: "view_tech", label: "Voir le Suivi Technique" },
  { key: "manage_tech", label: "Suivi Technique — responsable technique (prise en charge, statuts, deadline)" },
  { key: "view_attendance", label: "Voir le pointage (reconnaissance faciale)" },
  { key: "manage_attendance", label: "Gérer le pointage (enrôler les employés, corriger les pointages)" },
  { key: "view_hr", label: "Voir le module RH (employés, horaires shifts, congés, rapports)" },
  { key: "manage_hr", label: "RH — vue globale tous PDV (employés, plannings managers/caissiers, congés, jours fériés)" },
  { key: "view_planning", label: "Voir la table Planning" },
  { key: "manage_planning", label: "Élaborer le planning des employés du PDV" },
  { key: "view_anomalies", label: "Voir le centre des anomalies" },
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number]["key"];

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  permissions: Set<string>;
  isAdmin: boolean;
  isRegionalAdmin: boolean;
  assignedPdvIds: string[];
  can: (key: string) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  pdvs: Pdv[];
  pdvId: string | null;
  pdv: Pdv | null;
  pdvLoading: boolean;
  multiPdvEnabled: boolean;
  selectPdv: (id: string | null) => void;
  refreshPdvs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = "app:lastActivity";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [pdvId, setPdvId] = useState<string | null>(
    ENABLE_MULTI_PDV ? getCurrentPdvId() : DEFAULT_PDV_ID,
  );
  const [pdvLoading, setPdvLoading] = useState(true);
  const [pdvPermissions, setPdvPermissions] = useState<Set<string> | null>(null);
  const [assignedPdvIds, setAssignedPdvIds] = useState<string[]>([]);
  const [assignedLoaded, setAssignedLoaded] = useState(false);

  const isAdmin = role === "admin";
  const isRegionalAdmin = role === "regional_admin";
  const multiPdvEnabled =
    ENABLE_MULTI_PDV || (MULTI_PDV_ADMIN_ONLY && (isAdmin || isRegionalAdmin));
  const assignedPdvId = assignedPdvIds[0] ?? null;

  // Bascule automatique selon le compte : admin => multi-PDV,
  // sinon PDV rattaché au compte (user_pdvs), ou PDV principal par défaut.
  useEffect(() => {
    if (multiPdvEnabled) {
      let stored = getStoredPdvId();
      if (isRegionalAdmin) {
        if (!assignedLoaded) return;
        if (!stored || !assignedPdvIds.includes(stored)) {
          stored = assignedPdvIds.length === 1 ? assignedPdvIds[0] : null;
        }
      }
      setCurrentPdvId(stored);
      setPdvId(stored);
    } else {
      if (!assignedLoaded) return;
      const target = assignedPdvId ?? DEFAULT_PDV_ID;
      setCurrentPdvId(target);
      setPdvId(target);
    }
  }, [multiPdvEnabled, isRegionalAdmin, assignedPdvIds, assignedPdvId, assignedLoaded]);

  useEffect(() => {
    let cancelled = false;
    if (!pdvId) {
      setPdvPermissions(null);
      return;
    }
    setPdvPermissions(null);
    supabase
      .from("pdv_permissions" as any)
      .select("permission_key, allowed")
      .eq("pdv_id", pdvId)
      .then(({ data }) => {
        if (cancelled) return;
        const set = new Set<string>();
        ((data ?? []) as any[]).forEach((p) => p.allowed && set.add(p.permission_key));
        setPdvPermissions(set);
      });
    return () => {
      cancelled = true;
    };
  }, [pdvId]);

  const multiPdvEnabledRef = useRef(multiPdvEnabled);
  multiPdvEnabledRef.current = multiPdvEnabled;

  const loadPdvs = useCallback(async () => {
    setPdvLoading(true);
    const { data } = await supabase.from("pdvs").select("id, code, name, active").order("name");
    const list = ((data ?? []) as Pdv[]).filter((p) => p.active);
    setPdvs(list);
    if (multiPdvEnabledRef.current) {
      const stored = getCurrentPdvId();
      if (stored && !list.some((p) => p.id === stored)) {
        setCurrentPdvId(null);
        setPdvId(null);
      }
    }
    setPdvLoading(false);
  }, []);

  const loadRoleAndPerms = useCallback(async (uid: string) => {
    const [{ data: roles }, { data: perms }, { data: userPdvs }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_permissions").select("permission_key, allowed").eq("user_id", uid),
      supabase.from("user_pdvs").select("pdv_id").eq("user_id", uid),
    ]);
    let r: AppRole | null = null;
    if (roles && roles.length > 0) {
      r = ROLE_ORDER.find((o) => roles.some((x: any) => x.role === o)) ?? (roles[0].role as AppRole);
    }
    setRole(r);
    const set = new Set<string>();
    (perms ?? []).forEach((p: any) => {
      if (p.allowed) set.add(p.permission_key);
    });
    setPermissions(set);
    setAssignedPdvIds(((userPdvs ?? []) as any[]).map((r) => r.pdv_id));
    setAssignedLoaded(true);
  }, []);

  const bootRef = useRef(false);
  const loadedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // Événements transitoires (refresh de jeton en échec réseau, retour
      // d'onglet…) : ne rien réinitialiser tant que ce n'est pas une vraie
      // déconnexion, sinon l'application semble « redémarrer » toute seule.
      if (!sess && event !== "SIGNED_OUT") return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // INITIAL_SESSION / TOKEN_REFRESHED n'apportent rien de neuf :
        // getSession() ci-dessous charge déjà rôle + PDV.
        if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
        // Même utilisateur déjà chargé : évite un rechargement complet
        // (et le remontage de l'interface) à chaque retour d'onglet.
        if (loadedUidRef.current === sess.user.id) return;
        loadedUidRef.current = sess.user.id;
        setTimeout(() => {
          loadRoleAndPerms(sess.user.id);
          loadPdvs();
        }, 0);
      } else {
        loadedUidRef.current = null;
        setRole(null);
        setPermissions(new Set());
        setPdvs([]);
        setAssignedPdvIds([]);
        setAssignedLoaded(false);
        if (ENABLE_MULTI_PDV || MULTI_PDV_ADMIN_ONLY) {
          setCurrentPdvId(null);
          setPdvId(null);
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        loadedUidRef.current = sess.user.id;
        loadRoleAndPerms(sess.user.id).finally(() => setLoading(false));
        loadPdvs();
      } else {
        setLoading(false);
        setPdvLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
    // Volontairement monté une seule fois : évite de relancer les requêtes
    // d'auth/PDV à chaque changement de rôle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const can = useCallback(
    (key: string) => {
      if (!user) return false;
      if (isAdmin) return true;
      if (isRegionalAdmin) return permissions.has(key);
      // Permissions individuelles (Gestion des utilisateurs) + permissions du
      // point de vente rattaché : les deux s'appliquent.
      return permissions.has(key) || (pdvPermissions?.has(key) ?? false);
    },
    [user, isAdmin, isRegionalAdmin, permissions, pdvPermissions],
  );

  const signOut = async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
  };

  // Déconnexion automatique après 5 minutes d'inactivité (tous les comptes).
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;

    const logout = () => {
      if (done) return;
      done = true;
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      supabase.auth.signOut().finally(() => {
        if (window.location.pathname !== "/") window.location.replace("/");
      });
    };

    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(logout, IDLE_TIMEOUT_MS);
    };

    const touch = () => {
      if (done) return;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      arm();
    };

    // Vérifie l'inactivité réelle (onglet en arrière-plan, appareil en veille,
    // rechargement de la page) à partir de l'horodatage persistant.
    const check = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (last && Date.now() - last >= IDLE_TIMEOUT_MS) logout();
      else if (!last) touch();
      else arm();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
      "pointerdown",
    ];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const interval = setInterval(check, 30_000);

    check();

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [user?.id]);

  const refresh = async () => {
    if (user) await loadRoleAndPerms(user.id);
  };

  const selectPdv = useCallback((id: string | null) => {
    if (!multiPdvEnabled) return;
    if (isRegionalAdmin && id && !assignedPdvIds.includes(id)) return;
    setCurrentPdvId(id);
    setPdvId(id);
  }, [multiPdvEnabled, isRegionalAdmin, assignedPdvIds]);

  const visiblePdvs = isRegionalAdmin ? pdvs.filter((p) => assignedPdvIds.includes(p.id)) : pdvs;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        permissions,
        isAdmin,
        isRegionalAdmin,
        assignedPdvIds,
        can,
        signOut,
        refresh,
        pdvs: visiblePdvs,
        pdvId,
        pdv: pdvs.find((p) => p.id === pdvId) ?? null,
        pdvLoading,
        multiPdvEnabled,
        selectPdv,
        refreshPdvs: loadPdvs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
