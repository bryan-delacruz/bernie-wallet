-- 0003: asuntos precisos (solo correos de GASTO) + nuevo tipo "transfer".
-- Motivo: el patrón "Tarjeta de Crédito" capturaba también los correos de
-- PAGO de la tarjeta (no son gasto). Ahora exigimos la frase del consumo.

-- 1) Permitir el nuevo notification_type 'transfer'.
alter table system_senders drop constraint system_senders_notification_type_check;
alter table system_senders
  add constraint system_senders_notification_type_check
  check (notification_type in (
    'credit_card_purchase',
    'debit_card_purchase',
    'service_payment',
    'yape',
    'transfer'
  ));

-- 2) Frases clave precisas (extraídas de los asuntos reales de BCP).
update system_senders
  set subject_pattern = 'Realizaste un consumo con tu Tarjeta de Crédito'
  where notification_type = 'credit_card_purchase';

update system_senders
  set subject_pattern = 'Realizaste un consumo con tu Tarjeta de Débito'
  where notification_type = 'debit_card_purchase';

update system_senders
  set subject_pattern = 'CONSTANCIA DE PAGO DE SERVICIO'
  where notification_type = 'service_payment';

-- "yapeo" era muy amplio (capturaba "Cambios en monto de yapeo alto", etc.).
update system_senders
  set subject_pattern = 'Por tu seguridad, te notificaremos por cada yapeo que realices'
  where notification_type = 'yape';

-- 3) Nuevo: transferencia a terceros (también es un gasto).
insert into system_senders (system_bank_id, sender, subject_pattern, notification_type)
values (
  '00000000-0000-0000-0000-000000000001',
  'notificaciones@notificacionesbcp.com.pe',
  'Transferencia a Terceros',
  'transfer'
);
