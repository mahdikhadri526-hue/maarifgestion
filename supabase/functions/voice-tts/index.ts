import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Génération des explications vocales (voix masculine darija).
 * Fournisseur :
 * - LOVABLE_API_KEY présent (version en ligne) : service IA Lovable ; en cas d'échec, Google si GOOGLE_API_KEY existe.
 * - Sinon (serveur autonome) : Google AI Studio avec GOOGLE_API_KEY
 *   (modèle GEMINI_TTS_MODEL, sinon gemini-3.1-flash-tts-preview puis gemini-2.5-flash-preview-tts).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const VOICE_NAME = "Puck";
const prompt = (text: string) =>
  `Dis avec un ton naturel et amical, d'une voix d'homme, en darija marocaine : ${text.trim()}`;

class TtsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function pcmToWav(pcm: Uint8Array, sampleRate = 24000, channels = 1, bits = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  const byteRate = (sampleRate * channels * bits) / 8;
  w(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, (channels * bits) / 8, true);
  v.setUint16(34, bits, true);
  w(36, "data");
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

async function speakWithLovable(key: string, text: string): Promise<Uint8Array> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-tts-preview",
      contents: [{ role: "user", parts: [{ text: prompt(text) }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
      },
    }),
  });
  if (res.status === 429) throw new TtsError(429, "Trop de demandes, réessayez dans un instant.");
  if (res.status === 402) throw new TtsError(402, "Crédits IA épuisés.");
  if (!res.ok) throw new TtsError(500, `Erreur synthèse vocale (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

async function speakWithGoogle(key: string, text: string): Promise<Uint8Array> {
  const configured = Deno.env.get("GEMINI_TTS_MODEL");
  const models = configured ? [configured] : ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
  let last = "";
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt(text) }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
        },
      }),
    });
    if (res.status === 429) throw new TtsError(429, "Trop de demandes, réessayez dans un instant.");
    if (!res.ok) {
      last = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`;
      continue;
    }
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
    if (!part) {
      last = `${model}: réponse sans audio`;
      continue;
    }
    const pcm = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0));
    const mime: string = part.inlineData.mimeType || "";
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1] || 24000);
    return mime.includes("wav") ? pcm : pcmToWav(pcm, rate);
  }
  console.error("Google TTS échec", last);
  throw new TtsError(500, "Erreur synthèse vocale (Google)");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) return json({ error: "Session expirée. Reconnectez-vous." }, 401);
    const { data: admin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!admin) return json({ error: "Réservé à l'administrateur" }, 403);

    const body = await req.json();
    const text = body?.text;
    if (typeof text !== "string" || !text.trim() || text.length > 4000) return json({ error: "Texte invalide" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!LOVABLE_API_KEY && !GOOGLE_API_KEY) {
      return json({ error: "Synthèse vocale non configurée : ajoutez GOOGLE_API_KEY sur le serveur." }, 500);
    }

    let audio: Uint8Array;
    if (GOOGLE_API_KEY && (body?.provider === "google" || !LOVABLE_API_KEY)) {
      audio = await speakWithGoogle(GOOGLE_API_KEY, text);
    } else {
      try {
        audio = await speakWithLovable(LOVABLE_API_KEY!, text);
      } catch (e) {
        if (!GOOGLE_API_KEY) throw e;
        audio = await speakWithGoogle(GOOGLE_API_KEY, text);
      }
    }
    return new Response(audio, { headers: { ...CORS, "Content-Type": "audio/wav" } });
  } catch (e) {
    if (e instanceof TtsError) return json({ error: e.message }, e.status);
    return json({ error: e instanceof Error ? e.message : "Erreur" }, 500);
  }
});
