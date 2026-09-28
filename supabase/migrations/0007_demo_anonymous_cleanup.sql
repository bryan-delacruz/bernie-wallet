-- 0007: limpieza de las cuentas de demostración.
-- "Probar la demo" crea un usuario anónimo de Supabase con gastos de ejemplo.
-- Cada noche se borran los anónimos con más de 24 horas; sus datos caen en
-- cascada (users → user_banks, payment_methods, categories, expenses…).
-- Requiere activar "Allow anonymous sign-ins" en Authentication → Sign In / Providers.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'bernie-delete-demo-users',
  '0 8 * * *', -- 03:00 en Lima
  $$delete from auth.users where is_anonymous and created_at < now() - interval '24 hours'$$
);
