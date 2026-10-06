import "server-only";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/crypto";

/**
 * Borrado de cuenta (derecho de supresión, Ley 29733). Tres pasos, en este orden:
 *
 * 1. Revocar el refresh token en Google, para que Bernie deje de tener acceso al
 *    Gmail del usuario aunque algo falle después.
 * 2. Borrar la fila de `users`, que arrastra en cascada todo lo demás: gastos,
 *    categorías, medios de pago, tokens, retos, descubrimientos y fallos de sync.
 * 3. Borrar el usuario de `auth.users`, que necesita la secret key.
 *
 * Si el paso 3 falla, el usuario queda sin datos pero con cuenta: molesto, no
 * peligroso. Al revés —cuenta borrada con datos vivos— sería lo grave, y por eso
 * el orden es ese.
 */

function serviceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Le dice a Google que olvide el permiso. Si falla, se sigue: el token se borra
 *  igual de la base en el paso siguiente. */
export async function revokeGoogleAccess(encryptedRefreshToken: string | null): Promise<void> {
  if (!encryptedRefreshToken) return;
  try {
    const token = decrypt(encryptedRefreshToken);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Un token ya revocado o ilegible no debe bloquear el borrado de la cuenta.
  }
}

/** Borra el usuario de `auth.users`. Devuelve false si no hay secret key. */
export async function deleteAuthUser(userId: string): Promise<boolean> {
  const admin = serviceClient();
  if (!admin) return false;
  const { error } = await admin.auth.admin.deleteUser(userId);
  return !error;
}
