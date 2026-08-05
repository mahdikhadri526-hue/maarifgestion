import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROTECTED_EMAILS = ["gestionmaarif1@gmail.com"];

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
  if (!isAdminData) return json({ error: "Accès réservé à l'administrateur" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const action = body?.action as string;

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
      if (!email || password.length < 6) return json({ error: "Email et mot de passe (6+ caractères) requis" }, 400);
      if (isProtected(email)) return json({ error: "Ce compte est protégé" }, 403);

      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);
      const newId = data.user!.id;

      await admin.from("user_roles").delete().eq("user_id", newId);
      await admin.from("user_roles").insert({ user_id: newId, role });
      if (pdvId) {
        await admin.from("user_pdvs").delete().eq("user_id", newId);
        await admin.from("user_pdvs").insert({ user_id: newId, pdv_id: pdvId });
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
      if (!userId || password.length < 6) return json({ error: "Mot de passe de 6 caractères minimum" }, 400);
      const email = await getTargetEmail(userId);
      if (isProtected(email)) return json({ error: "Ce compte est protégé" }, 403);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
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

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur inattendue" }, 500);
  }
});
