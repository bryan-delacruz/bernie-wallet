// Prueba la migración 0009 sobre Postgres en memoria (PGlite) con un stub de Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const dir = new URL("../migrations", import.meta.url).pathname;
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, is_anonymous boolean default false, created_at timestamptz default now());
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create schema cron;
  create function cron.schedule(text, text, text) returns bigint language sql as $$ select 1::bigint $$;
  create function public.rls_auto_enable() returns void language sql as $$ select $$;
  create schema vault; create table vault.decrypted_secrets (name text, decrypted_secret text);
  create schema net; create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as $$ select 1::bigint $$;
`);

for (const f of readdirSync(dir).sort()) {
  let sql = readFileSync(`${dir}/${f}`, "utf8");
  sql = sql.replace(/create extension if not exists pg_cron[^;]*;/i, "").replace(/create extension if not exists pg_net[^;]*;/i, "");
  try {
    await db.exec(sql);
  } catch (e) {
    console.error(`FALLÓ ${f}:`, e.message);
    process.exit(1);
  }
  console.log("ok", f);
}

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const CLIENT = "casorio";

// Datos base como superusuario.
await db.exec(`
  insert into auth.users (id) values ('${A}'), ('${B}');
  insert into users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com');
  insert into categories (id, user_id, name) values
    ('10000000-0000-0000-0000-000000000001', '${A}', 'Matrimonio'),
    ('10000000-0000-0000-0000-000000000002', '${A}', 'Comida');
  insert into subcategories (id, user_id, category_id, name) values
    ('20000000-0000-0000-0000-000000000001', '${A}', '10000000-0000-0000-0000-000000000001', 'Fotógrafo'),
    ('20000000-0000-0000-0000-000000000002', '${A}', '10000000-0000-0000-0000-000000000002', 'Restaurante');
  insert into expenses (id, user_id, subcategory_id, amount, merchant, occurred_at, source) values
    ('30000000-0000-0000-0000-000000000001', '${A}', '20000000-0000-0000-0000-000000000001', 800.00, 'Estudio Foto', now(), 'manual'),
    ('30000000-0000-0000-0000-000000000002', '${A}', '20000000-0000-0000-0000-000000000001', 1200.50, 'Estudio Foto', now(), 'manual'),
    ('30000000-0000-0000-0000-000000000003', '${A}', '20000000-0000-0000-0000-000000000002', 45.90, 'Pardos', now(), 'manual');
  insert into google_tokens (user_id, encrypted_refresh_token) values ('${A}', 'secreto');
  insert into integration_clients (client_id, name, webhook_url) values ('${CLIENT}', 'Casorio Club', 'https://casorio.test/api/webhooks/bernie');
