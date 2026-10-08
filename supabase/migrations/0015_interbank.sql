-- 0015: Interbank como segundo banco (SPEC §1, §10.1).
--
-- Se registran SOLO los asuntos que corresponden a un gasto real. Los que no lo
-- son quedan deliberadamente fuera: si el asunto no está acá, el correo ni siquiera
-- se descarga de Gmail, porque la query filtra por asunto.
--
--   · "Constancia de pago"          → pago de la propia tarjeta de crédito desde
--                                     una cuenta. Registrarlo contaría doble: las
--                                     compras de esa tarjeta ya entraron una a una.
--   · "Constancia de transferencia" → en la muestra va de una cuenta propia a otra
--                                     cuenta propia. No sale plata del patrimonio.
--                                     Falta una muestra de transferencia a un
--                                     tercero para poder distinguirlas; hasta
--                                     entonces, no se toca.
--
-- Las compras con tarjeta (TC/TD) todavía no tienen plantilla conocida: entran por
-- el modo descubrimiento (§9.3) en cuanto llegue la primera.

insert into system_banks (id, official_name, active)
values ('00000000-0000-0000-0000-000000000002', 'Interbank', true);

alter table system_senders drop constraint system_senders_notification_type_check;
alter table system_senders
  add constraint system_senders_notification_type_check
  check (notification_type in (
    'credit_card_purchase', 'debit_card_purchase', 'service_payment',
    'yape', 'transfer', 'plin'
  ));

insert into system_senders (system_bank_id, sender, subject_pattern, notification_type)
values (
  '00000000-0000-0000-0000-000000000002',
  'servicioalcliente@netinterbank.com.pe',
  'Constancia de Pago Plin',
  'plin'
);
