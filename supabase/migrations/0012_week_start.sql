-- 0012: primer día de la semana, por usuario (SPEC §16.5).
-- Por defecto lunes: es lo que fija ISO 8601 y lo que usan los calendarios de la
-- región. El domingo queda como opción para quien venga de esa convención.

alter table users
  add column week_starts_on text not null default 'monday'
    check (week_starts_on in ('monday', 'sunday'));
