import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safe-next.ts";

test("safeNext: acepta rutas internas con query", () => {
  assert.equal(safeNext("/oauth/consent?authorization_id=abc"), "/oauth/consent?authorization_id=abc");
  assert.equal(safeNext("/dashboard"), "/dashboard");
});

test("safeNext: rechaza todo lo que pueda salir del sitio", () => {
  for (const raw of [
    null,
    "",
    "dashboard",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "javascript:alert(1)",
    " /dashboard",
  ]) {
    assert.equal(safeNext(raw), null, JSON.stringify(raw));
  }
});

test("nextFromCookie: decodifica y valida; basura → null", async () => {
  const { nextFromCookie } = await import("./safe-next.ts");
  assert.equal(nextFromCookie(encodeURIComponent("/oauth/consent?authorization_id=a")), "/oauth/consent?authorization_id=a");
  assert.equal(nextFromCookie("%E0%A4%A"), null);
  assert.equal(nextFromCookie(encodeURIComponent("//evil.com")), null);
  assert.equal(nextFromCookie(undefined), null);
});
