/**
 * Cursor opaco de la sync incremental (SPEC §15.6). El cliente lo guarda y lo
 * devuelve tal cual; su forma interna puede cambiar sin romper el contrato.
 */
export type SyncCursor = {
  /** changed_at del último cambio entregado (ISO). */
  ts: string;
  /** id del último cambio entregado: desempata cambios con el mismo ts. */
  id: string;
  /** shares_version con la que se emitió: si cambia, el cursor no sirve. */
  sv: number;
  /**
   * true = última página de una sync. La siguiente sync relee una ventana hacia
   * atrás para no perder escrituras que confirmaron tarde. Las páginas
   * intermedias no la releen: si no, más cambios que `limit` dentro de la
   * ventana harían un bucle infinito.
   */
  final: boolean;
};

const VERSION = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const OVERLAP_MS = 2 * 60 * 1000;

export function encodeCursor(cursor: SyncCursor): string {
  return Buffer.from(JSON.stringify({ v: VERSION, ...cursor })).toString("base64url");
}

/** null si el cursor no es válido: el cliente recibe 400, no un 500. */
export function decodeCursor(raw: string): SyncCursor | null {
  try {
    const data = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      data?.v !== VERSION ||
      typeof data.ts !== "string" ||
      Number.isNaN(Date.parse(data.ts)) ||
      typeof data.id !== "string" ||
      !UUID.test(data.id) ||
      !Number.isInteger(data.sv) ||
      typeof data.final !== "boolean"
    ) {
      return null;
    }
    return { ts: data.ts, id: data.id, sv: data.sv, final: data.final };
  } catch {
    return null;
  }
}

/** Desde dónde leer: el cursor exacto, o una ventana antes si cerró una sync. */
export function readFrom(cursor: SyncCursor): { ts: string; id: string } {
  if (!cursor.final) return { ts: cursor.ts, id: cursor.id };
  return {
    ts: new Date(Date.parse(cursor.ts) - OVERLAP_MS).toISOString(),
    id: "00000000-0000-0000-0000-000000000000",
  };
}
