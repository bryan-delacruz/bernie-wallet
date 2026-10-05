import { test } from "node:test";
import assert from "node:assert/strict";
import { PHRASES, moodFor, pickPhrase, type PhraseContext } from "./bernie-phrases.ts";

const base: PhraseContext = {
  weekday: 3,
  streakDays: 0,
  milestone: false,
  quietYesterday: false,
  pendingExpenses: 0,
};

test("ninguna frase menciona dinero", () => {
  for (const p of PHRASES) {
    assert.doesNotMatch(p.text, /S\/|USD|\$|sol(es)?\b/i, `"${p.text}" habla de plata`);
  }
});

test("ninguna frase lleva signos de exclamación", () => {
  for (const p of PHRASES) assert.doesNotMatch(p.text, /[¡!]/, `"${p.text}" grita`);
});

test('"guau" aparece solo al celebrar', () => {
  for (const p of PHRASES) {
    if (/guau/i.test(p.text)) assert.equal(p.mood, "milestone", `"${p.text}" no es celebración`);
  }
});

test("cada momento tiene al menos una frase", () => {
  const moods = new Set(PHRASES.map((p) => p.mood));
  for (const mood of ["daily", "monday", "friday", "weekend", "streak", "milestone", "quiet", "pending"]) {
    assert.ok(moods.has(mood as never), `falta ${mood}`);
  }
});

test("celebrar gana sobre informar", () => {
  const mood = moodFor({ ...base, milestone: true, streakDays: 30, pendingExpenses: 9 });
  assert.equal(mood, "milestone");
});

test("lo informativo solo aparece si no hay nada lindo que decir", () => {
  assert.equal(moodFor({ ...base, pendingExpenses: 9 }), "pending");
  assert.equal(moodFor({ ...base, pendingExpenses: 9, streakDays: 5 }), "streak");
});

test("el lunes y el viernes tienen su propia voz", () => {
  assert.equal(moodFor({ ...base, weekday: 1 }), "monday");
  assert.equal(moodFor({ ...base, weekday: 5 }), "friday");
  assert.equal(moodFor({ ...base, weekday: 0 }), "weekend");
});

test("los días de la racha se reemplazan en el texto", () => {
  const phrase = pickPhrase({ ...base, streakDays: 14 }, { seed: 0 });
  assert.match(phrase.text, /14/);
  assert.doesNotMatch(phrase.text, /\{days\}/);
});

test("no repite la frase del día anterior", () => {
  const context = { ...base, streakDays: 7 };
  const first = pickPhrase(context, { seed: 0 });
  for (let seed = 0; seed < 10; seed++) {
    assert.notEqual(pickPhrase(context, { seed, lastId: first.id }).id, first.id);
  }
});

test("la misma semilla devuelve la misma frase: un reintento no cambia el mensaje", () => {
  const context = { ...base, streakDays: 7 };
  assert.equal(pickPhrase(context, { seed: 42 }).id, pickPhrase(context, { seed: 42 }).id);
});
