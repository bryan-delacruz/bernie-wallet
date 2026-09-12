import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

const UPDATED_AT = "12 de septiembre de 2026";
const CONTACT_EMAIL = "soporte-bernie-wallet@googlegroups.com";

export const metadata: Metadata = {
  title: "Condiciones del Servicio",
  description: "Condiciones de uso de Bernie Wallet: uso personal, sin garantías, reversible.",
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Condiciones del Servicio"
      updatedAt={UPDATED_AT}
      intro="Bernie Wallet es una herramienta personal de registro de gastos. Estas condiciones son cortas a propósito: explican qué puedes esperar de la aplicación y qué no."
    >
      <section>
        <h2>Aceptación</h2>
        <p>
          Al usar Bernie Wallet aceptas estas condiciones y la{" "}
          <a href="/privacy">Política de Privacidad</a>. Si no estás de acuerdo con ellas, no uses
          la aplicación.
        </p>
      </section>

      <section>
        <h2>Qué es y qué no es el servicio</h2>
        <ul>
          <li>
            Bernie Wallet lee los correos de notificación de tu banco para <strong>anotar</strong>{" "}
            tus gastos y mostrártelos ordenados.
          </li>
          <li>
            <strong>No</strong> es un producto bancario, ni un asesor financiero, ni está afiliada a
            ninguna entidad financiera. No mueve dinero ni ejecuta operaciones.
          </li>
          <li>
            <strong>No</strong> sustituye a tus estados de cuenta: la fuente oficial de tus
            movimientos es siempre tu banco.
          </li>
        </ul>
      </section>

      <section>
        <h2>Tu cuenta</h2>
        <ul>
          <li>Necesitas una cuenta de Google para entrar, y eres responsable de su seguridad.</li>
          <li>
            El servicio es para <strong>uso personal</strong>. No lo uses para leer los correos de
            otra persona sin su consentimiento.
          </li>
          <li>
            Los gastos que registras manualmente y las correcciones que haces son tu
            responsabilidad.
          </li>
        </ul>
      </section>

      <section>
        <h2>Exactitud de los datos</h2>
        <p>
          Los gastos se extraen de los correos del banco mediante reglas de texto. Si el banco
          cambia el formato de sus notificaciones, o si un correo llega incompleto, un gasto puede
          quedar sin registrar o registrarse con datos imprecisos. Revisa tus registros y corrígelos
          cuando haga falta: la aplicación siempre permite el registro y la edición manual.
        </p>
      </section>

      <section>
        <h2>Disponibilidad y sin garantías</h2>
        <p>
          El servicio se ofrece <strong>«tal cual»</strong>, sin garantías de disponibilidad,
          exactitud ni continuidad, y puede cambiar o interrumpirse en cualquier momento. En la
          medida que la ley lo permita, no asumimos responsabilidad por decisiones tomadas a partir
          de la información que muestra la aplicación, ni por pérdidas derivadas de su uso o de su
          indisponibilidad.
        </p>
      </section>

      <section>
        <h2>Cancelación</h2>
        <p>
          Puedes dejar de usar el servicio cuando quieras: revoca el acceso a Gmail desde{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer noopener">
            myaccount.google.com/permissions
          </a>{" "}
          y, si quieres borrar tu cuenta y tus datos, escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2>Cambios</h2>
        <p>
          Si actualizamos estas condiciones, cambiaremos la fecha del encabezado. El uso continuado
          de la aplicación implica la aceptación de la versión vigente.
        </p>
      </section>

      <section>
        <h2>Ley aplicable</h2>
        <p>Estas condiciones se rigen por las leyes de la República del Perú.</p>
      </section>
    </LegalShell>
  );
}
