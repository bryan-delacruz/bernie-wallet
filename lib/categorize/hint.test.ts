import { strict as assert } from "node:assert";
import { test } from "node:test";
import { categorizeHint, type HintState } from "./hint.ts";

const NOW = new Date("2026-10-08T12:00:00Z");

function state(over: Partial<HintState> = {}): HintState {
  return {
    pendingExpenses: 50,
    enabled: true,
    dismissedAt: null,
    pendingAtDismiss: null,
    ...over,
  };
}

test("con backlog y sin descarte, el aviso se muestra", () => {
  assert.deepEqual(categorizeHint(state(), NOW), {
    show: true,
    pendingExpenses: 50,
    since: 0,
  });
});

test("por debajo del umbral no se avisa: se editan uno a uno", () => {
  assert.deepEqual(categorizeHint(state({ pendingExpenses: 2 }), NOW), { show: false });
});

test("apagado desde Configuración no se muestra, aunque haya backlog", () => {
  assert.deepEqual(categorizeHint(state({ enabled: false }), NOW), { show: false });
});

test("recién descartado se queda callado", () => {
  const hint = categorizeHint(
    state({ dismissedAt: "2026-10-07T12:00:00Z", pendingAtDismiss: 50 }),
    NOW,
  );
  assert.deepEqual(hint, { show: false });
});

test("vuelve cuando se juntaron bastantes pendientes nuevos", () => {
  const hint = categorizeHint(
    state({ pendingExpenses: 70, dismissedAt: "2026-10-07T12:00:00Z", pendingAtDismiss: 50 }),
    NOW,
  );
  assert.deepEqual(hint, { show: true, pendingExpenses: 70, since: 20 });
});

test("19 nuevos todavía no alcanzan", () => {
  const hint = categorizeHint(
    state({ pendingExpenses: 69, dismissedAt: "2026-10-07T12:00:00Z", pendingAtDismiss: 50 }),
    NOW,
  );
  assert.deepEqual(hint, { show: false });
});

test("un backlog que bajó no es novedad: el usuario está ordenando", () => {
  const hint = categorizeHint(
    state({ pendingExpenses: 10, dismissedAt: "2026-10-07T12:00:00Z", pendingAtDismiss: 50 }),
    NOW,
  );
  assert.deepEqual(hint, { show: false });
});

test("a los 90 días vuelve aunque el backlog no haya crecido", () => {
  const hint = categorizeHint(
    state({ dismissedAt: "2026-07-01T12:00:00Z", pendingAtDismiss: 50 }),
    NOW,
  );
  assert.deepEqual(hint, { show: true, pendingExpenses: 50, since: 0 });
});

test("el tope de días no revive un aviso apagado desde Configuración", () => {
  const hint = categorizeHint(
    state({ enabled: false, dismissedAt: "2026-07-01T12:00:00Z", pendingAtDismiss: 50 }),
    NOW,
  );
  assert.deepEqual(hint, { show: false });
});
