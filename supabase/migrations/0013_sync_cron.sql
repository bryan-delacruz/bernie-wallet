-- 0013: sincronización automática (SPEC §9.1).
-- Sin esto, "tus gastos se anotan solos" solo es cierto mientras alguien aprieta el
-- botón: el usuario que no sabe que existe abre la app y la ve vacía.
--
-- Tres corridas al día en horario de Lima (UTC-5). Las notificaciones del banco
-- llegan al instante, pero nadie revisa sus gastos cada hora; y la de la mañana
-- corre antes de las 10, para que lo que diga Bernie a esa hora sea cierto.
--
-- La URL y el secreto viven en Vault (SPEC §15.9), nunca en el SQL. Es el mismo
-- patrón que la entrega de respaldo de webhooks.

select cron.schedule(
  'bernie-sync-all',
  '50 14,19,2 * * *', -- 09:50, 14:50 y 21:50 en Lima
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'bernie_site_url')
             || '/api/internal/sync-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'internal_cron_secret')
      ),
      body := '{}'::jsonb
    )
  $$
);
