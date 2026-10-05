import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  computeStreak,
  noSpendStreak,
  reachedMilestone,
  weekdayIndex,
  type StreakExpense,
} from "./streak.ts";

/** Gasto del día `day`, importado el mismo día salvo que se diga otra cosa. */
function expense(day: string, categorized: boolean, importedDay = day): StreakExpense {
  return { day, importedDay, categorized };
}

test("sin gastos no hay racha", () => {
  const streak = computeStreak([], "2026-10-04");
  assert.equal(streak.current, 0);
  assert.deepEqual(streak.days, []);
});

test("días sin gastos cuentan: el usuario está al día igual", () => {
  const streak = computeStreak([expense("2026-10-01", true)], "2026-10-04");
  assert.equal(streak.current, 4);
  assert.deepEqual(
    streak.days.map((d) => d.state),
    ["clean", "quiet", "quiet", "quiet"],
  );
});

test("un día con gasto sin categorizar rompe la racha", () => {
  const streak = computeStreak(
    [expense("2026-10-01", true), expense("2026-10-02", false), expense("2026-10-03", true)],
    "2026-10-04",
  );
  assert.equal(streak.current, 2);
  assert.equal(streak.longest, 2);
  assert.equal(streak.days[1].state, "missed");
});

test("hoy sin categorizar no rompe: queda en riesgo", () => {
  const streak = computeStreak(
    [expense("2026-10-03", true), expense("2026-10-04", false)],
    "2026-10-04",
  );
  assert.equal(streak.atRisk, true);
  assert.equal(streak.current, 1);
  assert.equal(streak.days.at(-1)!.state, "pending");
});

test("un gasto importado tarde no ensucia su día hacia atrás", () => {
  const late = expense("2026-10-01", false, "2026-10-04");
  const streak = computeStreak([late, expense("2026-10-02", true)], "2026-10-04");
  assert.equal(streak.current, 4);
  assert.equal(streak.backlog, 1, "sigue pendiente, pero fuera de la racha");
});

test("un gasto importado al día siguiente todavía cuenta para su día", () => {
  const streak = computeStreak([expense("2026-10-01", false, "2026-10-02")], "2026-10-04");
  assert.equal(streak.days[0].state, "missed");
});

test("a los 7 días se gana una congelada y cubre el primer hueco", () => {
  const expenses = [
    expense("2026-09-01", true),
    expense("2026-09-09", false), // día 9: ya hay congelada
  ];
  const streak = computeStreak(expenses, "2026-09-10");
  assert.equal(streak.days[8].state, "frozen");
  assert.equal(streak.current, 10, "la congelada mantiene la racha viva");
  assert.equal(streak.freezes, 0, "y se consumió");
});

test("sin congelada disponible el hueco rompe", () => {
  const streak = computeStreak(
    [expense("2026-09-01", true), expense("2026-09-03", false)],
    "2026-09-10",
  );
  assert.equal(streak.days[2].state, "missed");
  assert.equal(streak.current, 7);
});

test("las congeladas se topan en 2", () => {
  const streak = computeStreak([expense("2026-09-01", true)], "2026-12-31");
  assert.equal(streak.freezes, 2);
});

test("la grilla no pasa de 364 días", () => {
  const streak = computeStreak([expense("2024-01-01", true)], "2026-10-04");
  assert.equal(streak.days.length, 364);
  assert.equal(streak.days.at(-1)!.day, "2026-10-04");
});

test("días seguidos sin gastar cuenta hasta ayer", () => {
  const streak = noSpendStreak([expense("2026-09-30", true)], "2026-10-04");
  assert.equal(streak, 3, "01, 02 y 03; hoy todavía puede llegar un gasto");
});

test("hitos solo en los números exactos", () => {
  assert.equal(reachedMilestone(7), 7);
  assert.equal(reachedMilestone(8), null);
  assert.equal(reachedMilestone(365), 365);
});

test("la semana empieza el lunes por defecto", () => {
  assert.equal(weekdayIndex("2026-10-05"), 0, "lunes es la primera fila");
  assert.equal(weekdayIndex("2026-10-11"), 6, "domingo es la última");
});

test("con la semana en domingo las filas rotan", () => {
  assert.equal(weekdayIndex("2026-10-11", "sunday"), 0);
  assert.equal(weekdayIndex("2026-10-05", "sunday"), 1);
});
