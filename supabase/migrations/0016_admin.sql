-- 0016: panel de administración (SPEC §17).
--
-- La regla que ordena todo: el panel **solo cuenta**. No existe ninguna función
-- que devuelva filas de `expenses`, así que comprometer el panel expone "hay N
-- usuarios", no la plata de nadie.
--
-- Las funciones son `security definer` para poder leer por encima de RLS, y cada
-- una valida `is_admin` en su primera línea: la protección vive acá, no en el
-- guard de la página.

alter table users add column is_admin boolean not null default false;

-- Descubrimiento por banco, en vez de una variable de entorno global (§17.6):
-- se enciende solo donde hace falta, se apaga sin desplegar y deja rastro.
alter table system_banks add column discovering boolean not null default false;

-- ============================================================
-- Auditoría: toda acción del panel que cambie algo deja rastro.
-- ============================================================

create table admin_audit (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references users (id) on delete cascade,
  action     text not null,
  target     text,
  -- Valor anterior y nuevo, para poder deshacer a mano si hizo falta.
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_recent_idx on admin_audit (created_at desc);

alter table admin_audit enable row level security;

-- Solo los admins leen la auditoría; escribirla es cosa de las funciones.
create policy "admins read audit"
  on admin_audit for select to authenticated
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));

create policy "no oauth clients" on admin_audit as restrictive for all to authenticated
  using ((auth.jwt() ->> 'client_id') is null)
  with check ((auth.jwt() ->> 'client_id') is null);

create function is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false)
$$;

-- ============================================================
-- Métricas: conteos y nada más.
-- ============================================================

create function admin_sync_health()
returns table (
  window_label text,
  source text,
  runs bigint,
  failed bigint,
  gmail_auth bigint,
  halted bigint,
  discarded bigint,
  new_expenses bigint
)
language sql stable security definer set search_path = '' as $$
  select
    w.label,
    l.source,
    count(*),
    count(*) filter (where l.error_code is not null),
    count(*) filter (where l.error_code = 'gmail_auth'),
    count(*) filter (where l.halted),
    coalesce(sum(l.discarded), 0),
    coalesce(sum(l.emails_new), 0)
  from (values ('24h', interval '24 hours'), ('7d', interval '7 days')) as w(label, span)
  join public.sync_logs l on l.created_at > now() - w.span
  where public.is_admin()
  group by w.label, l.source
  order by w.label, l.source
$$;

/** Asuntos que llegaron de un remitente conocido y no están mapeados. Es lo único
 *  con texto libre que ve el panel, porque mapear un banco exige leerlo. Va sin
 *  `user_id`: interesa la plantilla, no de quién es el correo. */
create function admin_unmapped_subjects()
returns table (sender text, subject text, seen bigint, last_seen timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.sender, d.subject, count(*), max(d.updated_at)
  from public.sync_discoveries d
  where public.is_admin()
    and not exists (
      select 1 from public.system_senders s
      where d.sender like '%' || s.sender || '%'
        and d.subject ilike '%' || s.subject_pattern || '%'
    )
  group by d.sender, d.subject
  order by max(d.updated_at) desc
  limit 50
$$;

create function admin_usage()
returns table (
  users_total bigint,
  users_connected bigint,
  users_active_7d bigint,
  expenses_total bigint,
  expenses_7d bigint
)
language sql stable security definer set search_path = '' as $$
  select
    -- Las sesiones de demo son usuarios anónimos de auth: no cuentan como usuarios.
    (select count(*) from public.users u
       join auth.users a on a.id = u.id
      where not coalesce(a.is_anonymous, false)),
    (select count(*) from public.google_tokens),
    (select count(distinct user_id) from public.expenses where created_at > now() - interval '7 days'),
    (select count(*) from public.expenses),
    (select count(*) from public.expenses where created_at > now() - interval '7 days')
  where public.is_admin()
$$;

grant execute on function
  is_admin(), admin_sync_health(), admin_unmapped_subjects(), admin_usage()
to authenticated;
