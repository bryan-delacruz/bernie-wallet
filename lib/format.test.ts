import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatShortTime, limaInstant, toLimaTimeInput } from "./format.ts";

/** Corre `fn` como si el servidor estuviera en esa zona. */
function withTimeZone(tz: string, fn: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    process.env.TZ = previous;
  }
}

test("la hora que elige el usuario es la de Lima, corra donde corra el servidor", () => {
  // Esta es la prueba que importa: `new Date("...T16:45:00")` sin zona parsea en
  // la del runtime, y Vercel corre en UTC mientras la laptop está en Lima. Sin
  // el offset escrito, el mismo gasto quedaba cinco horas corrido en producción.
  for (const tz of ["UTC", "America/Lima", "Europe/Madrid", "Asia/Tokyo"]) {
    withTimeZone(tz, () => {
      assert.equal(
        limaInstant("2026-10-11", "16:45"),
        "2026-10-11T21:45:00.000Z",
        `falló con TZ=${tz}`,
      );
    });
  }
});

test("medianoche de Lima no se corre de día", () => {
  assert.equal(limaInstant("2026-10-11", "00:00"), "2026-10-11T05:00:00.000Z");
});

test("un minuto antes de medianoche sigue siendo el mismo día en Lima", () => {
  const iso = limaInstant("2026-10-11", "23:59");
  assert.equal(iso, "2026-10-12T04:59:00.000Z");
  // Ya es día 12 en UTC, pero el usuario tiene que seguir viendo el 11.
  assert.equal(formatShortTime(iso), "23:59");
});

test("guardar y volver a leer la hora da lo mismo que se eligió", () => {
  for (const time of ["00:00", "08:05", "13:30", "23:59"]) {
    assert.equal(toLimaTimeInput(limaInstant("2026-10-11", time)), time, time);
  }
});

test("la hora se muestra en 24 h, sin a. m. ni p. m.", () => {
  assert.equal(formatShortTime("2026-10-11T21:45:00.000Z"), "16:45");
  assert.match(formatShortTime("2026-10-11T05:00:00.000Z"), /^\d{2}:\d{2}$/);
});
