import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/home/site-header";
import { SiteFooter } from "@/components/home/site-footer";

/** Shell de las páginas legales: misma atmósfera marfil de la landing, columna
 *  legible y estilos de prosa aplicados por variantes para que las páginas
 *  escriban HTML semántico plano. */
export function LegalShell({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#f6f4ef] text-[#17160f]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#6b675b] transition-colors hover:text-[#0e7c58]"
        >
          <ArrowLeft className="size-4" />
          Volver al inicio
        </Link>

        <header className="mt-8 border-b border-[#e8e4da] pb-8">
          <p className="font-mono text-xs font-medium tracking-[0.16em] text-[#0e7c58] uppercase">
            Legal
          </p>
          <h1 className="mt-3 font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 leading-relaxed text-pretty text-[#3b3a32]">{intro}</p>
          <p className="mt-4 text-xs text-[#6b675b]">Última actualización: {updatedAt}</p>
        </header>

        <div
          className="mt-12 space-y-10 text-[15px] leading-relaxed text-[#3b3a32] [&_a]:text-[#0e7c58] [&_a]:underline [&_a]:decoration-[#0e7c58]/30 [&_a]:underline-offset-2 [&_a:hover]:decoration-[#0e7c58] [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-[#17160f] [&_li]:pl-1 [&_p]:text-pretty [&_section>*+*]:mt-3 [&_strong]:font-medium [&_strong]:text-[#17160f] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
        >
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
