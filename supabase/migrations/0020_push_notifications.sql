-- 0020: notificación diaria de Bernie (SPEC §19).
--
-- La app registra sola y no pide nada; el riesgo es que el usuario se olvide de
-- que existe. Una vez al día Bernie saluda, y para eso hace falta guardar a dónde
-- mandar el aviso y quién lo quiere.

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  -- La URL que el navegador da para empujar. Única: un navegador, una fila.
  endpoint   text not null unique,
  -- Claves de cifrado del payload. Hoy no se usan —el aviso va vacío y el service
  -- worker pide la frase— pero son lo que haría falta para mandar contenido.
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  -- Último error de envío. Las muertas (404/410) se borran; estas se reintentan.
  failed_at  timestamptz
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "user accesses only own data"
  on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Misma restrictiva que el resto de las tablas de usuario (0009).
create policy "no oauth clients" on push_subscriptions as restrictive for all to authenticated
  using ((auth.jwt() ->> 'client_id') is null)
  with check ((auth.jwt() ->> 'client_id') is null);

alter table users
  -- Opt-in explícito: el permiso del navegador se pide cuando el usuario prende
  -- esto, no al entrar. Pedirlo de entrada es la forma más rápida de que lo nieguen.
  add column daily_notification_enabled boolean not null default false,
  -- Para no repetir frase dos días seguidos ni mandar dos veces el mismo día.
  add column last_phrase_id text,
  add column last_notified_on date;

-- 15:00 UTC = 10:00 en Lima. El sync automático de la mañana corre 09:50 (§9.1)
-- justamente para que lo que Bernie diga a las 10 sea cierto.
select cron.schedule(
  'bernie-notify-all',
  '0 15 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'bernie_site_url')
             || '/api/internal/notify-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'internal_cron_secret')
      ),
      body := '{}'::jsonb
    )
  $$
);
