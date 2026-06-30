-- 0005: nuevo tipo de medio de pago "account" (cuenta bancaria).
-- Motivo: la "Cuenta de origen" de un pago de servicio puede ser tarjeta (crédito
-- o débito) o una cuenta de ahorros/corriente. Para este último caso falta un
-- tipo propio: 'account', así no se confunde con una tarjeta de débito.

alter table payment_methods drop constraint payment_methods_type_check;
alter table payment_methods
  add constraint payment_methods_type_check
  check (type in ('credit_card', 'debit_card', 'yape', 'account'));
