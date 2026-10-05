-- 0011: retos de abstinencia (SPEC §16.6.1).
-- Lo único que se guarda es la apuesta: a qué categoría le apuntó el usuario, por
-- cuántos días y cuándo empezó. El progreso se deriva de `expenses`, así que no hay
-- contador que pueda desfasarse del dato real. Romper el reto no lo cierra: el
-- conteo se reinicia solo y por eso no hay estado "roto".

create table challenges (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  -- Uno de los dos, nunca ambos: el reto apunta a una categoría entera o a una
  -- subcategoría concreta.
  category_id    uuid references categories (id) on delete cascade,
  subcategory_id uuid references subcategories (id) on delete cascade,
  target_days    int not null check (target_days in (7, 14, 30)),
  -- Días civiles de Lima, no instantes: el reto se mide por día, no por hora.
  started_on     date not null,
  ended_on       date,
  outcome        text not null default 'active'
                 check (outcome in ('active', 'done', 'abandoned')),
  created_at     timestamptz not null default now(),
  constraint challenges_one_target check (
    (category_id is null) <> (subcategory_id is null)
  ),
  -- Un reto cerrado tiene fecha de cierre; uno activo, no.
  constraint challenges_ended_matches_outcome check (
    (outcome = 'active') = (ended_on is null)
  )
);

-- Un solo reto activo por usuario (SPEC §16.6.1).
create unique index challenges_one_active_idx
  on challenges (user_id)
  where outcome = 'active';

create index challenges_user_started_idx on challenges (user_id, started_on desc);

alter table challenges enable row level security;

create policy "user accesses only own data"
  on challenges for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Misma restrictiva que el resto de las tablas de usuario (0009): un token con
-- client_id no ve ni escribe nada.
create policy "no oauth clients" on challenges as restrictive for all to authenticated
  using ((auth.jwt() ->> 'client_id') is null)
  with check ((auth.jwt() ->> 'client_id') is null);
