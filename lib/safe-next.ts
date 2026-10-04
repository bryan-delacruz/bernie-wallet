/**
 * Destino tras el login (`?next=`), solo si es una ruta interna (SPEC §15.5).
 * Un `next` externo convertiría el login en un open redirect: alguien manda un
 * link de Bernie que, tras entrar con Google, termina en su sitio.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Debe empezar con una sola "/". "//evil.com" y "/\evil.com" los navegadores
  // los tratan como URL de otro host.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  // Sin caracteres de control (un tab o salto de línea dentro de "//" también engaña).
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, "https://bernie.invalid");
    if (url.origin !== "https://bernie.invalid") return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/** Cookie que lleva el `next` a través del viaje a Google y de vuelta al callback. */
export const NEXT_COOKIE = "bw_next";

/** Lee la cookie de `next`; un valor mal codificado se descarta en vez de lanzar. */
export function nextFromCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return safeNext(decodeURIComponent(raw));
  } catch {
    return null;
  }
}
