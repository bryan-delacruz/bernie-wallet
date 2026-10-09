// Genera el par de claves VAPID para las notificaciones push (SPEC §19.6).
//
// El par es PERMANENTE: cambiarlo invalida todas las suscripciones existentes y
// cada usuario tiene que volver a prender el interruptor.
//
//   node scripts/generate-vapid.mjs
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

// El cliente espera la clave pública en formato "raw" (0x04 || x || y), base64url.
const raw = publicKey.export({ type: "spki", format: "der" }).subarray(-65);
const base64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

console.log("Pegá estas tres variables en Vercel (y en .env.local para probar):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${base64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY="${pem.trim().replace(/\n/g, "\\n")}"`);
console.log(`VAPID_SUBJECT=mailto:soporte-bernie-wallet@googlegroups.com`);
console.log("\nLa privada no se puede recuperar: si la perdés, generá un par nuevo");
console.log("y todos los usuarios tendrán que volver a prender la notificación.");
