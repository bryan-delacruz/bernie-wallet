import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  groupUncategorized,
  normMerchant,
  tallyMerchantMemory,
  type PendingExpense,
} from "./merchant.ts";

function pending(
  id: string,
  merchant: string | null,
  amount: number,
  occurredAt: string,
  currency = "PEN",
): PendingExpense {
  return { id, merchant, amount, currency, occurred_at: occurredAt };
}

test("normMerchant agrupa variantes de grafía del mismo comercio", () => {
  assert.equal(normMerchant("  plaza   vea "), "PLAZA VEA");
  assert.equal(normMerchant("Plaza Vea"), normMerchant("PLAZA  VEA"));
  assert.equal(normMerchant(""), "");
});

test("la memoria elige la subcategoría más frecuente del comercio", () => {
  const memory = tallyMerchantMemory([
    { merchant: "Plaza Vea", subcategory_id: "mercado" },
    { merchant: "PLAZA VEA", subcategory_id: "mercado" },
    { merchant: "plaza vea", subcategory_id: "antojos" },
  ]);
  assert.equal(memory.get("PLAZA VEA"), "mercado");
});

test("la memoria ignora filas sin comercio o sin subcategoría", () => {
  const memory = tallyMerchantMemory([
    { merchant: null, subcategory_id: "mercado" },
    { merchant: "Rappi", subcategory_id: null },
  ]);
  assert.equal(memory.size, 0);
});

test("en empate gana la primera fila, que es la más reciente", () => {
  // El llamador ordena por fecha descendente.
  const memory = tallyMerchantMemory([
    { merchant: "Rappi", subcategory_id: "reciente" },
    { merchant: "Rappi", subcategory_id: "antigua" },
  ]);
  assert.equal(memory.get("RAPPI"), "reciente");
});

test("agrupa por comercio normalizado y suma por moneda", () => {
  const groups = groupUncategorized([
    pending("1", "Plaza Vea", 30, "2026-10-01T12:00:00Z"),
    pending("2", "PLAZA  VEA", 20, "2026-10-05T12:00:00Z"),
    pending("3", "Plaza Vea", 5, "2026-10-03T12:00:00Z", "USD"),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "PLAZA VEA");
  assert.equal(groups[0].count, 3);
  assert.deepEqual(groups[0].expenseIds.sort(), ["1", "2", "3"]);
  assert.deepEqual(groups[0].totals, [
    { currency: "PEN", amount: 50 },
    { currency: "USD", amount: 5 },
  ]);
  assert.equal(groups[0].firstAt, "2026-10-01T12:00:00Z");
  assert.equal(groups[0].lastAt, "2026-10-05T12:00:00Z");
});

test("el nombre visible es el del gasto más reciente", () => {
  const groups = groupUncategorized([
    pending("1", "PLAZA VEA SURCO", 10, "2026-10-01T12:00:00Z"),
    pending("2", "Plaza Vea Surco", 10, "2026-10-09T12:00:00Z"),
  ]);
  assert.equal(groups[0].label, "Plaza Vea Surco");
});

test("ordena por cantidad de gastos, y a igual cantidad por total", () => {
  const groups = groupUncategorized([
    pending("1", "Uno", 999, "2026-10-01T12:00:00Z"),
    pending("2", "Dos", 10, "2026-10-01T12:00:00Z"),
    pending("3", "Dos", 10, "2026-10-02T12:00:00Z"),
    pending("4", "Tres", 1, "2026-10-01T12:00:00Z"),
  ]);
  assert.deepEqual(
    groups.map((g) => g.key),
    ["DOS", "UNO", "TRES"],
  );
});

test("omite los gastos sin comercio: no hay nada que agrupar", () => {
  const groups = groupUncategorized([
    pending("1", null, 10, "2026-10-01T12:00:00Z"),
    pending("2", "   ", 10, "2026-10-01T12:00:00Z"),
    pending("3", "Rappi", 10, "2026-10-01T12:00:00Z"),
  ]);
  assert.deepEqual(
    groups.map((g) => g.key),
    ["RAPPI"],
  );
});

test("acepta el monto como string, tal como lo devuelve numeric de Postgres", () => {
  const groups = groupUncategorized([
    { id: "1", merchant: "Rappi", amount: "25.50", currency: "PEN", occurred_at: "2026-10-01T12:00:00Z" },
  ]);
  assert.deepEqual(groups[0].totals, [{ currency: "PEN", amount: 25.5 }]);
});
