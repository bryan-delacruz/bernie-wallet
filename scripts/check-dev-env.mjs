// Avisa, al arrancar en desarrollo, si la app apunta a la base de producción.
// Mientras no estén separadas (SPEC §11.1), un `delete` mal escrito en desarrollo
// toca datos reales de usuarios. El aviso no bloquea: avisa.
import { readFileSync } from "node:fs";

const PRODUCTION_REF = "voexbnscadfcvholytyd";

try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1] ?? "";

  if (url.includes(PRODUCTION_REF)) {
    const line = "─".repeat(66);
    console.warn(
      `\n\x1b[33m${line}\n` +
        "  ATENCIÓN: estás en desarrollo contra la base de PRODUCCIÓN.\n" +
        "  Lo que borres o modifiques acá les pasa a usuarios reales.\n" +
        `${line}\x1b[0m\n`,
    );
  }
} catch {
  // Sin .env.local no hay nada que avisar.
}
