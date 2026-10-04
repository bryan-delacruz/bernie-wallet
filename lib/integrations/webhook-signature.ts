import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Firma Standard Webhooks (standardwebhooks.com), la misma que usan Svix y Clerk.
 * Se implementa con node:crypto para no sumar dependencias (SPEC §4).
 *
 *   firma = base64(HMAC-SHA256(secreto, `${id}.${timestamp}.${body}`))
 *   webhook-signature: "v1,<firma>"   (puede traer varias separadas por espacio)
 */
const PREFIX = "whsec_";

function secretBytes(secret: string): Buffer {
  const raw = secret.startsWith(PREFIX) ? secret.slice(PREFIX.length) : secret;
  return Buffer.from(raw, "base64");
}

/** Secreto nuevo para un cliente: 32 bytes aleatorios, formato `whsec_<base64>`. */
export function generateWebhookSecret(): string {
  return PREFIX + randomBytes(32).toString("base64");
}

export function signWebhook(secret: string, id: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secretBytes(secret)).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${mac}`;
}

/** Cabeceras completas de un envío. `timestamp` en segundos Unix. */
export function webhookHeaders(secret: string, id: string, timestamp: number, body: string) {
  return {
    "Content-Type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": signWebhook(secret, id, timestamp, body),
  };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing_headers" | "stale" | "bad_signature" };

/**
 * Verifica un webhook recibido. Rechaza timestamps fuera de la tolerancia
 * (por defecto ±5 min) para frenar reenvíos, y compara en tiempo constante.
 */
export function verifyWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  opts: { toleranceSeconds?: number; now?: number } = {},
): VerifyResult {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" };

  const ts = Number(timestamp);
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || Math.abs(now - ts) > (opts.toleranceSeconds ?? 300)) {
    return { ok: false, reason: "stale" };
  }

  const expected = Buffer.from(signWebhook(secret, id, ts, body).slice(3), "base64");
  for (const candidate of signature.split(" ")) {
    const [version, value] = candidate.split(",", 2);
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "bad_signature" };
}
