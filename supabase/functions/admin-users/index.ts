import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROTECTED_EMAILS = ["gestionmaarif1@gmail.com"];

const validatePassword = (password: string) => {
  if (password.length < 6) return "Le mot de passe doit contenir au moins 6 caractères.";
  return null;
};

const authErrorMessage = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("known to be weak") || normalized.includes("easy to guess")) {
    return "Ce mot de passe est trop courant ou facile à deviner. Choisissez-en un autre, unique pour ce compte.";
  }
  if (normalized.includes("invalid format") && normalized.includes("email")) {
    return "L’adresse email n’est pas valide. Vérifiez les espaces, le @ et le nom de domaine.";
  }
  return message;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Non authentifié" }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: isAdminData } = await admin.rpc("is_admin", { _user_id: user.id });
  const { data: isRegionalData } = await admin.rpc("is_regional_admin", { _user_id: user.id });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const action = body?.action as string;

  // Admin régional : uniquement le changement de mot de passe.
  const regionalPassword = !isAdminData && isRegionalData && action === "password";
  if (!isAdminData && !regionalPassword) return json({ error: "Accès réservé à l'administrateur" }, 403);
  if (regionalPassword) {
    const { data: shared } = await admin.rpc("shares_pdv", { _viewer: user.id, _target: String(body.user_id ?? "") });
    if (!shared) return json({ error: "Cet utilisateur n'appartient pas à vos points de vente" }, 403);
  }

  const isProtected = (email?: string | null) =>
    !!email && PROTECTED_EMAILS.includes(email.toLowerCase());

  const getTargetEmail = async (userId: string) => {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  };

  try {
    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const pdvId = body.pdv_id ? String(body.pdv_id) : null;
      const role = String(body.role ?? "viewer");
      const pdvIds: string[] = Array.isArray(body.pdv_ids) ? body.pdv_ids.map(String) : [];
      if (!email) return json({ error: "L’adresse email est requise." }, 400);
      const passwordValidationError = validatePassword(password);
      if (passwordValidationError) return json({ error: passwordValidationError }, 400);
      if (isProtected(email)) return json({ error: "Ce compte est protégé" }, 403);

      if (role === "regional_admin") {
        const { data: existing } = await admin.from("user_roles").select("user_id").eq("role", "regional_admin");
        const count = new Set((existing ?? []).map((r: any) => r.user_id)).size;
        if (count >= 10) return json({ error: "Limite atteinte : 10 comptes Admin régional maximum" }, 400);
      }

      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error) return json({ error: authErrorMessage(error.message) }, 400);
      const newId = data.user!.id;

      await admin.from("user_roles").delete().eq("user_id", newId);
      const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newId, role });
      if (roleErr) return json({ error: roleErr.message }, 400);
      const targets = pdvIds.length > 0 ? pdvIds : pdvId ? [pdvId] : [];
      if (targets.length > 0) {
        await admin.from("user_pdvs").delete().eq("user_id", newId);
        await admin.from("user_pdvs").insert(targets.map((p) => ({ user_id: newId, pdv_id: p })));
      }
      return json({ ok: true, user_id: newId });
    }

    if (action === "delete") {
      const userId = String(body.user_id ?? "");
      if (!userId) return json({ error: "Utilisateur manquant" }, 400);
      if (userId === user.id) return json({ error: "Impossible de supprimer votre propre compte" }, 400);
      const email = await getTargetEmail(userId);
      if (isProtected(email)) return json({ error: "Ce compte est protégé" }, 403);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "password") {
      const userId = String(body.user_id ?? "");
      const password = String(body.password ?? "");
      if (!userId) return json({ error: "Utilisateur manquant" }, 400);
      const passwordValidationError = validatePassword(password);
      if (passwordValidationError) return json({ error: passwordValidationError }, 400);
      const email = await getTargetEmail(userId);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: authErrorMessage(error.message) }, 400);
      return json({ ok: true });
    }

    if (action === "assign_pdv") {
      const userId = String(body.user_id ?? "");
      const pdvId = body.pdv_id ? String(body.pdv_id) : null;
      if (!userId) return json({ error: "Utilisateur manquant" }, 400);
      const email = await getTargetEmail(userId);
      if (isProtected(email)) return json({ error: "Ce compte est protégé" }, 403);
      await admin.from("user_pdvs").delete().eq("user_id", userId);
      if (pdvId) {
        const { error } = await admin.from("user_pdvs").insert({ user_id: userId, pdv_id: pdvId });
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "assign_pdvs") {
      const userId = String(body.user_id ?? "");
      const pdvIds: string[] = Array.isArray(body.pdv_ids) ? body.pdv_ids.map(String) : [];
      if (!userId) return json({ error: "Utilisateur manquant" }, 400);
      const email = await getTargetEmail(userId);
      if (isProtected(email)) return json({ error: "Ce compte est protégé" }, 403);
      await admin.from("user_pdvs").delete().eq("user_id", userId);
      if (pdvIds.length > 0) {
        const { error } = await admin
          .from("user_pdvs")
          .insert(pdvIds.map((p) => ({ user_id: userId, pdv_id: p })));
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur inattendue" }, 500);
  }
});
