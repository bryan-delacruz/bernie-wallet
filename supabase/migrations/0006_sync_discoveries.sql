-- 0006: modo descubrimiento del sync (auditoría de gastos perdidos).
-- Motivo: validar que los filtros estrictos (remitente + asunto) no dejen fuera
-- correos que SÍ son gasto. La capa de descubrimiento escanea todos los correos
-- del banco (BCP/Yape) y registra aquí lo que Claude detecta, para refinar reglas.

create table sync_discoveries (
  user_id           uuid not null references users (id) on delete cascade,
  message_id        text not null,
  sender            text,
  subject           text,
  -- 'expense_candidate' (gasto que los filtros pierden) | 'not_expense' | 'covered'
  verdict           text not null,
  suggested_type    text,
  suggested_subject text,
  reason            text,
  updated_at        timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table sync_discoveries enable row level security;

create policy "user accesses only own data"
  on sync_discoveries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
