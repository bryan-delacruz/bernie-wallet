import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeCursor, encodeCursor, OVERLAP_MS, readFrom, type SyncCursor } from "./cursor.ts";
import { problem } from "./problem.ts";
import { buildSyncPage, type ChangeRow } from "./sync-page.ts";

const ID = (n: number) => `30000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const cursor: SyncCursor = { ts: "2026-09-20T10:00:00.000Z", id: ID(1), sv: 2, final: true };

// ---------- cursor ----------

test("cursor: ida y vuelta", () => {
  assert.deepEqual(decodeCursor(encodeCursor(cursor)), cursor);
});

test("cursor: basura, otra versión o campos malos → null (400, no 500)", () => {
  const forge = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  for (const raw of [
    "",
    "no-es-base64-json",
    forge({ ...cursor, v: 2 }),
    forge({ v: 1, ...cursor, id: "1; drop table expenses" }),
    forge({ v: 1, ...cursor, ts: "ayer" }),
    forge({ v: 1, ...cursor, sv: 1.5 }),
    forge({ v: 1, ...cursor, final: "yes" }),
  ]) {
    assert.equal(decodeCursor(raw), null, raw);
  }
});

test("cursor: solo el de cierre relee la ventana hacia atrás", () => {
  assert.deepEqual(readFrom({ ...cursor, final: false }), { ts: cursor.ts, id: cursor.id });
  const from = readFrom(cursor);
  assert.equal(Date.parse(cursor.ts) - Date.parse(from.ts), OVERLAP_MS);
  assert.equal(from.id, "00000000-0000-0000-0000-000000000000");
});

// ---------- problem details ----------

test("problem: RFC 9457 con status, tipo y cabeceras", async () => {
  const res = problem("rate_limited", undefined, { "Retry-After": "30" });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("content-type"), "application/problem+json");
  assert.equal(res.headers.get("retry-after"), "30");
  assert.deepEqual(await res.json(), {
    type: "urn:bernie:problem:rate_limited",
    title: "Too many requests",
    status: 429,
    code: "rate_limited",
  });
  assert.match(problem("unauthorized").headers.get("www-authenticate") ?? "", /^Bearer/);
});

// ---------- página de sync ----------

const row = (n: number, over: Partial<ChangeRow> = {}): ChangeRow => ({
  id: ID(n),
  removed: false,
  occurred_at: "2026-09-12 15:04:05+00",
  amount: "800.00",
  currency: "PEN",
  merchant: "Estudio Foto",
  subcategory: "Fotógrafo",
  created_at: "2026-09-12 15:04:05+00",
  changed_at: `2026-09-2${n}T10:00:00+00:00`,
  ...over,
});
const now = new Date("2026-10-01T00:00:00Z");

test("sync inicial: todo added; cursor de cierre en la última fila", () => {
  const page = buildSyncPage([row(1), row(2)], { limit: 10, previous: null, sharesVersion: 3, now });
  assert.equal(page.added.length, 2);
  assert.equal(page.hasMore, false);
  assert.deepEqual(decodeCursor(page.nextCursor), { ts: "2026-09-22T10:00:00+00:00", id: ID(2), sv: 3, final: true });
});

test("incremental: added si se creó después del cursor, modified si no, removed sin datos", () => {
  const page = buildSyncPage(
    [
      row(1, { created_at: "2026-09-01T00:00:00Z" }),
      row(2, { created_at: "2026-09-25T00:00:00Z" }),
      row(3, { removed: true, occurred_at: null, amount: null, currency: null, merchant: null, subcategory: null, created_at: null }),
    ],
    { limit: 10, previous: cursor, sharesVersion: 2, now },
  );
  assert.deepEqual(page.modified.map((e) => e.id), [ID(1)]);
  assert.deepEqual(page.added.map((e) => e.id), [ID(2)]);
  assert.deepEqual(page.removed, [ID(3)]);
});

test("cursor: conserva los microsegundos de Postgres (sin pasar por Date)", () => {
  const ts = "2026-09-20T10:00:00.123456+00:00";
  const page = buildSyncPage([row(1, { changed_at: ts }), row(2, { changed_at: ts })], { limit: 1, previous: null, sharesVersion: 1, now });
  assert.equal(decodeCursor(page.nextCursor)?.ts, ts);
});

test("paginación: limit + 1 filas → hasMore y cursor intermedio (sin ventana)", () => {
  const page = buildSyncPage([row(1), row(2), row(3)], { limit: 2, previous: null, sharesVersion: 1, now });
  assert.equal(page.hasMore, true);
  assert.equal(page.added.length, 2);
  assert.equal(decodeCursor(page.nextCursor)?.final, false);
});

test("sin cambios: conserva la posición; la primera vez arranca desde ahora", () => {
  const same = buildSyncPage([], { limit: 10, previous: { ...cursor, final: false }, sharesVersion: 2, now });
  assert.deepEqual(decodeCursor(same.nextCursor), { ...cursor, final: true });
  const first = buildSyncPage([], { limit: 10, previous: null, sharesVersion: 1, now });
  assert.equal(decodeCursor(first.nextCursor)?.ts, now.toISOString());
});

// ---------- contrato (OpenAPI) ----------
// Validador mínimo para el subconjunto de JSON Schema que usa el contrato. Así
// el test no agrega dependencias (SPEC §4).

const spec = JSON.parse(readFileSync(new URL("../../docs/api/openapi.json", import.meta.url), "utf8"));
type Schema = Record<string, unknown>;

function resolve(schema: Schema): Schema {
  const ref = schema.$ref as string | undefined;
  if (!ref) return schema;
  return ref.replace("#/", "").split("/").reduce((node: Schema, key) => node[key] as Schema, spec as Schema);
}

function validate(value: unknown, raw: Schema, path = "$"): string[] {
  const schema = resolve(raw);
  const errors: string[] = [];
  const types = ([] as string[]).concat((schema.type as string | string[]) ?? []);
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
  if (types.length && !types.includes(actual) && !(actual === "integer" && types.includes("number"))) {
    return [`${path}: esperaba ${types.join("|")}, llegó ${actual}`];
  }
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) errors.push(`${path}: fuera del enum`);
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern as string).test(value)) errors.push(`${path}: no cumple ${schema.pattern}`);
    if (schema.format === "uuid" && !/^[0-9a-f-]{36}$/i.test(value)) errors.push(`${path}: no es uuid`);
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) errors.push(`${path}: no es date-time`);
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errors.push(...validate(item, schema.items as Schema, `${path}[${i}]`)));
  }
  if (actual === "object") {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    for (const key of (schema.required as string[]) ?? []) if (!(key in obj)) errors.push(`${path}.${key}: falta`);
    for (const [key, v] of Object.entries(obj)) {
      if (props[key]) errors.push(...validate(v, props[key], `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: no está en el contrato`);
    }
  }
  return errors;
}

const syncOk = spec.paths["/api/v1/shared-expenses/sync"].get.responses["200"].content["application/json"];

test("contrato: los ejemplos del OpenAPI cumplen el esquema", () => {
  for (const [name, example] of Object.entries(syncOk.examples as Record<string, { value: unknown }>)) {
    assert.deepEqual(validate(example.value, syncOk.schema), [], name);
  }
});

test("contrato: lo que arma la API cumple el esquema", () => {
  const page = buildSyncPage(
    [row(1), row(2, { subcategory: null }), row(3, { removed: true, amount: null })],
    { limit: 10, previous: cursor, sharesVersion: 2, now },
  );
  assert.deepEqual(validate(JSON.parse(JSON.stringify(page)), syncOk.schema), []);
});

test("contrato: el validador sí detecta violaciones", () => {
  const bad = { added: [{ id: ID(1), occurredAt: "x", amount: 800, currency: "PEN", merchant: "m", subcategory: null, extra: 1 }], modified: [], removed: [], nextCursor: "c" };
  const errors = validate(bad, syncOk.schema);
  assert.ok(errors.some((e) => e.includes("hasMore")));
  assert.ok(errors.some((e) => e.includes("amount")));
  assert.ok(errors.some((e) => e.includes("extra")));
  assert.ok(errors.some((e) => e.includes("occurredAt")));
});

test("contrato: un Problem cumple su esquema", async () => {
  const body = await problem("cursor_reset").json();
  assert.deepEqual(validate(body, spec.components.schemas.Problem), []);
});
