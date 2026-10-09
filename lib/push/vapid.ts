// Sin `server-only`: es criptografía pura, sin secretos propios ni acceso a la
// base, y así se puede probar con `node:test`. Quien la usa (`send.ts`) sí lo es.
import { createSign, createPrivateKey } from "node:crypto";

/**
 * Firma VAPID (RFC 8292) con `node:crypto`, sin librería de push.
 *
 * Mandar un push **con** contenido exige cifrar el payload (RFC 8291: ECDH P-256,
 * HKDF y AES-128-GCM). Un push **sin** payload no se cifra: solo lleva esta firma,
 * que es un JWT ES256. Por eso el aviso va vacío y el service worker pide la frase
 * (SPEC §19.3).
 */

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * La firma ECDSA de `node:crypto` sale en DER; JOSE la quiere como `r || s`, 32
 * bytes cada uno. Convertir es obligatorio: el servicio de push rechaza la DER.
 */
function derToJose(der: Buffer): Buffer {
  // SEQUENCE(0x30) len INTEGER(0x02) len r INTEGER(0x02) len s
  let offset = der[1] & 0x80 ? 2 + (der[1] & 0x7f) : 2;
  if (der[offset] !== 0x02) throw new Error("firma DER inesperada");

  const rLength = der[offset + 1];
  const r = der.subarray(offset + 2, offset + 2 + rLength);
  offset = offset + 2 + rLength;
  if (der[offset] !== 0x02) throw new Error("firma DER inesperada");

  const sLength = der[offset + 1];
  const s = der.subarray(offset + 2, offset + 2 + sLength);

  // Los enteros DER llevan un 0x00 adelante si el primer bit es 1, y pueden venir
  // más cortos de 32 bytes: JOSE exige exactamente 32, alineados a la derecha.
  const pad = (buf: Buffer) => {
    const trimmed = buf[0] === 0 ? buf.subarray(1) : buf;
    const out = Buffer.alloc(32);
    trimmed.copy(out, 32 - trimmed.length);
    return out;
  };

  return Buffer.concat([pad(r), pad(s)]);
}

/** Vida del token. El estándar topa en 24 h; 12 deja margen de reloj sobrado. */
const TTL_SECONDS = 12 * 60 * 60;

/**
 * JWT ES256 para el header `Authorization` del push.
 *
 * `audience` es el **origen** del endpoint, no el endpoint entero: mandar la URL
 * completa es el error clásico y el servicio responde 401.
 */
export function signVapidToken({
  audience,
  subject,
  privateKeyPem,
}: {
  audience: string;
  subject: string;
  privateKeyPem: string;
}): string {
  const header = base64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
      sub: subject,
    }),
  );

  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  const der = signer.sign(createPrivateKey(privateKeyPem));

  return `${header}.${payload}.${base64url(derToJose(der))}`;
}
