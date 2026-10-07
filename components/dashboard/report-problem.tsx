import { LifeBuoy } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/contact";

const SUBJECT = encodeURIComponent("Problema en Bernie Wallet");
const BODY = encodeURIComponent(
  "Cuéntanos qué pasó:\n\n\n" +
    "¿En qué pantalla?\n\n\n" +
    "Por favor no copies el contenido de tus correos del banco.\n",
);

/**
 * Canal para reportar problemas. Es un `mailto` a propósito: un formulario propio
 * guardaría texto libre —donde la gente pega lo que sea, incluido el correo del
 * banco— y un servicio de terceros sería un encargado de tratamiento más que
 * declarar (SPEC §14.4). El correo ya existe y es el declarado ante Google.
 */
export function ReportProblem() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}?subject=${SUBJECT}&body=${BODY}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
    >
      <LifeBuoy className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span>
        <span className="block text-sm font-medium">Reportar un problema</span>
        <span className="block text-[11px] text-muted-foreground">
          Si algo no cuadra —un gasto que no aparece, un monto raro— escríbenos y lo
          revisamos.
        </span>
      </span>
    </a>
  );
}
