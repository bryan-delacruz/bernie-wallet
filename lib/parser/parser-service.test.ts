import { test } from "node:test";
import assert from "node:assert/strict";
import { extractExpense } from "./parser-service.ts";

// Fixtures: réplicas de las plantillas reales de BCP/Yape con valores FICTICIOS.
// Verifican que el parser extraiga cada campo y que un cambio accidental en el
// código (refactor) no rompa la extracción. Un cambio real de plantilla del
// banco lo detecta `sync_failures` en producción, no estos tests.

const CREDIT_CARD = `Hola Bryan, Realizaste un consumo de S/ 23.50 con tu Tarjeta de Crédito BCP en PYU*The Coffee. Por tu seguridad, te enviamos los datos de tu operación. Monto Total del consumo S/ 23.50 Datos de la operación Operación realizada Consumo Tarjeta de Crédito Fecha y hora 15 de agosto de 2026 - 08:30 PM Número de Tarjeta de Crédito ************1234 Empresa PYU*The Coffee Número de operación 4567890123 ¿Problemas con tus compras?`;

const CREDIT_CARD_USD = `Hola Bryan, Realizaste un consumo de US$ 9.99 con tu Tarjeta de Crédito BCP en NETFLIX.COM. Monto Total del consumo US$ 9.99 Datos de la operación Operación realizada Consumo Tarjeta de Crédito Fecha y hora 15 de agosto de 2026 - 08:30 PM Número de Tarjeta de Crédito ************1234 Empresa NETFLIX.COM Número de operación 4567890123`;

const DEBIT_CARD = `Hola Bryan, Realizaste un consumo de S/ 15.00 con tu Tarjeta de Débito BCP en PLIN-Rosa maria Diaz. Monto Total del consumo S/ 15.00 Datos de la operación Operación realizada Consumo Tarjeta de Débito Fecha y hora 15 de agosto de 2026 - 09:00 AM Número de Tarjeta de Débito ************5678 Empresa PLIN-Rosa maria Diaz Número de operación 998877 ¿No reconoces esta operación?`;

const SERVICE_PAYMENT = `*Hola BRYAN,*\r\n\r\n¡Tu operación se realizó con éxito!\r\n\r\nOperación realizada:\r\n\r\n*Pago de servicios*\r\n\r\nNúmero de operación:\r\n\r\n*87654321*\r\n\r\nFecha y hora: *Jueves, 14 Agosto 2026 - 07:15 P. M.* Empresa: *CALIDDA GAS NATURAL DE LIMA Y CALLAO* Servicio: *CALIDDA RECIBO SOLES* Titular del servicio: *MARIA ELENA TORRES RAMIREZ GA* Código de usuario: *1234567* Comisión: ** Cuenta de origen: *Tarjeta de crédito\r\n**** 4321\r\nBRYAN* Vigencia: ** Valor venta: ** IGV: ** Subtotal: ** Monto total: *S/ 89.90* Tipo de cambio: **\r\n\r\nNº 1 Nº 1 Doc. pago: *S123-45678901* ** Vencimiento: *20/08/2026* ** Importe: *S/ 89.90* **`;

const SERVICE_PAYMENT_DEBIT = `*Hola BRYAN,*\r\n\r\n*Pago de servicios*\r\n\r\nNúmero de operación:\r\n\r\n*11112222*\r\n\r\nEmpresa: *WIN INTERNET* Servicio: *01 PAGO SOLES* Cuenta de origen: *Tarjeta de débito\r\n**** 9999\r\nBRYAN* Vigencia: ** Monto total: *S/ 120.00* Tipo de cambio: **\r\n\r\nNº 1 Doc. pago: *SR12-00998877* ** Vencimiento: *25/08/2026* **`;

