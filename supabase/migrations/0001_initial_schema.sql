-- Bernie Wallet — initial schema (v0)
-- Tablas de sistema (sin RLS de usuario), tablas personales (RLS por user_id) y seed de BCP.

-- ============================================================
-- System tables (admin-managed, read-only for authenticated users)
-- ============================================================

create table system_banks (
  id            uuid primary key default gen_random_uuid(),
  official_name text    not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table system_senders (
  id                uuid primary key default gen_random_uuid(),
  system_bank_id    uuid not null references system_banks (id) on delete cascade,
  sender            text not null,
  subject_pattern   text not null,
  notification_type text not null
    check (notification_type in ('credit_card_purchase', 'debit_card_purchase', 'service_payment', 'yape')),
  created_at        timestamptz not null default now()
);

create index system_senders_bank_idx on system_senders (system_bank_id);

-- ============================================================
-- User tables (RLS: each row is owned by user_id = auth.uid())
-- ============================================================

create table users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  plan       text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create table user_banks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  system_bank_id uuid not null references system_banks (id),
  alias          text,
  created_at     timestamptz not null default now()
);

create index user_banks_user_idx on user_banks (user_id);

create table payment_methods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  user_bank_id uuid not null references user_banks (id) on delete cascade,
  type         text not null check (type in ('credit_card', 'debit_card', 'yape')),
  identifier   text not null,
  alias        text,
  created_at   timestamptz not null default now()
);

create index payment_methods_user_idx on payment_methods (user_id);

create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index categories_user_idx on categories (user_id);

create table subcategories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create index subcategories_user_idx on subcategories (user_id);
create index subcategories_category_idx on subcategories (category_id);

create table expenses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users (id) on delete cascade,
  payment_method_id uuid references payment_methods (id) on delete set null,
  subcategory_id    uuid references subcategories (id) on delete set null,
  amount            numeric(12, 2) not null,
  currency          text not null default 'PEN',
  merchant          text not null,
  occurred_at       timestamptz not null,
  operation_number  text,
  document_number   text,
  message_id        text,
  source            text not null check (source in ('sync', 'manual')),
  created_at        timestamptz not null default now()
);

create index expenses_user_occurred_idx on expenses (user_id, occurred_at desc);

-- Anti-duplicados: un mismo correo (message_id) no se registra dos veces por usuario.
create unique index expenses_user_message_idx
  on expenses (user_id, message_id)
  where message_id is not null;

create table sync_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users (id) on delete cascade,
  last_sync_at     timestamptz not null,
  emails_processed int not null default 0,
  emails_new       int not null default 0,
  created_at       timestamptz not null default now()
);

create index sync_logs_user_idx on sync_logs (user_id, created_at desc);

create table google_tokens (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique references users (id) on delete cascade,
  encrypted_refresh_token text not null,
  scope                   text,
  updated_at              timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

-- System tables: lectura para usuarios autenticados; escritura solo vía service role (bypassa RLS).
alter table system_banks   enable row level security;
alter table system_senders enable row level security;

create policy "authenticated can read system_banks"
  on system_banks for select to authenticated using (true);

create policy "authenticated can read system_senders"
  on system_senders for select to authenticated using (true);

-- User tables: cada usuario accede solo a sus propias filas.
alter table users            enable row level security;
alter table user_banks       enable row level security;
alter table payment_methods  enable row level security;
alter table categories       enable row level security;
alter table subcategories    enable row level security;
alter table expenses         enable row level security;
alter table sync_logs        enable row level security;
alter table google_tokens    enable row level security;

create policy "user accesses only own row"
  on users for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "user accesses only own data"
  on user_banks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user accesses only own data"
  on payment_methods for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user accesses only own data"
  on categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user accesses only own data"
  on subcategories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user accesses only own data"
  on expenses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user accesses only own data"
  on sync_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user accesses only own data"
  on google_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- Seed: BCP y sus remitentes (subject_pattern es el texto literal del correo real)
-- ============================================================

insert into system_banks (id, official_name, active)
values ('00000000-0000-0000-0000-000000000001', 'BCP', true);

insert into system_senders (system_bank_id, sender, subject_pattern, notification_type)
values
  ('00000000-0000-0000-0000-000000000001', 'notificaciones@notificacionesbcp.com.pe', 'Tarjeta de Crédito',              'credit_card_purchase'),
  ('00000000-0000-0000-0000-000000000001', 'notificaciones@notificacionesbcp.com.pe', 'Tarjeta de Débito',               'debit_card_purchase'),
  ('00000000-0000-0000-0000-000000000001', 'notificaciones@notificacionesbcp.com.pe', 'CONSTANCIA DE PAGO DE SERVICIO',  'service_payment'),
  ('00000000-0000-0000-0000-000000000001', 'notificaciones@yape.pe',                  'yapeo',                           'yape');
