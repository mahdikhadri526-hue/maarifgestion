import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: admin } = await supabase.rpc("is_admin", { _user_id: userData.user.id });
    if (!admin) return json({ error: "Réservé à l'administrateur" }, 403);

    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim() || text.length > 4000) return json({ error: "Texte invalide" }, 400);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-tts-preview",
        contents: [{ role: "user", parts: [{ text: `Dis avec un ton naturel et amical, d'une voix d'homme, en darija marocaine : ${text.trim()}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
        },
      }),
    });
    if (res.status === 429) return json({ error: "Trop de demandes, réessayez dans un instant." }, 429);
    if (res.status === 402) return json({ error: "Crédits IA épuisés." }, 402);
    if (!res.ok) return json({ error: `Erreur synthèse vocale (${res.status})` }, 500);
    const audio = await res.arrayBuffer();
    return new Response(audio, { headers: { ...CORS, "Content-Type": "audio/wav" } });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur" }, 500);
  }
});
