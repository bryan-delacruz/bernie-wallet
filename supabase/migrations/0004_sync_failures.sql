-- 0004: contador de intentos fallidos por correo (dead-letter).
-- Motivo: si un correo lanza error transitorio una y otra vez, el sync no debe
-- quedarse pegado en él. Llevamos la cuenta de intentos por (usuario, correo) y,
-- al llegar al tope, lo descartamos para seguir con los demás.

create table sync_failures (
  user_id     uuid not null references users (id) on delete cascade,
  message_id  text not null,
  attempts    int not null default 0,
  last_error  text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table sync_failures enable row level security;

create policy "user accesses only own data"
  on sync_failures for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
