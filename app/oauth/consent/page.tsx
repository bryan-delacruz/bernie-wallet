import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isDemoUser } from "@/lib/demo";
import { BernieLogo } from "@/components/brand/bernie-logo";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = {
  title: "Autorizar app",
  robots: { index: false, follow: false },
};

/**
 * Pantalla de consentimiento del OAuth 2.1 Server de Supabase (SPEC §15.5).
 * Supabase redirige aquí con `authorization_id`; la app que pide acceso nunca
 * ve esta página ni sus datos, solo el código que devuelve Supabase al final.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!authorizationId) {
    return <Notice title="Falta la solicitud" body="Abre esta pantalla desde la app que quieres conectar." />;
  }

  const user = await getCurrentUser();
  if (!user) {
    const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  if (isDemoUser(user)) {
    return (
      <Notice
        title="Necesitas una cuenta real"
        body="La demo no puede conectarse con otras apps. Entra con tu cuenta de Google para hacerlo."
      />
    );
  }

  const supabase = await createClient();
  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details) {
    return (
      <Notice
        title="La solicitud expiró"
        body="Vuelve a la app y presiona otra vez el botón para conectar con Bernie Wallet."
      />
    );
  }
  // Ya había autorizado antes: Supabase devuelve directo la URL de vuelta.
  if (!("authorization_id" in details)) redirect(details.redirect_url);

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name");

  // Si ya estaba conectada (reautorización), se marcan las que ya comparte.
  const { data: shared } = await supabase
    .from("integration_shares")
    .select("category_id")
    .eq("user_id", user.id)
    .eq("client_id", details.client.id);

  const list = categories ?? [];
  const preselected = shared?.length
    ? shared.map((s) => s.category_id)
    : list.filter((c) => looksLikeWedding(c.name)).map((c) => c.id);

  return (
    <ConsentShell>
      <ConsentForm
        authorizationId={details.authorization_id}
        clientName={details.client.name}
        clientHost={hostOf(details.redirect_uri)}
        email={user.email ?? ""}
        categories={list}
        preselected={preselected}
      />
    </ConsentShell>
  );
}

/**
 * La categoría de boda se preselecciona aunque el usuario la haya llamado
 * "matri", "Boda" o "Wedding": la primera conexión real tenía "matri" y no se
 * marcó. Es solo una sugerencia; el usuario igual elige.
 */
function looksLikeWedding(name: string) {
  const n = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
  return n === "matri" || n.startsWith("matrimon") || n.includes("boda") || n.includes("wedding") || n.includes("casamiento");
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Mismo lenguaje que el login: esmeralda + tarjeta flotante en móvil, marfil en desktop. */
function ConsentShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate flex flex-1 flex-col items-center gap-6 px-4 py-10 sm:px-6 lg:justify-center lg:bg-background">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 lg:hidden"
        style={{ background: "linear-gradient(160deg, #0d7351 0%, #0a5540 52%, #073c2d 100%)" }}
      />
      <Link href="/" className="flex w-fit items-center gap-2.5">
        <BernieLogo decorative className="size-7 text-white lg:text-primary" />
        <span className="font-heading text-lg font-medium tracking-tight text-white lg:text-foreground">
          Bernie Wallet
        </span>
      </Link>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.45)] sm:p-8 lg:border lg:border-border lg:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.25)]">
        {children}
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <ConsentShell>
      <div className="space-y-3 text-center">
        <CircleAlert className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <h1 className="font-heading text-2xl font-medium tracking-tight text-balance">{title}</h1>
        <p className="text-sm text-pretty text-muted-foreground">{body}</p>
      </div>
    </ConsentShell>
  );
}
