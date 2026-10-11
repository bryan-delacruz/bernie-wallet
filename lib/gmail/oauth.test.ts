import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  GMAIL_SCOPE,
  buildAuthUrl,
  callbackUrl,
  newOAuthSecrets,
  parseOAuthCookie,
  sameMailbox,
  withOutcome,
} from "./oauth.ts";

test("el challenge es el S256 del verificador", () => {
  const { verifier, challenge } = newOAuthSecrets();
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
});

test("cada conexión estrena state y verificador", () => {
  const a = newOAuthSecrets();
  const b = newOAuthSecrets();
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.verifier, b.verifier);
});

test("la URL de Google pide solo Gmail, offline y con consentimiento", () => {
  const url = new URL(
    buildAuthUrl({
      clientId: "cid",
      redirectUri: callbackUrl("http://localhost:3000"),
      state: "st",
      challenge: "ch",
      loginHint: "ana@gmail.com",
    }),
  );
  const q = url.searchParams;
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(q.get("scope"), GMAIL_SCOPE);
  assert.equal(q.get("access_type"), "offline");
  assert.equal(q.get("prompt"), "consent");
  assert.equal(q.get("redirect_uri"), "http://localhost:3000/api/gmail/callback");
  assert.equal(q.get("login_hint"), "ana@gmail.com");
  assert.equal(q.get("code_challenge_method"), "S256");
  assert.equal(q.get("state"), "st");
});

test("la cookie mal formada se descarta en vez de lanzar", () => {
  assert.equal(parseOAuthCookie(undefined), null);
  assert.equal(parseOAuthCookie("no-json"), null);
  assert.equal(parseOAuthCookie(JSON.stringify({ state: "s" })), null);
  assert.deepEqual(parseOAuthCookie(JSON.stringify({ state: "s", verifier: "v", next: "/x" })), {
    state: "s",
    verifier: "v",
    next: "/x",
  });
});

test("mismo buzón ignora mayúsculas y el alias googlemail", () => {
  assert.ok(sameMailbox("Ana@Gmail.com", "ana@gmail.com"));
  assert.ok(sameMailbox("ana@googlemail.com", "ana@gmail.com"));
  assert.ok(!sameMailbox("ana@gmail.com", "otra@gmail.com"));
  assert.ok(!sameMailbox("", ""));
});

test("el resultado se agrega sin pisar la query del destino", () => {
  assert.equal(withOutcome("/activity", "connected"), "/activity?gmail=connected");
  assert.equal(withOutcome("/settings?tab=1", "mismatch"), "/settings?tab=1&gmail=mismatch");
});