const YAPE = `*¡Hola, Bryan De-*!*\r\n\r\n*¡Acabas de yapear exitosamente!*\r\n\r\n*Monto de yapeo**\r\n\r\nS/ 30.00\r\n\r\nYapero Bryan De-* Tu número de celular *********789 Fecha y Hora de la operación 15 agosto 2026 - 06:45 p. m. Celular del Beneficiario *********321 Nombre del Beneficiario Lucia Ram* Nº de operación 7654321\r\n\r\n*Por tu seguridad*`;

const TRANSFER = `Hola *Bryan,*\r\n\r\nRealizaste una transferencia de *S/ 150.00* desde tu *Clasica.*\r\n\r\n*Montos*\r\n\r\nMonto transferido *S/ 150.00* Tipo de cambio ** *Total cobrado al tipo de cambio* **\r\n\r\n*Datos de la operación*\r\n\r\nOperación realizada *Transferencia a terceros BCP* Fecha y hora *10 de Julio de 2026 - 03:20 PM* Enviado a *Perez Quispe Juan C.*\r\n**** 8888\r\nMoneda Soles Desde *Clasica*\r\n**** 2468\r\nMoneda Soles Número de operación *55667788*`;

test("credit card purchase (PEN)", () => {
  const r = extractExpense(CREDIT_CARD, "credit_card_purchase");
  assert.deepEqual(r, {
    amount: 23.5,
    currency: "PEN",
    merchant: "PYU*The Coffee",
    payment_method_identifier: "****1234",
    payment_source_type: "credit_card",
    operation_number: "4567890123",
    document_number: "",
  });
});

test("credit card purchase (USD)", () => {
  const r = extractExpense(CREDIT_CARD_USD, "credit_card_purchase");
  assert.equal(r?.amount, 9.99);
  assert.equal(r?.currency, "USD");
  assert.equal(r?.merchant, "NETFLIX.COM");
});

test("debit card purchase", () => {
  const r = extractExpense(DEBIT_CARD, "debit_card_purchase");
  assert.deepEqual(r, {
    amount: 15,
    currency: "PEN",
    merchant: "PLIN-Rosa maria Diaz",
    payment_method_identifier: "****5678",
    payment_source_type: "debit_card",
    operation_number: "998877",
    document_number: "",
  });
});

test("service payment (origen tarjeta de crédito)", () => {
  const r = extractExpense(SERVICE_PAYMENT, "service_payment");
  assert.deepEqual(r, {
    amount: 89.9,
    currency: "PEN",
    merchant: "CALIDDA GAS NATURAL DE LIMA Y CALLAO",
    payment_method_identifier: "****4321",
    payment_source_type: "credit_card",
    operation_number: "87654321",
    document_number: "S123-45678901",
  });
});

test("service payment (origen tarjeta de débito)", () => {
  const r = extractExpense(SERVICE_PAYMENT_DEBIT, "service_payment");
  assert.equal(r?.merchant, "WIN INTERNET");
  assert.equal(r?.payment_source_type, "debit_card");
  assert.equal(r?.payment_method_identifier, "****9999");
  assert.equal(r?.amount, 120);
  assert.equal(r?.document_number, "SR12-00998877");
});

test("yape: usa TU celular, no el del beneficiario", () => {
  const r = extractExpense(YAPE, "yape");
  assert.deepEqual(r, {
    amount: 30,
    currency: "PEN",
    merchant: "Lucia Ram",
    payment_method_identifier: "***789", // de "Tu número de celular", no ***321
    payment_source_type: "yape",
    operation_number: "7654321",
    document_number: "",
  });
});

test("transfer a terceros", () => {
  const r = extractExpense(TRANSFER, "transfer");
  assert.deepEqual(r, {
    amount: 150,
    currency: "PEN",
    merchant: "Perez Quispe Juan C.",
    payment_method_identifier: "****2468",
    payment_source_type: "account",
    operation_number: "55667788",
    document_number: "",
  });
});

test("correo no parseable → null", () => {
  assert.equal(extractExpense("Texto sin estructura de gasto", "credit_card_purchase"), null);
  assert.equal(extractExpense("", "yape"), null);
});
