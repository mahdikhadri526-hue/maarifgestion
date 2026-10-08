import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Lecture des photos de bons de livraison.
 *
 * Deux chemins, choisis selon la clé présente sur le serveur :
 * - GOOGLE_API_KEY (clé Google AI Studio) : utilisé sur un serveur autonome.
 *   Le modèle par défaut est le moins cher (~0,001 $ par scan).
 *   Pour une lecture plus fiable, définir GEMINI_MODEL=gemini-2.5-flash
 *   (3 à 4 fois plus cher) dans les variables du serveur.
 * - LOVABLE_API_KEY : utilisé sur l'hébergement Lovable (aucune clé à gérer).
 */
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";

const USER_TEXT =
  "Extrait les entrées de stock de cette photo (article, quantité, n° de lot).";

function buildSystemPrompt(articleList: string) {
  return `Tu es un assistant qui extrait des données d'étiquettes/bons de livraison de glaces et tartes.
${articleList}
Pour chaque produit visible sur la photo, retourne :
- article (depuis la liste si possible, sinon nom détecté)
- terms (liste de TOUS les nombres écrits pour cet article, chiffre par chiffre, dans l'ordre, sans les additionner)
- quantity (null — le total est calculé par l'application)
- lotNumber (numéro de lot tel qu'écrit)

Si une donnée est illisible, mets-la à null.

RÈGLE IMPORTANTE sur les quantités : quand pour un même article la photo montre une addition — plusieurs nombres séparés par des signes « + » (ex. « 120 + 80 + 50 ») OU plusieurs nombres écrits les uns sous les autres / côte à côte (ex. un chiffre au-dessus d'un autre) — mets CHAQUE nombre séparément dans terms (ex. [963, 3851]). Ne calcule jamais toi-même la somme. Lis chaque nombre en entier (tous ses chiffres, y compris les zéros de tête comme « 0963 » = 963). La photo peut être tournée : lis bien chaque colonne.`;
}

// Schéma pour l'appel via la clé Google (format « nullable », sans additionalProperties).
const ENTRIES_SCHEMA_GEMINI = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          article: { type: "string", nullable: true },
          quantity: { type: "number", nullable: true },
          terms: { type: "array", items: { type: "number" } },
          lotNumber: { type: "string", nullable: true },
        },
        required: ["article", "quantity", "terms", "lotNumber"],
      },
    },
  },
  required: ["entries"],
};

// Schéma pour l'appel via l'hébergement Lovable (format strict JSON Schema).
const ENTRIES_SCHEMA_STRICT = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          article: { type: ["string", "null"] },
          quantity: { type: ["number", "null"] },
          terms: { type: "array", items: { type: "number" } },
          lotNumber: { type: ["string", "null"] },
        },
        required: ["article", "quantity", "terms", "lotNumber"],
        additionalProperties: false,
      },
    },
  },
  required: ["entries"],
  additionalProperties: false,
};

function httpError(status: number, message: string) {
  const e = new Error(message) as Error & { status?: number };
  e.status = status;
  return e;
}

/** Additionne les nombres lus (l'IA ne calcule jamais elle-même). */
function normalizeEntries(parsed: any): any[] {
  const list = Array.isArray(parsed?.entries) ? parsed.entries : [];
  return list.map((e: any) => {
    const terms = Array.isArray(e?.terms)
      ? e.terms.map(Number).filter((n: number) => Number.isFinite(n))
      : [];
    const quantity = terms.length > 0
      ? Math.round(terms.reduce((a: number, b: number) => a + b, 0) * 1000) / 1000
      : typeof e?.quantity === "number"
        ? e.quantity
        : null;
    return { article: e?.article ?? null, quantity, lotNumber: e?.lotNumber ?? null };
  });
}

/** Chemin serveur autonome : appel direct à Google avec votre clé. */
async function readWithGoogle(opts: {
  key: string;
  model: string;
  systemPrompt: string;
  imageBase64: string;
  mimeType: string;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": opts.key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: USER_TEXT },
              {
                inlineData: {
                  mimeType: opts.mimeType || "image/jpeg",
                  data: opts.imageBase64,
                },
              },
            ],
          },
        ],
        tools: [
          {
            functionDeclarations: [
              {
                name: "extract_entries",
                description: "Retourne les entrées de stock détectées",
                parameters: ENTRIES_SCHEMA_GEMINI,
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["extract_entries"],
          },
        },
        generationConfig: { temperature: 0 },
      }),
    },
  );

  if (!response.ok) {
    const t = await response.text();
    console.error("Google error:", response.status, t.slice(0, 500));
    if (response.status === 429) {
      throw httpError(429, "Trop de scans d'un coup. Réessayez dans un instant.");
    }
    if (response.status === 400) {
      throw httpError(
        400,
        "La lecture a échoué : vérifiez que la clé Google est activée pour la facturation et pour ce modèle.",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw httpError(403, "Clé Google refusée. Vérifiez la clé configurée sur le serveur.");
    }
    if (response.status === 404) {
      throw httpError(404, "Ce modèle de lecture n'est pas disponible avec votre clé Google.");
    }
    throw httpError(502, "Le service de lecture Google n'a pas répondu.");
  }

  const data = await response.json();
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const call =
    parts.find((p) => p?.functionCall?.name === "extract_entries") ??
    parts.find((p) => p?.functionCall);
  return normalizeEntries(call?.functionCall?.args);
}

/** Chemin hébergement Lovable : appel au service déjà utilisé en ligne. */
async function readWithLovable(opts: {
  key: string;
  systemPrompt: string;
  imageBase64: string;
  mimeType: string;
}) {
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: opts.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: USER_TEXT },
              {
                type: "image_url",
                image_url: {
                  url: `data:${opts.mimeType || "image/jpeg"};base64,${opts.imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_entries",
              description: "Retourne les entrées de stock détectées",
              parameters: ENTRIES_SCHEMA_STRICT,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_entries" } },
      }),
    },
  );

  if (!response.ok) {
    if (response.status === 429) {
      throw httpError(429, "Trop de requêtes, réessayez plus tard.");
    }
    if (response.status === 402) {
      throw httpError(402, "Crédits IA épuisés. Ajoutez des crédits dans Lovable.");
    }
    const t = await response.text();
    console.error("AI gateway error:", response.status, t);
    throw httpError(500, "Erreur AI");
  }

  const data = await response.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return [];
  try {
    return normalizeEntries(typeof args === "string" ? JSON.parse(args) : args);
  } catch (e) {
    console.error("parse args error", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Session expirée. Reconnectez-vous." }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, mimeType, articles } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 requis" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GOOGLE_API_KEY && !LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Aucune clé de lecture n'est configurée sur ce serveur.",
        }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const articleList =
      Array.isArray(articles) && articles.length > 0
        ? `Liste des articles possibles : ${articles.join(", ")}.`
        : "";
    const systemPrompt = buildSystemPrompt(articleList);

    const entries = GOOGLE_API_KEY
      ? await readWithGoogle({
          key: GOOGLE_API_KEY,
          model: GEMINI_MODEL,
          systemPrompt,
          imageBase64,
          mimeType,
        })
      : await readWithLovable({
          key: LOVABLE_API_KEY!,
          systemPrompt,
          imageBase64,
          mimeType,
        });

    return new Response(JSON.stringify({ entries }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-stock-entry error:", e);
    const status = typeof (e as any)?.status === "number" ? (e as any).status : 500;
    const message =
      status === 500 ? "Erreur interne du serveur" : (e as Error).message;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
