import { test } from "node:test";
import assert from "node:assert/strict";
import { challengeProgress } from "./challenges.ts";

const bet = { startedOn: "2026-10-01", targetDays: 30 };

test("sin tropiezos cuenta desde el inicio, incluyendo hoy", () => {
  const p = challengeProgress(bet, [], "2026-10-10");
  assert.equal(p.current, 10);
  assert.equal(p.best, 10);
  assert.equal(p.restarts, 0);
  assert.equal(p.done, false);
});

test("el primer día cuenta como 1", () => {
  assert.equal(challengeProgress(bet, [], "2026-10-01").current, 1);
});

test("un gasto reinicia el contador al día siguiente, sin cerrar el reto", () => {
  const p = challengeProgress(bet, ["2026-10-05"], "2026-10-10");
  assert.equal(p.current, 5, "del 06 al 10");
  assert.equal(p.restarts, 1);
  assert.equal(p.done, false);
});

test("el mejor intento recuerda el tramo más largo aunque el actual sea corto", () => {
  const p = challengeProgress(bet, ["2026-10-20", "2026-10-21"], "2026-10-22");
  assert.equal(p.current, 1);
  assert.equal(p.best, 19, "del 01 al 19");
});

test("gastar hoy deja el contador en cero", () => {
  const p = challengeProgress(bet, ["2026-10-10"], "2026-10-10");
  assert.equal(p.current, 0);
});

test("la meta se cumple al llegar a los días pedidos", () => {
  const p = challengeProgress({ startedOn: "2026-10-01", targetDays: 7 }, [], "2026-10-07");
  assert.equal(p.done, true);
  assert.equal(p.current, 7);
});

test("los gastos previos al reto no cuentan", () => {
  const p = challengeProgress(bet, ["2026-09-28"], "2026-10-10");
  assert.equal(p.current, 10);
  assert.equal(p.restarts, 0);
});

test("dos gastos el mismo día son un solo tropiezo", () => {
  const p = challengeProgress(bet, ["2026-10-05", "2026-10-05"], "2026-10-10");
  assert.equal(p.restarts, 1);
});
