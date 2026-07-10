import { CtaButton } from "@/components/home/cta-button";

/** CTA de cierre, en banda blanca. */
export function FinalCta() {
  return (
    <section className="border-t border-[#e8e4da] bg-white">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-28 text-center">
        <h2 className="font-heading text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Deja de anotar gastos a mano.
        </h2>
        <p className="max-w-md text-lg text-pretty text-[#6b675b]">
          Conecta tu Gmail y deja que Bernie lleve la cuenta.
        </p>
        <CtaButton className="mt-2" />
      </div>
    </section>
  );
}
