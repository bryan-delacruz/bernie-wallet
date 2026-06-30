import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión y manda al login. Usado cuando el usuario autenticado no
 *  tiene perfil (estado inválido): se fuerza un nuevo login. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
