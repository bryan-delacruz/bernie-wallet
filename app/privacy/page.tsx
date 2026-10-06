import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/legal-shell";

const UPDATED_AT = "4 de octubre de 2026";
// Contacto público que exige Google para la política. Es un Grupo de Google
// (buzón compartido) para no exponer el correo personal del autor; debe coincidir
// con el correo de asistencia declarado en la pantalla de consentimiento.
const CONTACT_EMAIL = "soporte-bernie-wallet@googlegroups.com";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Qué datos lee Bernie Wallet de tu Gmail, qué guarda, dónde los guarda y cómo revocar el acceso.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Política de Privacidad"
      updatedAt={UPDATED_AT}
      intro="Bernie Wallet lee los correos de notificación que te envía tu banco para anotar tus gastos automáticamente. Esta página explica exactamente qué datos tocamos, qué guardamos y cómo puedes cortarnos el acceso en cualquier momento."
    >
      <section>
        <h2>Quiénes somos</h2>
        <p>
          Bernie Wallet es una aplicación web personal de registro de gastos, operada desde Perú
          por su autor. No es un producto bancario ni está afiliada a ninguna entidad financiera.
          Para cualquier consulta sobre esta política puedes escribir a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2>Qué datos leemos de tu Gmail</h2>
        <p>
          Al conectar tu cuenta de Google, Bernie Wallet solicita el permiso{" "}
          <strong>gmail.readonly</strong>, que es de <strong>solo lectura</strong>. Con ese permiso:
        </p>
        <ul>
          <li>
            Buscamos <strong>únicamente</strong> los correos de notificación enviados por los
            remitentes del banco que elegiste (hoy, el BCP). No recorremos el resto de tu bandeja.
          </li>
          <li>
            <strong>Nunca</strong> enviamos, respondemos, modificamos, archivamos ni borramos
            correos. Técnicamente no podemos: el permiso no lo permite.
          </li>
          <li>
            Leemos el contenido de esos correos solo para extraer los datos del gasto, en el
            momento de la sincronización, y no conservamos el correo completo.
          </li>
        </ul>
      </section>

      <section>
        <h2>Qué guardamos</h2>
        <p>De cada notificación bancaria extraemos y almacenamos:</p>
        <ul>
          <li>monto y moneda del gasto;</li>
          <li>comercio o beneficiario;</li>
          <li>fecha y hora de la operación;</li>
          <li>números de operación y de documento, cuando el correo los incluye;</li>
          <li>
            los <strong>últimos dígitos</strong> de la tarjeta o el medio de pago (por ejemplo
            «****2813»), para que puedas distinguir tus medios de pago;
          </li>
          <li>
            el identificador del correo procesado, que usamos para no registrar el mismo gasto dos
            veces.
          </li>
        </ul>
        <p>
          También guardamos tu correo electrónico de Google, que es lo que identifica tu cuenta en
          la aplicación.
        </p>
      </section>

      <section>
        <h2>Qué no guardamos</h2>
        <ul>
          <li>
            <strong>Ninguna credencial bancaria</strong>: no pedimos ni almacenamos usuarios,
            contraseñas, claves ni tokens de tu banco. Bernie Wallet no se conecta a tu banco, solo
            lee los correos que el banco ya te envió.
          </li>
          <li>El número completo de tus tarjetas.</li>
          <li>La contraseña de tu cuenta de Google.</li>
          <li>El contenido íntegro de tus correos, ni correos ajenos al banco que elegiste.</li>
        </ul>
      </section>

      <section>
        <h2>Dónde viven tus datos y cómo los protegemos</h2>
        <ul>
          <li>
            Tus gastos se guardan en una base de datos gestionada por{" "}
            <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer noopener">
              Supabase
            </a>
            , con <strong>seguridad a nivel de fila</strong>: cada consulta está restringida a tu
            propio identificador de usuario, de modo que nadie más puede leer tus registros.
          </li>
          <li>
            La aplicación se ejecuta en{" "}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer noopener">
              Vercel
            </a>{" "}
            y toda la comunicación ocurre sobre HTTPS.
          </li>
          <li>
            El permiso de Google que nos autoriza a leer tus correos se almacena{" "}
            <strong>cifrado con AES-256-GCM</strong>, y solo se descifra en el servidor durante una
            sincronización.
          </li>
        </ul>
      </section>

      <section>
        <h2>Uso limitado de los datos de Google</h2>
        <p>
          El uso que Bernie Wallet hace de la información recibida de las APIs de Google se ajusta a
          la{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer noopener"
          >
            Política de Datos de Usuario de los Servicios de las APIs de Google
          </a>
          , incluidos sus requisitos de <strong>Uso Limitado</strong>. En concreto:
        </p>
        <ul>
          <li>
            usamos los datos de tu Gmail <strong>solo</strong> para mostrarte y registrar tus
            gastos dentro de la aplicación;
          </li>
          <li>
            <strong>no</strong> los transferimos a terceros, salvo a los proveedores de
            infraestructura mencionados arriba, cuando sea necesario para operar el servicio o
            cuando la ley lo exija, y a las <strong>apps que tú conectes</strong> (ver abajo);
          </li>
          <li>
            <strong>no</strong> los usamos para publicidad, ni para crear perfiles publicitarios, ni
            los vendemos;
          </li>
          <li>
            <strong>no</strong> los usamos para entrenar modelos de inteligencia artificial. La
            extracción de datos de los correos es un proceso programático, sin IA;
          </li>
          <li>ninguna persona lee tus correos, salvo que tú lo pidas para resolver un problema.</li>
        </ul>
      </section>

      <section>
        <h2>Apps conectadas</h2>
        <p>
          Puedes conectar Bernie Wallet con otras apps (por ejemplo, Casorio Club) para que vean
          algunos de tus gastos. Eso ocurre <strong>solo si tú lo autorizas</strong> en una
          pantalla de permiso de Bernie, y con estos límites:
        </p>
        <ul>
          <li>
            la app ve <strong>solo las categorías que elijas</strong>, y de cada gasto solo la
            fecha, el monto, la moneda, el comercio y la subcategoría;
          </li>
          <li>
            <strong>nunca</strong> ve tus correos, tus tarjetas, tus cuentas ni tus bancos;
          </li>
          <li>el acceso es de solo lectura: la app no puede crear, cambiar ni borrar nada;</li>
          <li>
            en <strong>Configuración → Apps conectadas</strong> ves qué compartes y el historial de
            permisos, cambias las categorías o desconectas la app. Al desconectarla deja de
            recibir datos al instante.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cómo revocar el acceso</h2>
        <p>Puedes cortar el acceso cuando quieras, y de forma independiente:</p>
        <ul>
          <li>
            En{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer noopener"
            >
              myaccount.google.com/permissions
            </a>{" "}
            → Bernie Wallet → <strong>Quitar acceso</strong>. A partir de ese momento no podemos
            leer ningún correo. Tus gastos ya registrados siguen en tu cuenta.
          </li>
          <li>
            Para <strong>borrar tu cuenta y todos tus datos</strong>, entra a{" "}
            <strong>Configuración → Mis datos → Borrar cuenta</strong>. El borrado es
            inmediato y definitivo: se eliminan tus gastos, categorías, medios de pago y
            retos, y le quitamos a Bernie el permiso sobre tu Gmail. No guardamos copia.
            Si prefieres que lo hagamos nosotros, escríbenos a{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </li>
        </ul>
      </section>

      <section>
        <h2>Tus derechos sobre tus datos</h2>
        <p>
          Tratamos tus datos personales conforme a la{" "}
          <strong>Ley N.° 29733, Ley de Protección de Datos Personales</strong> del Perú, y su
          reglamento (D.S. 016-2024-JUS). Como titular de los datos puedes, en cualquier momento:
        </p>
        <ul>
          <li>
            <strong>Acceder</strong> a todo lo que guardamos de ti y llevártelo en un archivo:{" "}
            <strong>Configuración → Mis datos → Descargar</strong>.
          </li>
          <li>
            <strong>Rectificar</strong> cualquier gasto, categoría o medio de pago desde la propia
            aplicación, cuando algo esté mal o incompleto.
          </li>
          <li>
            <strong>Cancelar</strong> (suprimir) tus datos borrando tu cuenta desde{" "}
            <strong>Configuración → Mis datos</strong>.
          </li>
          <li>
            <strong>Oponerte</strong> al tratamiento retirando tu consentimiento: basta con quitar
            el acceso a Gmail o borrar la cuenta.
          </li>
        </ul>
        <p>
          <strong>Finalidad y base legal.</strong> Usamos tus datos únicamente para registrar y
          mostrarte tus propios gastos. La base legal es tu <strong>consentimiento</strong>, que
          das al conectar tu Gmail y que puedes retirar cuando quieras, sin que eso afecte lo
          hecho antes de retirarlo.
        </p>
        <p>
          <strong>Conservación.</strong> Conservamos tus datos mientras tengas la cuenta abierta.
          Al borrarla, se eliminan de inmediato y no quedan copias de respaldo con tu información
          más allá de los plazos técnicos de nuestros proveedores de infraestructura. Las sesiones
          de prueba del modo demo se borran solas a las 24 horas.
        </p>
        <p>
          <strong>Transferencia internacional.</strong> Nuestros proveedores de infraestructura
          alojan los datos fuera del Perú (Estados Unidos). Al usar Bernie Wallet aceptas ese flujo
          transfronterizo, necesario para prestar el servicio.
        </p>
        <p>
          Si crees que no atendimos bien tu solicitud, puedes reclamar ante la{" "}
          <strong>Autoridad Nacional de Protección de Datos Personales (ANPD)</strong> del
          Ministerio de Justicia y Derechos Humanos.
        </p>
      </section>

      <section>
        <h2>Cambios en esta política</h2>
        <p>
          Si modificamos esta política, actualizaremos la fecha del encabezado. Los cambios que
          afecten de forma relevante el tratamiento de tus datos se anunciarán dentro de la
          aplicación.
        </p>
      </section>
    </LegalShell>
  );
}
