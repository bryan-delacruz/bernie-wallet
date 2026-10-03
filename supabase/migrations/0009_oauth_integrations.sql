-- 0009: apps conectadas vía OAuth 2.1 (SPEC §15).
-- Un access token OAuth de Supabase es un JWT `authenticated` con el sub del
-- usuario más el claim `client_id`. Sin esta migración, ese token leería todas
-- las tablas del usuario (incluido google_tokens). Aquí se cierra ese acceso y se
-- abre un único camino de solo lectura: shared_expense_changes().

-- ============================================================
-- Tablas de sistema: sin políticas, solo service_role (bypassa RLS)
-- ============================================================

-- Lista blanca de apps. Que exista el cliente en Supabase no basta: tiene que
-- estar aquí y activo para leer datos.
create table integration_clients (
  client_id      text primary key,
  name           text not null,
  webhook_url    text,
  -- Cifrado AES-256-GCM con INTEGRATION_SECRET_KEY; nunca en claro.
  webhook_secret text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Outbox de webhooks. Sin FK a users: los triggers encolan durante el borrado
-- en cascada de un usuario y la FK fallaría; se purga con pg_cron.
create table integration_events (
  id              uuid primary key default gen_random_uuid(), -- = cabecera webhook-id
  client_id       text not null references integration_clients (client_id) on delete cascade,
  user_id         uuid not null,
  type            text not null check (type in ('expenses.sync_available', 'grant.revoked')),
  payload         jsonb not null,
  attempts        int not null default 0,
  next_attempt_at timestamptz not null default now(),
  delivered_at    timestamptz,
  dead_at         timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);

create index integration_events_pending_idx
  on integration_events (next_attempt_at)
  where delivered_at is null and dead_at is null;

-- Un solo aviso pendiente por usuario y app: mil gastos sincronizados = un webhook.
create unique index integration_events_one_pending_sync
  on integration_events (client_id, user_id)
  where type = 'expenses.sync_available' and delivered_at is null and dead_at is null;

create table api_rate_limits (
  client_id    text not null,
  user_id      uuid not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (client_id, user_id, window_start)
);

alter table integration_clients enable row level security;
alter table integration_events  enable row level security;
alter table api_rate_limits     enable row level security;

-- ============================================================
-- Tablas personales
-- ============================================================

-- Una fila por app conectada. shares_version sube cada vez que cambian las
-- categorías compartidas: un cursor con otra versión se invalida (cursor_reset).
create table integration_connections (
  user_id        uuid not null references users (id) on delete cascade,
  client_id      text not null references integration_clients (client_id) on delete cascade,
  shares_version int not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, client_id)
);

create table integration_shares (
  user_id     uuid not null,
  client_id   text not null,
  category_id uuid not null references categories (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, client_id, category_id),
  foreign key (user_id, client_id)
    references integration_connections (user_id, client_id) on delete cascade
);

