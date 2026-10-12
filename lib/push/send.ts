import "server-only";
import { signVapidToken } from "@/lib/push/vapid";

/** Cuánto guarda el servicio el aviso si el equipo está apagado. Un día: pasado
 *  eso, el saludo de ayer ya no sirve. */
const TTL_SECONDS = 20 * 60 * 60;

export type PushResult =
  /** Entregado al servicio de push (no significa que el usuario lo haya visto). */
  | { status: "sent" }
  /** El navegador revocó la suscripción: hay que borrarla, no reintentar. */
  | { status: "gone" }
  | { status: "failed"; reason: string };

/**
 * Empuja un aviso **sin contenido** a una suscripción.
 *
 * El cuerpo va vacío a propósito (SPEC §20.3): sin payload no hay cifrado, y el
 * service worker arma la frase pidiéndosela al servidor en el momento de
 * mostrarla, con la racha y los pendientes de ese instante.
 */
export async function sendPush(
  endpoint: string,
  { subject, privateKeyPem }: { subject: string; privateKeyPem: string },
): Promise<PushResult> {
  let audience: string;
  try {
    audience = new URL(endpoint).origin;
  } catch {
    return { status: "failed", reason: "endpoint inválido" };
  }

  // Una clave mal pegada (con comillas, o sin los saltos) hace que `createPrivateKey`
  // lance. Eso es un problema de configuración, no de esta suscripción: se informa
  // como fallo en vez de tumbar toda la corrida del cron.
  let token: string;
  try {
    token = signVapidToken({ audience, subject, privateKeyPem });
  } catch (error) {
    return {
      status: "failed",
      reason: `firma VAPID: ${error instanceof Error ? error.message : "clave inválida"}`,
    };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        TTL: String(TTL_SECONDS),
        "Content-Length": "0",
        Authorization: `vapid t=${token}, k=${publicKey}`,
      },
    });

    // 404/410 = el navegador la revocó. No es un fallo a reintentar.
    if (response.status === 404 || response.status === 410) return { status: "gone" };
    if (!response.ok) return { status: "failed", reason: `HTTP ${response.status}` };
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : "red" };
  }
}
