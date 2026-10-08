import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  autoSubcategory,
  groupUncategorized,
  normMerchant,
  suggestFor,
  tallyMerchantMemory,
  type MerchantRules,
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

test("la memoria elige la subcategoría más frecuente y reporta el acuerdo", () => {
  const memory = tallyMerchantMemory([
    { merchant: "Plaza Vea", subcategory_id: "mercado" },
    { merchant: "PLAZA VEA", subcategory_id: "mercado" },
    { merchant: "plaza vea", subcategory_id: "antojos" },
  ]);
  const entry = memory.get("PLAZA VEA");
  assert.equal(entry?.subcategoryId, "mercado");
  assert.equal(entry?.total, 3);
  assert.equal(entry?.agreement, 2 / 3);
  assert.deepEqual(entry?.ranked, ["mercado", "antojos"]);
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
  assert.equal(memory.get("RAPPI")?.subcategoryId, "reciente");
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
  assert.deepEqual(groups[0].expenses.map((e) => e.id).sort(), ["1", "2", "3"]);
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

const NO_RULES: MerchantRules = new Map();

test("un historial unánime se sugiere y el sync lo aplica solo", () => {
  const memory = tallyMerchantMemory([
    { merchant: "Rappi", subcategory_id: "delivery" },
    { merchant: "Rappi", subcategory_id: "delivery" },
  ]);
  assert.deepEqual(suggestFor("RAPPI", memory, NO_RULES), {
    kind: "memory",
    subcategoryId: "delivery",
    agreement: 1,
  });
  assert.equal(autoSubcategory("RAPPI", memory, NO_RULES), "delivery");
});

test("un solo antecedente no alcanza para decidir todo lo que venga", () => {
  const memory = tallyMerchantMemory([{ merchant: "Juan P.", subcategory_id: "cena" }]);
  assert.deepEqual(suggestFor("JUAN P.", memory, NO_RULES), {
    kind: "varies",
    options: ["cena"],
  });
  assert.equal(autoSubcategory("JUAN P.", memory, NO_RULES), null);
});

test("un historial que se contradice no sugiere nada", () => {
  // Yapes a la misma persona: renta, préstamo y cena. La moda es un empate con suerte.
  const memory = tallyMerchantMemory([
    { merchant: "Juan P.", subcategory_id: "alquiler" },
    { merchant: "Juan P.", subcategory_id: "alquiler" },
    { merchant: "Juan P.", subcategory_id: "prestamos" },
    { merchant: "Juan P.", subcategory_id: "cena" },
  ]);
  const suggestion = suggestFor("JUAN P.", memory, NO_RULES);
  assert.equal(suggestion.kind, "varies");
  assert.equal(autoSubcategory("JUAN P.", memory, NO_RULES), null);
});

test("un comercio sin historial no dice nada", () => {
  assert.deepEqual(suggestFor("NUEVO", new Map(), NO_RULES), { kind: "none" });
});

test("la regla del usuario le gana a un historial unánime", () => {
  const memory = tallyMerchantMemory([
    { merchant: "Juan P.", subcategory_id: "alquiler" },
    { merchant: "Juan P.", subcategory_id: "alquiler" },
    { merchant: "Juan P.", subcategory_id: "alquiler" },
  ]);
  const rules: MerchantRules = new Map([["JUAN P.", null]]);
  assert.deepEqual(suggestFor("JUAN P.", memory, rules), { kind: "muted" });
  assert.equal(autoSubcategory("JUAN P.", memory, rules), null);
});

test("una regla con subcategoría fija manda sobre la memoria", () => {
  const memory = tallyMerchantMemory([
    { merchant: "Rappi", subcategory_id: "delivery" },
    { merchant: "Rappi", subcategory_id: "delivery" },
  ]);
  const rules: MerchantRules = new Map([["RAPPI", "antojos"]]);
  assert.deepEqual(suggestFor("RAPPI", memory, rules), {
    kind: "pinned",
    subcategoryId: "antojos",
  });
  assert.equal(autoSubcategory("RAPPI", memory, rules), "antojos");
});

test("los gastos del grupo quedan del más reciente al más viejo", () => {
  const groups = groupUncategorized([
    pending("viejo", "Rappi", 10, "2026-10-01T12:00:00Z"),
    pending("nuevo", "Rappi", 10, "2026-10-09T12:00:00Z"),
    pending("medio", "Rappi", 10, "2026-10-05T12:00:00Z"),
  ]);
  assert.deepEqual(
    groups[0].expenses.map((e) => e.id),
    ["nuevo", "medio", "viejo"],
  );
});