`);

// Ejecuta como un rol con ciertos claims, en su propia transacción.
async function as(claims, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${claims ? "authenticated" : "anon"}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims ?? {})]);
    return fn(tx);
  });
}
const user = (sub) => ({ sub, role: "authenticated" });
const oauth = (sub, client_id = CLIENT) => ({ sub, role: "authenticated", client_id });
const rows = async (tx, q, p) => (await tx.query(q, p)).rows;
async function expectError(promise, code) {
  try {
    await promise;
  } catch (e) {
    assert.equal(e.code, code, `esperaba ${code}, llegó ${e.code}: ${e.message}`);
    return;
  }
  assert.fail(`esperaba error ${code}`);
}
const pending = async () =>
  (await db.query(`select type, user_id from integration_events where delivered_at is null`)).rows;
let n = 0;
const test = async (name, fn) => { await fn(); console.log(`  ✓ ${++n}. ${name}`); };

console.log("\nPruebas");

await test("token OAuth sin conexión: no ve tablas ni la función", async () => {
  await as(oauth(A), async (tx) => {
    assert.equal((await rows(tx, "select * from expenses")).length, 0);
    await expectError(tx.query("select * from shared_expense_changes(null, null, null, 10)"), "42501");
  });
});

await test("el usuario conecta y comparte Matrimonio → un solo aviso", async () => {
  await as(user(A), async (tx) => {
    await tx.query(`insert into integration_connections (user_id, client_id, client_name) values ($1, $2, 'Casorio Club')`, [A, CLIENT]);
    await tx.query(`insert into integration_shares (user_id, client_id, category_id) values ($1, $2, '10000000-0000-0000-0000-000000000001')`, [A, CLIENT]);
    await tx.query(`insert into integration_audit (user_id, client_id, action) values ($1, $2, 'granted')`, [A, CLIENT]);
  });
  assert.deepEqual(await pending(), [{ type: "expenses.sync_available", user_id: A }]);
});

await test("token OAuth: 0 filas en todas las tablas personales y no puede escribir", async () => {
  await as(oauth(A), async (tx) => {
    for (const t of ["users", "expenses", "google_tokens", "categories", "subcategories", "payment_methods", "integration_shares", "integration_connections", "integration_audit", "system_banks"]) {
      assert.equal((await rows(tx, `select * from ${t}`)).length, 0, t);
    }
  });
  await expectError(as(oauth(A), (tx) => tx.query(`insert into categories (user_id, name) values ($1, 'x')`, [A])), "42501");
});

await test("tablas de sistema: ni el propio usuario las ve", async () => {
  await as(user(A), async (tx) => {
    for (const t of ["integration_clients", "integration_events", "api_rate_limits", "expense_tombstones"]) {
      assert.equal((await rows(tx, `select * from ${t}`)).length, 0, t);
    }
  });
});

let cursor;
await test("sync inicial: solo lo compartido, con los campos mínimos", async () => {
  await as(oauth(A), async (tx) => {
    const r = await rows(tx, "select * from shared_expense_changes(null, null, null, 201)");
    assert.equal(r.length, 2);
    assert.ok(r.every((x) => !x.removed && x.subcategory === "Fotógrafo"));
    assert.deepEqual(r.map((x) => x.amount).sort(), ["1200.50", "800.00"]);
    const last = r.at(-1);
    const v = (await rows(tx, "select integration_shares_version() as v"))[0].v;
    cursor = { ts: last.changed_at, id: last.id, v };
  });
});

await test("otro cliente registrado pero no conectado → 42501", async () => {
  await db.exec(`insert into integration_clients (client_id, name) values ('otra', 'Otra')`);
  await expectError(as(oauth(A, "otra"), (tx) => tx.query("select * from shared_expense_changes(null, null, null, 10)")), "42501");
});

await test("usuario B con token de Casorio no ve nada de A", async () => {
  await expectError(as(oauth(B), (tx) => tx.query("select * from shared_expense_changes(null, null, null, 10)")), "42501");
});

await test("cambios: nuevo, editado, movido fuera, borrado y no compartido", async () => {
  await db.exec(`update integration_events set delivered_at = now()`);
  await new Promise((r) => setTimeout(r, 5));
  await as(user(A), async (tx) => {
    await tx.query(`update expenses set amount = 900 where id = '30000000-0000-0000-0000-000000000001'`);
    await tx.query(`update expenses set subcategory_id = '20000000-0000-0000-0000-000000000002' where id = '30000000-0000-0000-0000-000000000002'`);
    await tx.query(`update expenses set subcategory_id = '20000000-0000-0000-0000-000000000001' where id = '30000000-0000-0000-0000-000000000003'`);
    await tx.query(`insert into expenses (id, user_id, subcategory_id, amount, merchant, occurred_at, source) values ('30000000-0000-0000-0000-000000000004', $1, '20000000-0000-0000-0000-000000000001', 300, 'Joyería', now(), 'manual')`, [A]);
    await tx.query(`delete from expenses where id = '30000000-0000-0000-0000-000000000004'`);
  });
  assert.equal((await pending()).length, 1, "aviso deduplicado");
  await as(oauth(A), async (tx) => {
    const r = await rows(tx, "select * from shared_expense_changes($1, $2, $3, 201)", [cursor.ts, cursor.id, cursor.v]);
    const by = Object.fromEntries(r.map((x) => [x.id.slice(-1), x]));
    assert.equal(by["1"].removed, false); assert.equal(by["1"].amount, "900.00");
    assert.equal(by["2"].removed, true);  assert.equal(by["2"].merchant, null, "removed no expone datos");
    assert.equal(by["3"].removed, false); assert.equal(by["3"].merchant, "Pardos");
    assert.equal(by["4"].removed, true, "borrado → lápida");
  });
});

await test("cambiar categorías compartidas → cursor_reset (PT409)", async () => {
  await as(user(A), (tx) => tx.query(`insert into integration_shares (user_id, client_id, category_id) values ($1, $2, '10000000-0000-0000-0000-000000000002')`, [A, CLIENT]));
  await expectError(as(oauth(A), (tx) => tx.query("select * from shared_expense_changes($1, $2, $3, 201)", [cursor.ts, cursor.id, cursor.v])), "PT409");
});

await test("rate limit: 60 pasan, la 61 no", async () => {
  await as(oauth(A), async (tx) => {
    let last;
    for (let i = 0; i < 61; i++) last = (await rows(tx, "select * from consume_rate_limit(60)"))[0];
    assert.equal(last.allowed, false); assert.equal(last.remaining, 0);
  });
});

await test("una app no puede desconectar a otra", async () => {
  await expectError(as(oauth(A), (tx) => tx.query("select revoke_integration('otra')")), "42501");
});

await test("la app se desconecta sola → sin conexión, auditoría, sin grant.revoked", async () => {
  await db.exec(`update integration_events set delivered_at = now()`);
  await as(oauth(A), (tx) => tx.query(`select revoke_integration($1)`, [CLIENT]));
  const c = await db.query(`select * from integration_connections`);
  assert.equal(c.rows.length, 0);
  assert.equal((await db.query(`select * from integration_shares`)).rows.length, 0);
  assert.deepEqual((await db.query(`select action, detail from integration_audit where action = 'revoked'`)).rows, [{ action: "revoked", detail: { by: "client" } }]);
  assert.deepEqual(await pending(), [], "ni sync_available ni grant.revoked");
  await expectError(as(oauth(A), (tx) => tx.query("select * from shared_expense_changes(null, null, null, 10)")), "42501");
});

await test("el usuario desconecta desde Bernie → grant.revoked", async () => {
  await as(user(A), async (tx) => {
    await tx.query(`insert into integration_connections (user_id, client_id, client_name) values ($1, $2, 'Casorio Club')`, [A, CLIENT]);
  });
  await as(user(A), (tx) => tx.query(`select revoke_integration($1)`, [CLIENT]));
  assert.deepEqual((await pending()).map((e) => e.type), ["grant.revoked"]);
});

await test("anon no puede llamar las funciones", async () => {
  await expectError(as(null, (tx) => tx.query("select * from shared_expense_changes(null, null, null, 10)")), "42501");
  await expectError(as(null, (tx) => tx.query("select enqueue_sync_available(null, null)")), "42501");
});

await test("borrar al usuario en cascada no falla", async () => {
  await as(user(A), async (tx) => {
    await tx.query(`insert into integration_connections (user_id, client_id, client_name) values ($1, $2, 'Casorio Club')`, [A, CLIENT]);
    await tx.query(`insert into integration_shares (user_id, client_id, category_id) values ($1, $2, '10000000-0000-0000-0000-000000000001')`, [A, CLIENT]);
  });
  await db.exec(`delete from auth.users where id = '${A}'`);
  assert.equal((await db.query(`select * from users`)).rows.length, 1);
});

await test("borrar la cuenta arrastra todo lo del usuario", async () => {
  // El borrado de cuenta (derecho de supresión) depende de que la fila de `users`
  // arrastre en cascada el resto. Si una tabla nueva olvida el `on delete cascade`,
  // quedarían datos personales huérfanos y esta prueba falla.
  const C = "00000000-0000-0000-0000-00000000000c";
  await db.exec(`
    insert into auth.users (id) values ('${C}');
    insert into users (id, email) values ('${C}', 'c@x.com');
    insert into categories (id, user_id, name) values ('10000000-0000-0000-0000-00000000000c', '${C}', 'Comida');
    insert into subcategories (id, user_id, category_id, name) values ('20000000-0000-0000-0000-00000000000c', '${C}', '10000000-0000-0000-0000-00000000000c', 'Delivery');
    insert into expenses (user_id, subcategory_id, amount, merchant, occurred_at, source) values ('${C}', '20000000-0000-0000-0000-00000000000c', 10.00, 'Rappi', now(), 'manual');
    insert into google_tokens (user_id, encrypted_refresh_token) values ('${C}', 'secreto');
    insert into user_banks (id, user_id, system_bank_id) values ('40000000-0000-0000-0000-00000000000c', '${C}', (select id from system_banks limit 1));
    insert into payment_methods (user_id, user_bank_id, type, identifier) values ('${C}', '40000000-0000-0000-0000-00000000000c', 'credit_card', '1234');
    insert into sync_discoveries (user_id, message_id, sender, subject, verdict) values ('${C}', 'm1', 'banco@bcp', 'Consumo', 'not_expense');
    insert into sync_failures (user_id, message_id) values ('${C}', 'm2');
    insert into challenges (user_id, category_id, target_days, started_on) values ('${C}', '10000000-0000-0000-0000-00000000000c', 7, current_date);
  `);

  await db.exec(`delete from users where id = '${C}'`);

  for (const table of [
    "expenses", "subcategories", "categories", "google_tokens", "user_banks",
    "payment_methods", "sync_discoveries", "sync_failures", "challenges",
  ]) {
    const left = await db.query(`select count(*)::int as n from ${table} where user_id = $1`, [C]);
    assert.equal(left.rows[0].n, 0, `${table} quedó con datos del usuario borrado`);
  }
});

await test("panel admin: un usuario normal no obtiene nada", async () => {
  // Una prueba anterior borra al usuario A en cascada: se recrea para esta tanda.
  await db.exec(`
    insert into auth.users (id) values ('${A}') on conflict do nothing;
    insert into users (id, email) values ('${A}', 'a@x.com') on conflict do nothing;
  `);
  // La protección vive en las funciones, no en el guard de la página: aunque
  // alguien llame directo al RPC, sin is_admin no sale una sola fila.
  await as(user(A), async (tx) => {
    for (const fn of ["admin_sync_health", "admin_unmapped_subjects", "admin_usage"]) {
      const r = await rows(tx, `select * from ${fn}()`);
      assert.equal(r.length, 0, `${fn} devolvió datos a un usuario sin is_admin`);
    }
    assert.equal((await rows(tx, "select public.is_admin() as ok"))[0].ok, false);
  });
});

await test("panel admin: con is_admin cuenta, pero sigue sin poder leer gastos ajenos", async () => {
  // Un gasto de OTRO usuario: lo que el admin debe poder contar, no leer.
  await db.exec(`
    insert into expenses (user_id, amount, merchant, occurred_at, source)
    values ('${B}', 12.00, 'Tienda', now(), 'manual')
  `);
  await db.exec(`update users set is_admin = true where id = '${A}'`);
  await as(user(A), async (tx) => {
    const usage = await rows(tx, "select * from admin_usage()");
    assert.equal(usage.length, 1);
    assert.ok(Number(usage[0].expenses_total) >= 1, "cuenta los gastos de todos");

    // Lo que NO puede: ver las filas de otro usuario. RLS sigue aplicando sobre
    // las tablas; ser admin no abre una puerta a los datos.
    const ajenos = await rows(tx, `select * from expenses where user_id = '${B}'`);
    assert.equal(ajenos.length, 0, "un admin pudo leer gastos de otro usuario");
  });
  await db.exec(`update users set is_admin = false where id = '${A}'`);
});

await test("panel admin: la auditoría no la lee cualquiera", async () => {
  await db.exec(`insert into admin_audit (admin_id, action) values ('${A}', 'toggle_discovery')`);
  await as(user(B), async (tx) => {
    assert.equal((await rows(tx, "select * from admin_audit")).length, 0);
  });
  // Se devuelve el estado como lo dejó la prueba de borrado en cascada: la
  // siguiente tanda vuelve a crear al usuario A desde cero.
  await db.exec(`delete from auth.users where id = '${A}'`);
});

await test("cola de webhooks: reclamar, lease, completar y backoff", async () => {
  await db.exec(`delete from integration_events; insert into auth.users (id) values ('${A}'); insert into users (id, email) values ('${A}', 'a@x.com')`);
  await db.exec(`insert into integration_clients (client_id, name, webhook_url, webhook_secret) values ('wh', 'WH', 'https://wh.test', 'enc') on conflict do nothing`);
  await db.exec(`insert into integration_events (client_id, user_id, type, payload) values ('wh', '${A}', 'expenses.sync_available', '{}'), ('wh', '${A}', 'grant.revoked', '{}')`);
  const svc = (fn) => db.transaction(async (tx) => { await tx.query("set local role service_role"); return fn(tx); });
  const first = await svc((tx) => rows(tx, "select * from claim_integration_events(10)"));
  assert.equal(first.length, 2);
  assert.equal(first[0].webhook_url, "https://wh.test");
  assert.equal((await svc((tx) => rows(tx, "select * from claim_integration_events(10)"))).length, 0, "lease: no se reclama dos veces");
  await svc((tx) => tx.query("select complete_integration_event($1, true)", [first[0].id]));
  await svc((tx) => tx.query("select complete_integration_event($1, false, 'HTTP 500')", [first[1].id]));
  const [ok, failed] = [first[0].id, first[1].id];
  const ev = Object.fromEntries((await db.query(`select id, delivered_at is not null as delivered, attempts, last_error, next_attempt_at - now() as wait from integration_events`)).rows.map((r) => [r.id, r]));
  assert.equal(ev[ok].delivered, true);
  assert.equal(ev[failed].attempts, 1); assert.equal(ev[failed].last_error, "HTTP 500");
  for (let i = 0; i < 7; i++) await svc((tx) => tx.query("select complete_integration_event($1, false, 'x')", [failed]));
  const dead = (await db.query(`select dead_at is not null as dead, attempts from integration_events where id = $1`, [failed])).rows[0];
  assert.deepEqual(dead, { dead: true, attempts: 8 });
});

await test("cola de webhooks: ni usuarios ni anon pueden reclamar", async () => {
  await expectError(as(user(B), (tx) => tx.query("select * from claim_integration_events(10)")), "42501");
  await expectError(as(null, (tx) => tx.query("select complete_integration_event(gen_random_uuid(), true)")), "42501");
});


await test("reglas por comercio: cada usuario ve solo las suyas, y el token OAuth ninguna", async () => {
  await as(user(A), async (tx) => {
    await tx.query(
      `insert into merchant_rules (user_id, merchant_key) values ($1, 'JUAN P.')`,
      [A],
    );
    assert.equal((await rows(tx, "select * from merchant_rules")).length, 1);
  });

  // B no ve la regla de A, y no puede escribirla a su nombre.
  await as(user(B), async (tx) => {
    assert.equal((await rows(tx, "select * from merchant_rules")).length, 0);
    await expectError(
      tx.query(`insert into merchant_rules (user_id, merchant_key) values ($1, 'X')`, [A]),
      "42501",
    );
  });

  await as(oauth(A), async (tx) => {
    assert.equal((await rows(tx, "select * from merchant_rules")).length, 0);
  });

  // Una sola regla por comercio: la segunda choca con el único.
  await expectError(
    db.query(`insert into merchant_rules (user_id, merchant_key) values ($1, 'JUAN P.')`, [A]),
    "23505",
  );

  await db.query(`delete from merchant_rules where user_id = $1`, [A]);
});


console.log(`\n${n} pruebas OK`);
