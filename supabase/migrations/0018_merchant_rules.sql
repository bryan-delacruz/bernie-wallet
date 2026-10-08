-- 0018: reglas por comercio (SPEC §18.8).
--
-- La memoria por comercio (§9) supone "mismo comercio = mismo gasto". Vale para un
-- supermercado y no vale para una persona: el mismo Yape puede ser la renta, un
-- préstamo devuelto o la cena compartida. Esta tabla es la excepción que el usuario
-- declara, y manda sobre lo aprendido.
--
-- `subcategory_id` nulo significa "no generalizar este comercio": ni se sugiere ni
-- el sync autocategoriza. La columna queda para una regla futura de fijar una
-- subcategoría; hoy la app solo escribe nulo.

create table merchant_rules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  -- Comercio normalizado (mayúsculas, espacios colapsados), igual que la memoria.
  merchant_key   text not null check (length(merchant_key) between 1 and 200),
  subcategory_id uuid references subcategories (id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (user_id, merchant_key)
);

create index merchant_rules_user_idx on merchant_rules (user_id);

alter table merchant_rules enable row level security;

create policy "user accesses only own data"
  on merchant_rules for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Misma restrictiva que el resto de las tablas de usuario (0009): un token con
-- client_id no ve ni escribe nada.
create policy "no oauth clients" on merchant_rules as restrictive for all to authenticated
  using ((auth.jwt() ->> 'client_id') is null)
  with check ((auth.jwt() ->> 'client_id') is null);
