import { Lock, RotateCcw, ShieldCheck } from "lucide-react";

const GUARANTEES = [
  { icon: ShieldCheck, title: "Solo lectura", body: "Bernie nunca envía ni borra correos." },
  { icon: Lock, title: "Cifrado", body: "Tu conexión con Gmail se guarda cifrada (AES-256)." },
  { icon: RotateCcw, title: "Reversible", body: "Desconéctalo cuando quieras, en un clic." },
];

/** Confianza: contención total. */
export function Trust() {
  return (
    <section className="border-t border-[#e8e4da]">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="font-mono text-xs font-medium tracking-[0.16em] text-[#0e7c58] uppercase">
          Privacidad
        </p>
        <h2 className="mt-3 font-heading text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Tu Gmail, en tus términos.
        </h2>

        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="flex flex-col items-center gap-3">
              <g.icon className="size-6 text-[#0e7c58]" />
              <div className="space-y-1">
                <h3 className="font-medium tracking-tight">{g.title}</h3>
                <p className="mx-auto max-w-[14rem] text-sm leading-relaxed text-pretty text-[#6b675b]">
                  {g.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
