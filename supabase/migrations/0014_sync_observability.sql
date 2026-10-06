-- 0014: visibilidad de las sincronizaciones (SPEC §9.2).
-- Hoy `sync_logs` solo registra las corridas que terminan bien, así que un usuario
-- al que le falla el sync es invisible: él ve gastos que no aparecen y nadie se
-- entera. Se amplía la misma tabla en vez de crear otra.
--
-- Solo números y códigos: ni asuntos, ni remitentes, ni montos. Lo que se necesite
-- del contenido de un correo vive en `sync_discoveries`, protegido por RLS.

alter table sync_logs
  add column source text not null default 'manual'
    check (source in ('manual', 'cron')),
  -- Correos dados por perdidos en la corrida (agotaron reintentos).
  add column discarded int not null default 0,
  -- El cortacircuitos paró la corrida: se asumió caída del servicio.
  add column halted boolean not null default false,
  -- Código corto del fallo, nunca el mensaje: un mensaje puede traer datos del
  -- correo. 'gmail_auth' | 'unexpected'.
  add column error_code text;

-- Para la consulta de diagnóstico: últimas corridas con problema.
create index sync_logs_problems_idx
  on sync_logs (created_at desc)
  where error_code is not null or halted or discarded > 0;
