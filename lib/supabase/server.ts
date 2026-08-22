import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * `cookies()` es async en Next 16, por eso este helper también lo es.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: ignorar. El refresco de cookies
            // lo hace el proxy, así que aquí es seguro no escribir.
          }
        },
      },
    },
  );
}

/**
 * Usuario actual, **deduplicado por request** con React.cache: el layout y la
 * página comparten una sola validación de token (una llamada de red a Supabase)
 * en vez de una por cada `getUser()`. Reduce latencia en cada navegación.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
