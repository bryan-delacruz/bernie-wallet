-- 0008: blindaje para las cuentas anónimas de la demo.
-- Las políticas restrictivas se combinan con AND con las existentes: una
-- cuenta anónima nunca guarda tokens de Google ni estado de sincronización.

create policy "no anonymous google tokens" on google_tokens as restrictive for all to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
create policy "no anonymous sync logs" on sync_logs as restrictive for all to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
create policy "no anonymous sync failures" on sync_failures as restrictive for all to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
create policy "no anonymous sync discoveries" on sync_discoveries as restrictive for all to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- Función del event trigger: corre como su dueño al crear tablas, nunca por la API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
