-- 0019: estado del aviso para ordenar pendientes (SPEC §18.6).
--
-- El aviso de Actividad es permanente justo para quien más lo necesita: con
-- cientos de pendientes se ve todos los días y en una semana deja de verse. Para
-- poder descartarlo hace falta recordar el descarte, y recordarlo **por usuario**
-- y no por navegador: "no me molestes" es una preferencia de la persona, no del
-- dispositivo donde la expresó.
--
-- Se guardan los pendientes que había al descartar, no solo la fecha: el aviso
-- vuelve cuando el backlog creció lo suficiente como para tener algo nuevo que
-- decir, no porque pasó el tiempo.

alter table users
  -- Apagado total desde Configuración. Lo de arriba es el comportamiento por
  -- defecto; esto es para quien no quiere el aviso nunca.
  add column categorize_hint_enabled boolean not null default true,
  add column categorize_hint_dismissed_at timestamptz,
  add column categorize_hint_pending_at int;
