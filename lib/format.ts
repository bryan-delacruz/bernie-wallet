/** Formatea un monto como moneda (es-PE). */
export function formatCurrency(amount: number, currency = "PEN"): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(amount);
}

const LIMA_TZ = "America/Lima";
// Perú es UTC-5 todo el año (sin horario de verano).
const LIMA_OFFSET_HOURS = 5;

/** Fecha corta "02 jun" en horario de Lima. */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TZ,
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

/** ISO → "YYYY-MM-DD" en horario de Lima (para inputs type="date"). */
export function toLimaDateInput(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Etiqueta de mes "Junio 2026" (capitalizada), en horario de Lima. */
export function formatMonthLabel(date: Date): string {
  const label = new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TZ,
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Rango del mes actual en horario de Lima: [inicio de mes, inicio del mes
 * siguiente) como instantes UTC, para filtrar `occurred_at` con precisión.
 */
export function limaMonthRange(now: Date): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value); // 1-12

  // 00:00 Lima del día 1 = 05:00 UTC del día 1.
  const start = new Date(Date.UTC(year, month - 1, 1, LIMA_OFFSET_HOURS, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, LIMA_OFFSET_HOURS, 0, 0));

  return { startIso: start.toISOString(), endIso: end.toISOString(), label: formatMonthLabel(start) };
}
