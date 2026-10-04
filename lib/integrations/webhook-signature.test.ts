import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWebhookSecret, signWebhook, verifyWebhook } from "./webhook-signature.ts";

// Vector de prueba publicado en la especificación de Standard Webhooks.
const VECTOR = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: 1614265330,
  body: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};

test("webhook: firma igual al vector oficial de Standard Webhooks", () => {
  assert.equal(signWebhook(VECTOR.secret, VECTOR.id, VECTOR.timestamp, VECTOR.body), VECTOR.signature);
});

const headers = { id: VECTOR.id, timestamp: String(VECTOR.timestamp), signature: VECTOR.signature };
const now = VECTOR.timestamp + 10;

test("webhook: verifica la firma válida (también entre varias)", () => {
  assert.deepEqual(verifyWebhook(VECTOR.secret, headers, VECTOR.body, { now }), { ok: true });
  const many = { ...headers, signature: `v1,AAAA ${VECTOR.signature}` };
  assert.deepEqual(verifyWebhook(VECTOR.secret, many, VECTOR.body, { now }), { ok: true });
});

test("webhook: rechaza cuerpo alterado, otro secreto, timestamp viejo y cabeceras faltantes", () => {
  assert.equal(verifyWebhook(VECTOR.secret, headers, '{"test": 1}', { now }).ok, false);
  assert.equal(verifyWebhook(generateWebhookSecret(), headers, VECTOR.body, { now }).ok, false);
  assert.deepEqual(verifyWebhook(VECTOR.secret, headers, VECTOR.body, { now: now + 600 }), { ok: false, reason: "stale" });
  assert.deepEqual(verifyWebhook(VECTOR.secret, { ...headers, id: null }, VECTOR.body, { now }), { ok: false, reason: "missing_headers" });
  assert.equal(verifyWebhook(VECTOR.secret, { ...headers, signature: "v2,abc" }, VECTOR.body, { now }).ok, false);
});

test("webhook: secreto generado con formato whsec_ y 32 bytes", () => {
  const secret = generateWebhookSecret();
  assert.match(secret, /^whsec_/);
  assert.equal(Buffer.from(secret.slice(6), "base64").length, 32);
});
