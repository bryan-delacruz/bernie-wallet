import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { signVapidToken } from "./vapid.ts";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function parts(token: string) {
  const [header, payload, signature] = token.split(".");
  const decode = (part: string) =>
    JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  return { header: decode(header), payload: decode(payload), signature };
}

/** De `r || s` (lo que exige JOSE) de vuelta a DER, que es lo que verifica node. */
function joseToDer(jose: Buffer): Buffer {
  const trim = (buf: Buffer) => {
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0) i++;
    const out = buf.subarray(i);
    // DER interpreta el primer bit en 1 como signo: hay que anteponer 0x00.
    return out[0] & 0x80 ? Buffer.concat([Buffer.from([0]), out]) : out;
  };
  const r = trim(jose.subarray(0, 32));
  const s = trim(jose.subarray(32));
  const body = Buffer.concat([
    Buffer.from([0x02, r.length]),
    r,
    Buffer.from([0x02, s.length]),
    s,
  ]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

test("el token lleva cabecera ES256 y las claims que pide VAPID", () => {
  const token = signVapidToken({
    audience: "https://fcm.googleapis.com",
    subject: "mailto:x@y.com",
    privateKeyPem,
  });
  const { header, payload } = parts(token);

  assert.deepEqual(header, { typ: "JWT", alg: "ES256" });
  assert.equal(payload.aud, "https://fcm.googleapis.com");
  assert.equal(payload.sub, "mailto:x@y.com");
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));
  // El estándar topa en 24 h.
  assert.ok(payload.exp <= Math.floor(Date.now() / 1000) + 24 * 60 * 60);
});

test("la firma verifica con la clave pública", () => {
  const token = signVapidToken({
    audience: "https://push.example",
    subject: "mailto:x@y.com",
    privateKeyPem,
  });
  const [header, payload, signature] = token.split(".");
  const jose = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");

  // 32 bytes para r y 32 para s: si la conversión DER→JOSE fallara, acá se nota.
  assert.equal(jose.length, 64);

  const verifier = createVerify("SHA256");
  verifier.update(`${header}.${payload}`);
  assert.ok(verifier.verify(publicKey, joseToDer(jose)));
});

test("firmas repetidas siguen teniendo el largo exacto", () => {
  // ECDSA es aleatoria: a veces r o s salen de menos de 32 bytes y hay que
  // rellenar a la izquierda. Varias vueltas para pegarle a esos casos.
  for (let i = 0; i < 50; i++) {
    const token = signVapidToken({
      audience: "https://push.example",
      subject: "mailto:x@y.com",
      privateKeyPem,
    });
    const signature = token.split(".")[2];
    const jose = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    assert.equal(jose.length, 64);
  }
});

test("el token no lleva padding ni caracteres fuera de base64url", () => {
  const token = signVapidToken({
    audience: "https://push.example",
    subject: "mailto:x@y.com",
    privateKeyPem,
  });
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});
