import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/**
 * Error de acceso a Gmail que se resuelve reconectando la cuenta: falta el token,
 * el refresh falló, o Gmail respondió 401/403 (permiso no concedido / expirado).
 * El endpoint lo usa para sugerirle al usuario cerrar sesión y volver a entrar.
 */
export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailAuthError";
  }
}

export type GmailMessage = {
  id: string;
  subject: string;
  from: string;
  dateMs: number;
  text: string;
};

/** Refresca el access_token de Gmail usando el refresh_token cifrado del usuario. */
export async function getGmailAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: row } = await supabase
    .from("google_tokens")
    .select("encrypted_refresh_token")
    .eq("user_id", userId)
    .single();

  if (!row) {
    throw new GmailAuthError("No hay token de Google. Vuelve a iniciar sesión.");
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(row.encrypted_refresh_token),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new GmailAuthError("No se pudo refrescar el acceso a Gmail.");
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Gmail no devolvió un access_token.");
  return json.access_token;
}

/**
 * Lista los IDs de correos que cumplen la query, paginando hasta agotar (o el
 * tope de seguridad `cap`). Listar IDs es gratis; el costo está en getMessage +
 * parser. Gmail los entrega del MÁS NUEVO al MÁS VIEJO.
 */
export async function searchMessages(
  accessToken: string,
  query: string,
  cap = 1000,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GMAIL_API}/messages`);
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[gmail] messages.list ${res.status}: ${body.slice(0, 400)}`);
      // 401/403 = token inválido o permiso de Gmail no concedido → reconectar.
      if (res.status === 401 || res.status === 403) {
        throw new GmailAuthError("Se perdió el acceso a Gmail. Vuelve a conectar tu cuenta.");
      }
      throw new Error(`Error al listar correos de Gmail (${res.status}).`);
    }
    const json = (await res.json()) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };
    for (const m of json.messages ?? []) ids.push(m.id);
    pageToken = json.nextPageToken;
  } while (pageToken && ids.length < cap);

  return ids;
}

/** Trae un correo y devuelve subject, remitente, fecha (ms) y cuerpo en texto. */
export async function getMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Error al leer un correo de Gmail.");
  const json = (await res.json()) as GmailApiMessage;

  const headers = json.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";

  return {
    id,
    subject: header("subject"),
    from: header("from"),
    dateMs: Number(json.internalDate ?? Date.now()),
    text: extractBody(json.payload),
  };
}

// --- internos ---

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};
type GmailApiMessage = {
  internalDate?: string;
  payload?: GmailPart & { headers?: { name: string; value: string }[] };
};

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Prefiere text/plain; si solo hay HTML, lo limpia a texto. */
function extractBody(payload?: GmailPart): string {
  let plain = "";
  let html = "";

  const walk = (part?: GmailPart) => {
    if (!part) return;
    const data = part.body?.data;
    if (data && part.mimeType === "text/plain") plain += decodeBase64Url(data);
    else if (data && part.mimeType === "text/html") html += decodeBase64Url(data);
    part.parts?.forEach(walk);
  };
  walk(payload);

  return (plain || stripHtml(html)).trim();
}
