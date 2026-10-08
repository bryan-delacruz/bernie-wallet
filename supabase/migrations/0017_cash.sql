-- 0017: efectivo como medio de pago (SPEC §7.2).
--
-- Un retiro en cajero no es un gasto: la plata pasa de la cuenta al bolsillo
-- (§10.1). Pero lo que se compra con ese efectivo sí lo es, y hasta ahora no había
-- dónde anotarlo: todo gasto manual tenía que colgar de una tarjeta o una cuenta.
--
-- El efectivo no tiene banco ni número, así que las dos columnas que lo exigían
-- pasan a ser opcionales — pero solo para él: un CHECK impide que una tarjeta se
-- quede sin identificador por descuido.

alter table payment_methods drop constraint payment_methods_type_check;
alter table payment_methods
  add constraint payment_methods_type_check
  check (type in ('credit_card', 'debit_card', 'yape', 'account', 'cash'));

alter table payment_methods alter column user_bank_id drop not null;
alter table payment_methods alter column identifier drop not null;

alter table payment_methods
  add constraint payment_methods_cash_shape check (
    case
      when type = 'cash' then user_bank_id is null and identifier is null
      else user_bank_id is not null and identifier is not null
    end
  );

-- Un medio de efectivo para cada usuario que ya existe. Es universal: no hay nada
-- que configurar y, sin él, "Agregar gasto" obliga a elegir una tarjeta que no se
-- usó.
insert into payment_methods (user_id, type, alias)
select u.id, 'cash', 'Efectivo'
from users u
where not exists (
  select 1 from payment_methods p where p.user_id = u.id and p.type = 'cash'
);