-- Historial de accesos del usuario. Sin update ni delete: solo se agrega.
create table integration_audit (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  client_id  text not null,
  action     text not null check (action in ('granted', 'shares_changed', 'revoked')),
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index integration_audit_user_idx on integration_audit (user_id, created_at desc);

-- Lápidas de gastos borrados, para avisar `removed` en la sync incremental.
-- Sin FK por la misma razón que integration_events.
create table expense_tombstones (
  expense_id uuid primary key,
  user_id    uuid not null,
  deleted_at timestamptz not null default now()
);

create index expense_tombstones_user_idx on expense_tombstones (user_id, deleted_at, expense_id);

alter table integration_connections enable row level security;
alter table integration_shares      enable row level security;
alter table integration_audit       enable row level security;
alter table expense_tombstones      enable row level security;

create policy "user accesses only own data"
  on integration_connections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user accesses only own data"
  on integration_shares for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user reads own audit"
  on integration_audit for select to authenticated
  using (user_id = auth.uid());

create policy "user appends own audit"
  on integration_audit for insert to authenticated
  with check (user_id = auth.uid());

-- expense_tombstones: sin políticas; solo la escriben triggers y la lee la función.

-- ============================================================
-- Los clientes OAuth no tocan ninguna tabla
-- ============================================================
-- Restrictivas: se combinan con AND con las existentes. Con client_id en el
-- token, ninguna fila pasa; con sesión directa, nada cambia.

do $$
declare
  t text;
begin
  foreach t in array array[
    'system_banks', 'system_senders',
    'users', 'user_banks', 'payment_methods', 'categories', 'subcategories',
    'expenses', 'sync_logs', 'google_tokens', 'sync_failures', 'sync_discoveries',
    'integration_connections', 'integration_shares', 'integration_audit'
  ] loop
    execute format(
      'create policy "no oauth clients" on %I as restrictive for all to authenticated
         using ((auth.jwt() ->> %L) is null)
         with check ((auth.jwt() ->> %L) is null)',
      t, 'client_id', 'client_id'
    );
  end loop;
end $$;

-- ============================================================
-- expenses.updated_at: la base del cursor
-- ============================================================

alter table expenses add column updated_at timestamptz not null default now();

create index expenses_user_updated_idx on expenses (user_id, updated_at, id);

create function set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger expenses_set_updated_at
  before update on expenses
  for each row execute function set_updated_at();

-- Mover una subcategoría de categoría (o renombrarla) cambia lo que ve cada app:
-- se tocan sus gastos para que salgan en la próxima sync.
create function touch_expenses_of_subcategory() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.category_id is distinct from old.category_id or new.name is distinct from old.name then
    update public.expenses set updated_at = now() where subcategory_id = new.id;
  end if;
  return new;
end $$;

create trigger subcategories_touch_expenses
  after update on subcategories
  for each row execute function touch_expenses_of_subcategory();

-- ============================================================
-- Avisos (outbox) y lápidas
-- ============================================================

-- ¿La categoría de esta subcategoría está compartida con algún cliente activo
-- que tenga webhook? Encola un aviso por cada uno (deduplicado por el índice).
create function enqueue_sync_available(p_user_id uuid, p_subcategory_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_subcategory_id is null then
    return;
  end if;

  insert into public.integration_events (client_id, user_id, type, payload)
  select s.client_id, p_user_id, 'expenses.sync_available',
         jsonb_build_object('userId', p_user_id)
  from public.integration_shares s
  join public.subcategories sc on sc.category_id = s.category_id
  join public.integration_clients c on c.client_id = s.client_id
  where s.user_id = p_user_id
    and sc.id = p_subcategory_id
    and c.active and c.webhook_url is not null
  on conflict (client_id, user_id)
    where type = 'expenses.sync_available' and delivered_at is null and dead_at is null
    do nothing;
end $$;

create function expenses_integration_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Atajo: la gran mayoría de usuarios no tiene apps conectadas.
  if not exists (
    select 1 from public.integration_shares
    where user_id = coalesce(new.user_id, old.user_id)
  ) then
    return null;
  end if;

  if tg_op = 'DELETE' then
    insert into public.expense_tombstones (expense_id, user_id)
    values (old.id, old.user_id)
    on conflict (expense_id) do update set deleted_at = now();
    perform public.enqueue_sync_available(old.user_id, old.subcategory_id);
  elsif tg_op = 'INSERT' then
    perform public.enqueue_sync_available(new.user_id, new.subcategory_id);
  else
    -- Cambiar de subcategoría puede sacarlo de una categoría compartida: se avisa a las dos.
    perform public.enqueue_sync_available(new.user_id, new.subcategory_id);
    if new.subcategory_id is distinct from old.subcategory_id then
      perform public.enqueue_sync_available(old.user_id, old.subcategory_id);
    end if;
  end if;
  return null;
end $$;

create trigger expenses_integration_changes
  after insert or update or delete on expenses
  for each row execute function expenses_integration_changes();

-- Cambiar las categorías compartidas invalida los cursores de esa app y le avisa.
create function integration_shares_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id   uuid := coalesce(new.user_id, old.user_id);
  v_client_id text := coalesce(new.client_id, old.client_id);
begin
  update public.integration_connections
  set shares_version = shares_version + 1, updated_at = now()
  where user_id = v_user_id and client_id = v_client_id;

  -- Borrado en cascada al desconectar: ya no hay conexión a la que avisar.
  if not found then
    return null;
  end if;

  insert into public.integration_events (client_id, user_id, type, payload)
  select c.client_id, v_user_id, 'expenses.sync_available', jsonb_build_object('userId', v_user_id)
  from public.integration_clients c
  where c.client_id = v_client_id and c.active and c.webhook_url is not null
  on conflict (client_id, user_id)
    where type = 'expenses.sync_available' and delivered_at is null and dead_at is null
    do nothing;
  return null;
end $$;

create trigger integration_shares_changed
  after insert or delete on integration_shares
  for each row execute function integration_shares_changed();

-- ============================================================
-- API para clientes OAuth (el único camino de datos)
-- ============================================================

-- Valida el token: debe venir de un cliente OAuth registrado, activo y conectado.
create function integration_require_client() returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_client_id text := auth.jwt() ->> 'client_id';
begin
  if v_client_id is null or auth.uid() is null then
    raise exception 'oauth client token required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.integration_clients c
    join public.integration_connections ic on ic.client_id = c.client_id
    where c.client_id = v_client_id and c.active and ic.user_id = auth.uid()
  ) then
    raise exception 'client not connected' using errcode = '42501';
  end if;
  return v_client_id;
end $$;

create function integration_shares_version() returns int
language plpgsql stable security definer set search_path = '' as $$
declare
  v_client_id text := public.integration_require_client();
begin
  return (
    select shares_version from public.integration_connections
    where user_id = auth.uid() and client_id = v_client_id
  );
end $$;

-- Cambios desde el cursor (p_since_ts, p_since_id), ordenados por (ts, id).
-- Sin cursor = sincronización inicial: solo lo compartido, sin borrados.
-- Con cursor: un gasto que dejó de estar compartido sale como removed. Puede
-- incluir ids que el cliente nunca vio; el cliente los ignora.
-- El llamador pide p_limit + 1 filas para saber si hay más.
-- PT409 → PostgREST responde 409: el cliente debe borrar su cursor y empezar de cero.
create function shared_expense_changes(
  p_since_ts       timestamptz,
  p_since_id       uuid,
  p_shares_version int,
  p_limit          int
)
returns table (
  id          uuid,
  removed     boolean,
  occurred_at timestamptz,
  amount      numeric,
  currency    text,
  merchant    text,
  subcategory text,
  changed_at  timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_client_id text := public.integration_require_client();
  v_uid       uuid := auth.uid();
  v_version   int;
begin
  if p_limit is null or p_limit < 1 or p_limit > 501 then
    raise exception 'limit out of range' using errcode = '22023';
  end if;

  select ic.shares_version into v_version
  from public.integration_connections ic
  where ic.user_id = v_uid and ic.client_id = v_client_id;

  if p_since_ts is not null and (
       p_shares_version is distinct from v_version
       or p_since_ts < now() - interval '90 days'
     ) then
    raise exception 'cursor_reset' using errcode = 'PT409';
  end if;

  return query
  with shared_categories as (
    select s.category_id from public.integration_shares s
    where s.user_id = v_uid and s.client_id = v_client_id
  ),
  changes as (
    select e.id,
           (sc.category_id is null or sc.category_id not in (select category_id from shared_categories)) as removed,
           e.occurred_at, e.amount, e.currency, e.merchant, sc.name as subcategory,
           e.updated_at as changed_at
    from public.expenses e
    left join public.subcategories sc on sc.id = e.subcategory_id
    where e.user_id = v_uid
      and (p_since_ts is null or (e.updated_at, e.id) > (p_since_ts, p_since_id))
    union all
    select t.expense_id, true, null, null, null, null, null, t.deleted_at
    from public.expense_tombstones t
    where p_since_ts is not null
      and t.user_id = v_uid
      and (t.deleted_at, t.expense_id) > (p_since_ts, p_since_id)
  )
  select c.id, c.removed,
         case when c.removed then null else c.occurred_at end,
         case when c.removed then null else c.amount end,
         case when c.removed then null else c.currency end,
         case when c.removed then null else c.merchant end,
         case when c.removed then null else c.subcategory end,
         c.changed_at
  from changes c
  where p_since_ts is not null or not c.removed
  order by c.changed_at, c.id
  limit p_limit;
end $$;

-- Ventana fija de 1 minuto por (cliente, usuario). Devuelve si pasa y cuántas quedan.
create function consume_rate_limit(p_limit int default 60)
returns table (allowed boolean, remaining int, reset_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_client_id text := public.integration_require_client();
  v_window    timestamptz := date_trunc('minute', now());
  v_count     int;
begin
  insert into public.api_rate_limits (client_id, user_id, window_start, count)
  values (v_client_id, auth.uid(), v_window, 1)
  on conflict (client_id, user_id, window_start)
    do update set count = public.api_rate_limits.count + 1
  returning public.api_rate_limits.count into v_count;

  return query select v_count <= p_limit, greatest(p_limit - v_count, 0), v_window + interval '1 minute';
end $$;

-- Desconectar. Con token OAuth: la app se desconecta a sí misma (solo la suya).
-- Con sesión directa: el usuario desconecta la app desde Configuración, y se le
-- avisa a la app con grant.revoked. La revocación del grant en Supabase Auth
-- (refresh tokens) la hace la capa de la app, no esta función.
create function revoke_integration(p_client_id text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid          uuid := auth.uid();
  v_token_client text := auth.jwt() ->> 'client_id';
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_token_client is not null and v_token_client <> p_client_id then
    raise exception 'a client can only revoke itself' using errcode = '42501';
  end if;

  delete from public.integration_connections
  where user_id = v_uid and client_id = p_client_id;

  if not found then
    return;
  end if;

  insert into public.integration_audit (user_id, client_id, action, detail)
  values (v_uid, p_client_id, 'revoked',
          jsonb_build_object('by', case when v_token_client is null then 'user' else 'client' end));

  if v_token_client is null then
    insert into public.integration_events (client_id, user_id, type, payload)
    select c.client_id, v_uid, 'grant.revoked', jsonb_build_object('userId', v_uid)
    from public.integration_clients c
    where c.client_id = p_client_id and c.webhook_url is not null;
  end if;
end $$;

-- Funciones expuestas: solo usuarios autenticados. Las internas, a nadie.
revoke execute on function
  integration_require_client(), integration_shares_version(),
  shared_expense_changes(timestamptz, uuid, int, int), consume_rate_limit(int),
  revoke_integration(text), enqueue_sync_available(uuid, uuid),
  expenses_integration_changes(), integration_shares_changed(),
  touch_expenses_of_subcategory(), set_updated_at()
from public, anon;

revoke execute on function
  enqueue_sync_available(uuid, uuid), expenses_integration_changes(),
  integration_shares_changed(), touch_expenses_of_subcategory(), set_updated_at()
from authenticated;

grant execute on function
  integration_shares_version(), shared_expense_changes(timestamptz, uuid, int, int),
  consume_rate_limit(int), revoke_integration(text)
to authenticated;

-- ============================================================
-- Limpieza
-- ============================================================

select cron.schedule(
  'bernie-integration-cleanup',
  '15 8 * * *', -- 03:15 en Lima
  $$
    delete from public.expense_tombstones where deleted_at < now() - interval '90 days';
    delete from public.integration_events
      where (delivered_at is not null or dead_at is not null) and created_at < now() - interval '30 days';
    delete from public.integration_events e
      where not exists (select 1 from public.users u where u.id = e.user_id);
    delete from public.api_rate_limits where window_start < now() - interval '1 hour';
  $$
);

-- ============================================================
-- Verificación manual (SQL editor, como el usuario y como la app)
-- ============================================================
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<user>","role":"authenticated","client_id":"<client>"}';
-- select count(*) from expenses;        -- 0: la app no ve tablas
-- select count(*) from google_tokens;   -- 0
-- select * from shared_expense_changes(null, null, null, 201);  -- solo lo compartido
