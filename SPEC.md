# SPEC.md — Bernie Wallet

> **Fuente de verdad (Spec-Driven Development).** Este documento manda. Ningún código puede contradecir esta spec. Si algo cambia, **primero se actualiza esta spec, luego el código**. Última actualización: 2026-10-03.

---

## 1. Objetivo

Bernie Wallet es una app web de **registro de gastos personales**. Lee correos de notificación bancaria desde Gmail, extrae los datos del gasto con un **parser programático (regex, sin IA)**, y los guarda en **Supabase**. El usuario también puede registrar gastos manualmente.

## 2. Alcance actual (v0)

- **Solo gastos (expenses)**: ver y registrar gastos. (Medios de pago avanzados, plan "pro", reportes, etc. quedan para más adelante.)
- **Registro manual SIEMPRE disponible**: cualquier usuario puede registrar gastos a mano. No es un "modo" que se elige.
- **BCP e Interbank** como origen de correos. (Otros bancos: futuro.)
- **Onboarding (primer login)**: se pregunta **con qué banco(s) trabaja** el usuario. Esto NO activa/desactiva un modo — solo le dice a la app **qué correos revisar** (por remitente, `system_senders`) y **cómo clasificarlos** (por asunto, `subject_pattern` → `notification_type`) durante la sincronización.
  - Selecciona **BCP** → al sincronizar, la app revisa los remitentes de BCP y clasifica los correos por su asunto.
  - No selecciona ningún banco → no hay correos que revisar (la sync no trae nada), pero el registro manual sigue disponible.
  - La selección de bancos es **editable luego** en Configuración.

## 3. Forma de trabajo

- Desarrollo **incremental, una pieza a la vez**. Antes de crear **cada página** se confirma diseño/alcance con el usuario.
- Código **escalable** y **buenas prácticas de Next.js 16**.
- **Preguntar ante cualquier duda** antes de implementar.

## 3.1 Convenciones de idioma

- **Todo el código, archivos, carpetas y el schema de la base de datos (tablas, columnas, enums internos) van en inglés**, con buenas prácticas.
- **Comentarios en español**, solo cuando el código es complejo; cortos, precisos y al detalle. Si no aportan, no se agregan.
- **Se mantiene en español**: el texto visible de la UI (audiencia en Perú), la prosa de esta documentación, y los **literales externos** que no elegimos (emails de remitentes, `subject_pattern` que coincide con el texto real del correo, y los nombres de categorías que ve el usuario).

---

## 4. Stack (no negociable)

| Pieza | Versión |
|---|---|
| Next.js | 16.2.9 — **App Router únicamente** |
| React | 19.2.4 |
| TypeScript | 5.x |
| Tailwind CSS | 4.x (ya configurado en `app/globals.css`) |
| shadcn/ui | CLI 4.11.0 (`pnpm dlx shadcn@latest`) |
| @supabase/supabase-js | 2.108.2 |
| Node.js | 22 LTS |
| Gestor de paquetes | **pnpm** |

### 4.1 Dependencias añadidas a la spec (con justificación)

El stack original solo declaraba `@supabase/supabase-js`. Estas dependencias son **necesarias** por el diseño de la app y se añaden formalmente aquí (SDD = la spec las autoriza):

| Dependencia | Por qué |
|---|---|
| `@supabase/ssr` | Patrón oficial de Supabase para **auth con cookies en App Router** (server components, route handlers, `proxy.ts`). |
| `next-themes` | **Modo oscuro** (light/dark/system) sin parpadeo y persistente, vía clase en `<html>`. Los tokens dark ya existen en `globals.css`. |
| `lucide-react` | Íconos (viene con el preset Nova de shadcn/ui). |
| `sonner` | **Toasts** (feedback de crear/editar/eliminar). Librería de toast oficial de shadcn/ui; ~5kb, accesible, temática con `next-themes`. |
| `recharts` | **Gráficos del dashboard** (categorías, medios de pago, tendencia). Motor del componente `chart` de shadcn/ui; temático con los tokens `--chart-*`. |
| `@electric-sql/pglite` *(dev)* | **Tests de base de datos** (`pnpm test:db`, en CI): corre todas las migraciones sobre Postgres en memoria y prueba RLS, las políticas contra clientes OAuth y las funciones de §15. Solo desarrollo; no llega al bundle. |

> **No se usa `googleapis`**: el acceso a Gmail se hace con **`fetch` nativo** (Node 22) contra la REST API. El cifrado del refresh token usa **`node:crypto`** nativo. No se instalan dependencias fuera de las listadas aquí.

---

## 5. Patrones prohibidos

- ❌ Pages Router / directorio `pages/`.
- ❌ `getServerSideProps` / `getStaticProps`.
- ❌ `useRouter` de `next/router` — usar `next/navigation`.
- ❌ `next/head` — usar la **Metadata API**.
- ❌ `middleware.ts` — en Next 16 se llama **`proxy.ts`**.
- ❌ Class components de React.
- ❌ Dependencias no declaradas en esta spec.
- ❌ Caching implícito — todo caching es **opt-in** con `"use cache"` (requiere `cacheComponents: true` en `next.config.ts`).

---

## 6. Convenciones Next.js 16 (verificadas en `node_modules/next/dist/docs/`)

- **Caching opt-in.** Por defecto NO se cachea data de usuario. `"use cache"` solo en datos estáticos y requiere `cacheComponents: true`.
- **`proxy.ts`** en la raíz: `export function proxy(request: NextRequest)` + `export const config = { matcher: [...] }`.
- **APIs dinámicas async**: `cookies()` y `headers()` (de `next/headers`) se **awaitan**. En route handlers, `params` es `Promise<...>`. Query params: `request.nextUrl.searchParams`.
- **Route handlers**: `export async function POST(request: NextRequest)` → `Response.json(...)` / `NextResponse.json(...)`.
- **Metadata API**: `export const metadata: Metadata` o `generateMetadata`.
- **Server Components por defecto**; `"use client"` solo en el borde interactivo.
- **Server Actions** `"use server"` + `revalidatePath` para mutaciones.
- **Route groups** `(auth)` / `(dashboard)` no afectan la URL.
- Reusar Tailwind v4 (`@import "tailwindcss"` + `@theme inline`) y fuentes Geist ya configuradas en `app/layout.tsx`.

---

## 7. Modelo de datos (Supabase + RLS)

Todas las tablas **excepto las de sistema** llevan `user_id` y **Row Level Security**. El aislamiento ocurre a nivel de base de datos, no de código. Identificadores en inglés.

### 7.1 Tablas de sistema (sin RLS de usuario; solo admin escribe)

**`system_banks`**
- `id` (uuid, PK)
- `official_name` (text) — ej: "BCP"
- `active` (boolean)

**`system_senders`**
- `id` (uuid, PK)
- `system_bank_id` (uuid, FK → system_banks)
- `sender` (text) — email exacto del remitente
- `subject_pattern` (text) — fragmento del subject para identificar el tipo
- `notification_type` (text) — enum: `credit_card_purchase` | `debit_card_purchase` | `service_payment` | `yape` | `transfer`

**Seed de `system_senders` (solo BCP por ahora; asuntos precisos, ver migración 0003):**

| sender | subject_pattern (frase clave) | notification_type |
|---|---|---|
| notificaciones@notificacionesbcp.com.pe | "Realizaste un consumo con tu Tarjeta de Crédito" | `credit_card_purchase` |
| notificaciones@notificacionesbcp.com.pe | "Realizaste un consumo con tu Tarjeta de Débito" | `debit_card_purchase` |
| notificaciones@notificacionesbcp.com.pe | "CONSTANCIA DE PAGO DE SERVICIO" | `service_payment` |
| notificaciones@notificacionesbcp.com.pe | "Transferencia a Terceros" | `transfer` |
| notificaciones@yape.pe | "Por tu seguridad, te notificaremos por cada yapeo que realices" | `yape` |

> Las frases son **precisas** a propósito: los consumos exigen "Realizaste un consumo con tu Tarjeta de…" para **excluir** los correos de **pago de la tarjeta** (que no son gasto). `transfer` (transferencia a terceros) también es un gasto, sin medio de pago asociado. Yape se trata como notificación dentro de BCP en esta v0.

### 7.2 Tablas personales del usuario (`user_id` + RLS)

**`users`**
- `id` (uuid, PK — igual a `auth.uid()`)
- `email` (text)
- `plan` (text) — "free" por defecto (preparado para "pro")
- `created_at` (timestamptz)

**`user_banks`**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `system_bank_id` (uuid, FK → system_banks)
- `alias` (text) — ej: "Mi BCP"

**`payment_methods`**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `user_bank_id` (uuid, FK → user_banks)
- `type` (text) — `credit_card` | `debit_card` | `yape`
- `identifier` (text) — "****2813", "****029"
- `alias` (text) — "TC BCP", "Yape BCP"

**`categories`**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `name` (text) — valor visible al usuario (español)

**`subcategories`**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `category_id` (uuid, FK → categories)
- `name` (text) — valor visible al usuario (español)

**`expenses`**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `payment_method_id` (uuid, FK → payment_methods, nullable — manual sin medio)
- `subcategory_id` (uuid, FK → subcategories, nullable)
- `amount` (numeric)
- `currency` (text) — "PEN" por defecto
- `merchant` (text) — comercio o beneficiario
- `occurred_at` (timestamptz) — fecha/hora del gasto
- `operation_number` (text, nullable)
- `document_number` (text, nullable)
- `message_id` (text, nullable) — id del correo Gmail; **único por usuario** → anti-duplicados
- `source` (text) — `sync` | `manual`
- `created_at` (timestamptz)

**`sync_logs`**
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `last_sync_at` (timestamptz)
- `emails_processed` (int)
- `emails_new` (int)
- `created_at` (timestamptz)

**`google_tokens`** *(añadida a la spec — necesaria para sync diferido)*
- `id` (uuid, PK)
- `user_id` (uuid, FK → users, único)
- `encrypted_refresh_token` (text) — AES-256-GCM
- `scope` (text)
- `updated_at` (timestamptz)

**`sync_failures`** *(migración 0004 — dead-letter de correos)*
- `user_id` (uuid, FK → users) — PK junto con `message_id`
- `message_id` (text) — id del correo Gmail descartado
- `attempts` (int) — reintentos in-run agotados (`MAX_RETRIES`)
- `last_error` (text) — motivo del descarte
- `updated_at` (timestamptz)
- Un correo aquí se filtra de futuros syncs (no se reintenta).

### 7.3 RLS

Para cada tabla personal (`users`, `user_banks`, `payment_methods`, `categories`, `subcategories`, `expenses`, `sync_logs`, `google_tokens`, `sync_failures`):

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user accesses only own data"
ON <table>
FOR ALL
USING (user_id = auth.uid());
```

(`users` usa `id = auth.uid()`.) Las tablas de sistema (`system_banks`, `system_senders`) son de solo lectura para usuarios autenticados.

### 7.4 Índice anti-duplicados

```sql
CREATE UNIQUE INDEX ON expenses (user_id, message_id) WHERE message_id IS NOT NULL;
```

---

## 8. Autenticación

- **Login con Google vía Supabase Auth.**
- El OAuth token de Google se **reutiliza para acceder a la Gmail API** del usuario (no se pide un segundo login).
- Scopes solicitados: `email`, `profile`, `https://www.googleapis.com/auth/gmail.readonly`.
- Query params del OAuth: `access_type=offline` siempre. `prompt=consent` **solo
  en reconexión** (`/login?reconnect=1`): forzarlo en cada login obliga a Google a
  repintar la pantalla de consentimiento y, con un scope restringido sin verificar,
  también el aviso de "app no verificada". Sin `prompt`, Google reconoce el permiso
  ya otorgado y salta ambas pantallas.
- Google solo entrega `provider_refresh_token` en la **primera** autorización o
  cuando se fuerza `prompt=consent`. El callback lo contempla: solo sobrescribe
  `google_tokens` si llega un token nuevo, así que un login silencioso preserva el
  guardado. Si el token se pierde, el modal de reconexión de `SyncButton` manda a
  `/login?reconnect=1`, que sí fuerza el consentimiento y emite uno nuevo.
- En el callback se cifra el `refresh_token` (AES-256-GCM, `node:crypto`) y se guarda en `google_tokens`.
- **Guard de estado inválido**: si un usuario **autenticado** no tiene fila en `users` (perfil ausente), los guards (layout del dashboard y onboarding) lo envían a `/api/auth/signout` → cierra sesión → `/login`. No se auto-crea el perfil fuera del callback de login.

### 8.1 Seed automático en el primer registro

Al registrarse por primera vez (no existe fila en `users`):

1. Crear fila en `users` (`id = auth.uid()`, `email`, `plan = "free"`).
2. Sembrar **categorías y subcategorías por defecto SIEMPRE** (sirven tanto para registro manual como para gastos sincronizados; nombres en español, contenido visible al usuario) — lista abajo.
3. Por cada **banco seleccionado en el onboarding** (opcional; editable luego en Configuración): crear fila en `user_banks` vinculada al `system_banks` correspondiente (hoy solo BCP). Si no selecciona ninguno, no se crea ninguna fila en `user_banks` — el registro manual igual funciona.

Categorías por defecto:
   - Vivienda → Alquiler, Internet, Luz, Agua, Gas
   - Transporte → Estacionamiento, Taxi / Uber, Combustible, Transporte público
   - Alimentación → Restaurantes, Supermercado, Delivery
   - Salud → (sin subcategorías)
   - Entretenimiento → (sin subcategorías)
   - Transferencias → Persona a persona, Pago a terceros
   - Otros → (sin subcategorías)

---

## 9. Flujo de sincronización (solo si el usuario eligió BCP)

```
Usuario presiona "Sincronizar"
  → (Límite free 1/día: PENDIENTE de activar; por ahora sin tope)
  → Leer cursor (último last_sync_at; si no existe → hace `SYNC_INITIAL_DAYS`, default 30)
  → Gmail API: query por remitente + asunto + fecha:
      from:(remitentes activos) subject:(subject_patterns) after:<cursor>
  → Listar TODOS los message_id que cumplen (paginando; listar es gratis).
  → Filtrar: quitar los ya importados (anti-duplicado) y los descartados
    (sync_failures.attempts >= MAX_ATTEMPTS).
  → Ordenar del MÁS VIEJO al MÁS NUEVO y tomar solo `SYNC_MAX_RESULTS` por
    corrida (el tope acota el número de correos leídos por corrida, no la cobertura).
  → Por cada correo (del más viejo al más nuevo):
      1. Detectar notification_type por sender + subject_pattern
         (si no matchea → descarte definitivo, se avanza el cursor)
      2. Pasar texto + tipo al parser programático → extraer datos del gasto
      3. payment_method_identifier → buscar o **auto-crear** medio de pago
      3b. **Autocategorización:** subcategoría según la *memoria por comercio*
          (aprendida de los últimos 2000 gastos ya categorizados; merchant normalizado
          → subcategoría más frecuente). Sin IA; si el comercio no tiene historial,
          queda sin categoría.
      4. Insertar en expenses (source = "sync"; occurred_at = fecha del correo)
      5. Avanzar el cursor hasta la fecha de este correo
  → Actualizar sync_logs (last_sync_at = fecha del último correo resuelto)
  → Responder { nuevos, procesados, restantes, descartados, detenido }

MANEJO DE FALLOS (todo dentro del MISMO sync, 1 solo clic):
- Fallo transitorio (getMessage/parser/insert LANZAN o error de BD ≠ 23505):
  se reintenta en el acto con backoff exponencial hasta MAX_RETRIES (3).
- Si tras los reintentos sigue fallando, el correo se DESCARTA (dead-letter):
  se omite, se registra en sync_failures y el sync continúa con los demás.
- Cortacircuitos: si CIRCUIT_LIMIT (3) correos seguidos agotan reintentos sin
  que ninguno tenga éxito, se asume caída del servicio → se PARA sin confirmar
  los descartes (se reintentan enteros el próximo sync; nada se pierde).
- Retorno `null` del parser (correo no parseable) o duplicado (23505):
  descarte definitivo, se avanza el cursor (no se reintenta).

ALCANCE (v0):
- **Primera sync**: todos los correos que cumplen (remitente + asunto) en los
  **últimos 30 días**, procesando `SYNC_MAX_RESULTS` por corrida del más viejo
  al más nuevo. Si hay más que el tope, `restantes > 0` y se sincroniza de nuevo
  para continuar (sin perder ninguno).
- **Siguientes syncs**: solo correos posteriores al cursor, con el mismo tope y
  el anti-duplicado por message_id.
```

---

## 9.1 Sincronización automática y tope del botón

El pipeline vive en `lib/sync/run-sync.ts` (`runSync(supabase, userId)`), no en el
route handler, porque lo corren **dos llamadores**:

- `POST /api/sync` — el botón, con el cliente del propio usuario y RLS activo.
- `POST /api/internal/sync-all` — el cron, con la secret key, recorriendo a todos.

Con la secret key **no hay RLS que respalde el aislamiento**: lo sostiene el código,
filtrando por `user_id` en cada consulta. Es la única parte de la app donde eso es
así, y por eso el pipeline está en un solo archivo y no repartido.

**El cron corre tres veces al día** (migración 0013, `pg_cron`): 09:50, 14:50 y 21:50
de Lima. Las notificaciones del banco llegan al instante, pero nadie revisa sus
gastos cada hora; la de la mañana va antes de las 10 para que lo que diga Bernie a
esa hora sea cierto. No se usan los crons de Vercel: el plan Hobby permite dos
diarios y uno ya está tomado por `/api/health`.

Un usuario que revocó el permiso de Gmail **no frena a los demás**: se cuenta como
`sinAcceso` y la corrida sigue. Lo nota en la app, donde se le ofrece reconectar.

**El botón tiene un mínimo de 2 minutos entre corridas** por usuario, verificado
contra `sync_logs`. La cuota de Gmail es del proyecto y no de la persona: sin tope,
alguien impaciente puede dejar sin sincronizar a los demás. La cuota diaria (mil
millones de unidades, ~505 por sincronización completa) no es el límite real; el
límite es el de 250 unidades por segundo y por usuario, que el pipeline no toca
porque lee los correos de a uno.

## 9.3 Modo descubrimiento

Mapear un banco nuevo exige conocer la redacción exacta de sus correos. Pedirle al
usuario que reenvíe ejemplos es lento y depende de que él se acuerde justo cuando
compra algo.

Con `SYNC_DISCOVERY=1`, cada corrida busca también los correos del remitente **sin
filtrar por asunto** y anota en `sync_discoveries` los que no reconoce: remitente,
asunto y el motivo. Así la app descubre sola qué plantillas le llegan.

- **Apagado por defecto**: cuesta cuota de Gmail y solo sirve mientras se mapea.
- **Tope de 10 correos por corrida**, y nunca relee los ya anotados.
- **No toca el cursor ni la cola de gastos**: es solo observación. Si falla, la
  sincronización sigue.
- Lo anotado —remitente y asunto— es dato personal: vive bajo RLS y **nunca** en los
  logs, que solo llevan el conteo (§14.4).

## 9.2 Visibilidad de las sincronizaciones

Un usuario al que le falla el sync era **invisible**: él veía gastos que no
aparecían y del otro lado no había forma de saberlo. `sync_logs` solo registraba las
corridas que terminaban bien.

Ahora cada corrida deja una fila, termine como termine, con `source`
(`manual` | `cron`), `discarded`, `halted` y `error_code`. **Solo números y
códigos**: nunca el mensaje de error, que puede traer datos del correo, y nunca
asuntos ni remitentes (§14.4).

En las corridas fallidas **el cursor no avanza**: se repite el `last_sync_at`
anterior, para que la siguiente vuelva a mirar los mismos correos.

Ese registro es también lo que hace visible el problema para el usuario: si la
última corrida terminó en `gmail_auth`, el layout de `(dashboard)` muestra un aviso
con un botón para reconectar. Antes eso solo aparecía al apretar "Sincronizar", y
con el cron corriendo solo el usuario puede pasar días sin apretarlo: sus gastos
dejan de aparecer y nada se lo explica. El botón dice **"Reconectar Gmail"**, no
"Cerrar sesión": que por dentro haya que rehacer el login es mecánica interna.

Deliberadamente **no se usa un servicio externo de monitoreo**. Cada tercero es un
encargado de tratamiento más que declarar en la política de privacidad y ante la
ANPD; con datos financieros, ese costo no se paga por un panel. Si algún día el
volumen lo justifica, se evalúa con los datos ya anonimizados.

Consulta de diagnóstico (desde el panel de Supabase, con service role):

```sql
select source, error_code, count(*) as corridas, count(distinct user_id) as usuarios
from sync_logs
where created_at > now() - interval '7 days'
  and (error_code is not null or halted or discarded > 0)
group by 1, 2
order by corridas desc;
```

## 10. Parser de extracción (programático, sin IA)

Los correos de notificación de BCP/Yape son **plantillas generadas por máquina**:
estructura fija y rótulos estables. Por eso el parser (`lib/parser/parser-service.ts`)
es **programático** — extrae los campos con **regex** sobre el texto normalizado del
correo. Es gratis, instantáneo y determinístico; **no usa ninguna API de IA**.

- Función pura: `extractExpense(text, notificationType) → ParsedExpense | null`.
- Contrato (campos en inglés):

```json
{
  "amount": number,
  "currency": "PEN | USD",
  "merchant": string,
  "payment_method_identifier": string,
  "payment_source_type": "credit_card | debit_card | account | yape | ''",
  "operation_number": string,
  "document_number": string
}
```

- `payment_source_type`: tipo del medio de origen detectado en el correo. Clave en
  `service_payment`, cuya "Cuenta de origen" puede ser tarjeta de crédito, débito o
  cuenta; el sync usa este valor (no un mapeo fijo) para asociar/crear el medio, así
  un pago de servicio con la TC ****2813 se une al mismo medio que sus consumos.

- **Fallback / red de seguridad**: si un correo no matchea la plantilla esperada
  (p. ej. el banco cambia el formato), `extractExpense` devuelve `null` y el sync lo
  registra en `sync_failures` — sin perder nada silenciosamente. Como el parser es
  puro (sin red), un `null` es definitivo: no se reintenta.

### 10.1 Extracción por `notification_type`

- **`credit_card_purchase` / `debit_card_purchase`**: monto ("Monto Total del consumo", moneda por símbolo S/ o US$), comercio (campo "Empresa"), tarjeta (últimos 4 de "Número de Tarjeta de…"), número de operación.
- **`yape`**: monto ("Monto de yapeo"), nombre del beneficiario ("Nombre del Beneficiario"), número de operación. `payment_method_identifier` = **solo** el celular de "Tu número de celular" (últimos 3 dígitos); **nunca** el del beneficiario, para no crear medios fantasma. Vacío si no aparece esa etiqueta.
- **`service_payment`**: monto ("Monto total"), empresa ("Empresa"), número de operación, documento ("Doc. pago"). La "Cuenta de origen" define `payment_source_type` (crédito/débito/cuenta) y sus últimos 4 dígitos.
- **`transfer`**: monto ("Monto transferido"), beneficiario ("Enviado a"), últimos 4 de la cuenta de origen ("Desde …"), número de operación. `payment_source_type` = `account`.

### 10.1.1 Interbank

Remitente único para todo: `servicioalcliente@netinterbank.com.pe`.

| Asunto | Tipo | Se registra |
|---|---|---|
| `Constancia de Pago Plin` | `plin` | Sí |
| `Constancia de pago` | — | **No** |
| `Constancia de transferencia` | — | **No** |
| Compra con TC / TD | — | Pendiente de plantilla |

**Por qué se ignoran dos.** "Constancia de pago" es el pago de la propia tarjeta de
crédito desde una cuenta: registrarlo contaría doble, porque las compras de esa
tarjeta ya entraron una a una. "Constancia de transferencia", en la muestra que
tenemos, va de una cuenta propia a otra cuenta propia: no sale plata del patrimonio.
Falta una muestra de transferencia **a un tercero** para poder distinguirlas; hasta
entonces no se toca, porque confundirlas inflaría los totales justo en los montos
más grandes.

Ignorar se implementa **no registrando el asunto**: la query de Gmail filtra por
asunto, así que esos correos ni se descargan.

**El Plin sale de la cuenta, no de una billetera** ("Cuenta cargo"), a diferencia
del Yape de BCP. Por eso su medio de pago es de tipo `account` y el identificador
son los últimos 4 dígitos de esa cuenta. No hizo falta tocar el esquema.

El cuerpo llega **solo como HTML**, que el parser recibe aplanado: los valores
quedan pegados a sus etiquetas en una sola línea ("Monto y moneda S/ 100.00").

### 10.2 Tests (`lib/parser/parser-service.test.ts`)

Tests con el runner nativo `node:test` (cero dependencias). Usan **fixtures** —
réplicas de las plantillas reales con valores ficticios— para verificar la extracción
de cada tipo y proteger contra regresiones al refactorizar. Se corren con `pnpm test`
y automáticamente en CI (`.github/workflows/ci.yml`) en cada PR y push a `main`.

---

## 11. Variables de entorno

| Variable | Ámbito | Uso |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | cliente + servidor | URL pública del sitio (OG/metadata + instalación PWA). Local: `http://localhost:3000`; prod: dominio HTTPS |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente + servidor | Publishable key (`sb_publishable_...`) — reemplaza a la antigua anon key; segura para el cliente |
| `GOOGLE_CLIENT_ID` | servidor | Refrescar el access token de Gmail |
| `GOOGLE_CLIENT_SECRET` | servidor | Refrescar el access token de Gmail |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | servidor | Clave AES-256-GCM (32 bytes base64) para cifrar el refresh token |
| `SUPABASE_SECRET_KEY` | servidor | Secret key (`sb_secret_...`) solo para la entrega de webhooks y el script de registro de apps — §15. Nunca en el cliente |
| `INTEGRATION_SECRET_KEY` | servidor | AES-256-GCM para cifrar los secretos de webhook de las apps conectadas — §15 |
| `INTERNAL_CRON_SECRET` | servidor | Protege `/api/internal/webhooks/deliver` (lo llama pg_cron) — §15 |

---

## 11.1 Migraciones y ambientes (Supabase)

Las migraciones (`supabase/migrations/*.sql`) son la **fuente de verdad del esquema** y se
gestionan con la **Supabase CLI** (`supabase`, devDependency). Scripts:

| Comando | Qué hace |
|---|---|
| `pnpm db:new <nombre>` | Crea un archivo de migración nuevo |
| `pnpm db:status` | Lista migraciones locales vs. aplicadas en el proyecto enlazado |
| `pnpm db:push` | Aplica las migraciones pendientes al proyecto enlazado |

**Ambientes.** Durante el MVP se usa **una sola base** (mismo proyecto Supabase para local
y producción), porque hay **un único usuario**. Implicación: esa base **es producción** — los
scripts de reseteo borrarían datos reales; no correrlos salvo intención de vaciarla. Cuando el
MVP esté listo, se separa en **dos proyectos** (`dev` y `prod`): se aplican las mismas
migraciones a ambos y se agregan scripts `db:push:dev` / `db:push:prod` por connection string.

**Bootstrap único** (el esquema ya estaba aplicado a mano): `supabase login` →
`supabase link --project-ref <ref>` → `supabase migration repair --status applied 0001..0006`
(registra como aplicadas las existentes sin re-ejecutarlas) → luego `pnpm db:push` para lo nuevo.

---

## 11.2 Respaldos

El plan gratis de Supabase **no incluye backups**. Con datos de terceros eso es
inaceptable: un borrado accidental sería definitivo.

Un workflow de GitHub Actions (`.github/workflows/backup.yml`) corre cada noche a
las 02:30 de Lima, después del último sync. Pide `POST /api/internal/backup`, cifra
la respuesta con AES-256-CBC y guarda el resultado como artefacto (90 días).

Tres decisiones:

- **Corre en GitHub, no en la máquina del autor.** Un respaldo que depende de que
  alguien se acuerde, o de que una laptop esté encendida, no es un respaldo.
- **GitHub no recibe credenciales de la base.** El endpoint se autentica con el
  secreto interno que ya usaban los otros crons. Si ese secreto se filtra, el daño
  es leer; con una credencial de Postgres, sería escribir.
- **Se cifra antes de salir de la máquina de CI**, así que el artefacto es un blob
  que GitHub no puede leer. La passphrase vive solo en los secretos del repo.

**Qué se respalda**: lo que el usuario no puede reconstruir — usuarios, bancos,
medios de pago, categorías, subcategorías, retos y gastos. **Qué no**: los tokens de
Google (son credenciales; tras restaurar, cada usuario reconecta) y las tablas
operativas de sync, que se regeneran solas. Un respaldo que copia todo multiplica lo
que hay que proteger.

El workflow **falla si el respaldo no trae gastos**: un archivo vacío que nadie mira
es peor que no tener respaldo, porque da falsa tranquilidad.

**Lo que esto no da**: recuperación a un punto exacto en el tiempo. Con un respaldo
nocturno, un error a media tarde cuesta las horas transcurridas. Es el precio
aceptado de no pagar el plan Pro; se revisa cuando haya usuarios desconocidos.

`scripts/restore-backup.md` documenta cómo descifrar y en qué orden restaurar.

## 12. Estructura del proyecto (objetivo, nombres en inglés)

```
bernie-wallet/
├── SPEC.md
├── proxy.ts                      ← refresca sesión Supabase (NO middleware.ts)
├── next.config.ts
├── app/
│   ├── layout.tsx                ← root layout (Metadata API)
│   ├── page.tsx                  ← home (pública)
│   ├── privacy/page.tsx          ← política de privacidad (pública)
│   ├── terms/page.tsx            ← condiciones del servicio (pública)
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/                 ← route group (no agrega segmento a la URL)
│   │   ├── layout.tsx            ← layout protegido compartido
│   │   ├── dashboard/page.tsx    ← /dashboard
│   │   ├── activity/page.tsx     ← /activity (registros de gastos)
│   │   ├── categories/page.tsx   ← /categories
│   │   └── settings/page.tsx     ← /settings
│   └── api/
│       ├── auth/callback/route.ts
│       └── sync/route.ts
├── components/ui/                ← shadcn
├── lib/
│   ├── supabase/{client,server}.ts
│   ├── crypto.ts                 ← AES-256-GCM (node:crypto)
│   ├── gmail/gmail-service.ts    ← fetch nativo
│   └── parser/parser-service.ts  ← parser programático (regex, sin IA)
├── supabase/migrations/0001_initial_schema.sql
└── types/index.ts
```

---

## 13. Orden de desarrollo (hoja de ruta incremental)

Cada hito se implementa, se revisa, y recién entonces se pasa al siguiente. Antes de cada **página** se confirma su diseño.

1. **Fundación**: `SPEC.md`, dependencias, `.env.example`, config. ← *(este hito)*
2. **Base de datos**: `0001_initial_schema.sql` (tablas + RLS + seed BCP).
3. **Clientes Supabase + sesión**: `lib/supabase/*`, `proxy.ts`.
4. **Home** (pública).
5. **Login** + callback OAuth + `lib/crypto.ts`.
6. **Onboarding** (selección de banco / modo manual + seed de usuario).
7. **Dashboard** (layout protegido + página). Enfoque en **análisis**: saldo,
   KPIs, gráficos (categoría, medio, tendencia). Con filtros y orden (ordenar el
   desglose de categorías) para explorar los datos. **No** incluye registro manual
   ni lista de movimientos (eso vive en Activity).
8. **Activity** (lista de gastos): enfoque en **operar/encontrar**. Incluye
   **Agregar gasto** (manual) y **Sincronizar** (con estado de última sync), más
   filtros, búsqueda y **ordenamiento** de la lista (fecha ↕, monto ↕).
9. **Gamificación y logros compartibles** (§16): racha diaria, catálogo corto de
   logros e imágenes para redes. Sin datos privados y sin página pública.
10. **Panel de administración** (§17): consola del operador. Agregados y tablas de
   sistema, nunca datos de usuarios.

> **Responsive (soporte desde 320px).** En móvil los filtros se colapsan en un
> **bottom-sheet** (`components/ui/sheet.tsx`, sobre la primitiva Dialog de Base UI):
> un botón "Filtros" con contador + los filtros activos como chips removibles; por
> defecto (sin filtros) = **mes actual**. En desktop la barra de filtros es inline.
> El dashboard usa `max-w-5xl` (saldo+KPIs y gráficos en 2 columnas); Activity y las
> demás páginas quedan en columna legible (`max-w-2xl`).

> **PWA (instalable en iOS/Android).** `app/manifest.ts` (display standalone,
> start_url `/dashboard`, theme esmeralda). Iconos generados con `next/og`
> `ImageResponse` (billetera marfil sobre esmeralda, mismo mark que el logo):
> `app/apple-icon.tsx` (180) + route handlers `/icon-192`, `/icon-512`,
> `/icon-maskable`; favicon en `app/icon.svg`. Meta de iOS vía `metadata.appleWebApp`.
> Sin service worker (no se requiere para instalar). En Configuración, sección
> **"Instalar app"** (`InstallApp`): botón nativo vía `beforeinstallprompt` en
> Android/Chrome, instrucciones en iOS, oculto si ya está en modo standalone.
> **Métricas honestas en el dashboard (hito 12.1).** Tres reglas que nacen de que
> el mes en curso está incompleto y no debe compararse ni pintarse como si estuviera
> cerrado:
> 1. **Comparación a ventana igual.** El delta vs. el mes anterior compara el mes en
>    curso contra los **mismos días** del mes pasado (día 1 → día de hoy), no contra
>    el mes completo. Comparar 12 días contra 31 hace que el badge siempre marque
>    caída al inicio del mes. La etiqueta lo dice: "vs. mismos días".
> 2. **La proyección se ve como estimación, no como hecho.** Se muestra como
>    segmento apilado translúcido sobre el mes en curso en la tendencia (con leyenda
>    "Gastado / Proyectado") y el KPI queda rotulado como estimado. Cálculo:
>    promedio diario × días del mes, menos lo ya gastado.
> 3. **El mes en curso se marca como tal** en el eje de la tendencia (sufijo "·"),
>    para que su barra más baja no se lea como desplome frente a meses completos.
>
> **Paginación obligatoria en consultas de agregación.** La API de Supabase corta en
> `max_rows` (1000) **sin error**: una consulta sin paginar devuelve menos filas y los
> totales salen mal en silencio. `lib/supabase/paginate.ts` (`fetchAllRows`) recorre
> las páginas con `range`; el llamador pasa una fábrica de consultas, una por página.
>
> **Gráficos con carga diferida.** Recharts pesa y los gráficos viven bajo el pliegue.
> El import dinámico vive en `components/dashboard/lazy-charts.tsx`, que es un
> **componente cliente**: si la página (Server Component) hiciera el `next/dynamic`,
> Next no divide el chunk — ver `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`.
>
> **Desglose por categoría: top 5 + resto expandible.** El desglose pinta las **5
> categorías de mayor gasto** y agrupa las restantes en una sola barra, que se rotula
> con su cantidad (`+3 categorías`, `+1 categoría`) y **nunca** con un nombre de
> categoría: el nombre "Otros" chocaba con la categoría real del mismo nombre que
> trae el seed, y un gasto parecía caer en una categoría a la que el modelo de datos
> no puede asignarlo. La agrupación solo entra con **más de 6** categorías; con 6 o
> menos se pintan todas. La barra agrupada va siempre al final, no es clickeable para
> bajar de nivel, y un clic sobre ella **expande** el desglose. El control
> "Ver todas (N) / Ver menos" hace lo mismo desde el encabezado del bloque. Expandido,
> el alto deja de estar topado para que las filas no se apelmacen, y cada categoría
> recupera su drill-down.
>
> **Alturas derivadas del contenido.** El desglose por categoría calcula su alto por
> número de filas (~34px por fila, con mínimo y máximo) en vez de un alto fijo: con
> una sola categoría el alto fijo producía una barra desproporcionada.
>
> **Creación al paso de categoría y subcategoría (hito 8.1).** En el formulario de
> gasto (agregar **y** editar) los campos Categoría y Subcategoría son **combobox**
> (`components/ui/creatable-combobox.tsx`, sobre la primitiva Combobox de Base UI) en
> vez de `<select>`: al escribir un nombre que no existe aparece la opción
> `+ Crear "X"`. Así se categoriza un gasto sin salir de Activity.
>
> - El formulario envía `categoryId` o `categoryName`, y `subcategoryId` o
>   `subcategoryName`. La Server Action **resuelve antes de guardar el gasto**:
>   busca por nombre **sin distinguir mayúsculas** y reutiliza la fila existente si
>   la hay, crea lo que falte, y recién entonces inserta/actualiza el gasto.
> - Una subcategoría nueva **exige** categoría (existente o nueva). Una categoría
>   nueva sin subcategoría se crea igual y el gasto queda sin subcategoría — mismo
>   comportamiento que hoy al elegir solo categoría.
> - Nombres con `trim` y máximo 40 caracteres. Si la creación falla, el gasto **no**
>   se guarda y la action devuelve el error.
> - Al crear algo se revalida también `/categories`, para que la categoría nueva
>   aparezca ahí sin recargar.

9. **Categories**.
10. **Settings**.
11. **Gmail + Parser + Sync** (solo si eligió BCP).
12. **Páginas legales** (`/privacy`, `/terms`) — requisito para publicar la app
    OAuth de Google. Ver §14.
13. **Apps conectadas** (Casorio Club vía OAuth 2.1) — ver §15. *(propuesta)*

---

## 14. Páginas legales y publicación de la app OAuth

### 14.1 Por qué existen

`gmail.readonly` es un scope **restringido** de Google. Mientras el proyecto está
en estado de publicación **Prueba**, Google **caduca los refresh tokens a los 7
días**, obligando al usuario a reconectar Gmail cada semana. Pasar el estado a
**En producción** elimina esa caducidad, y para publicar la consola exige:

- logo de 120×120 en la pantalla de consentimiento,
- dominio autorizado (`bernie-wallet.vercel.app`),
- **URL pública de la página principal**,
- **URL pública de política de privacidad**,
- URL de condiciones del servicio (opcional).

El detalle operativo del trámite vive en `docs/google-oauth/README.md`.

### 14.2 Requisitos técnicos de las páginas

- Rutas **públicas** y **estáticas** (Server Components, cero JS de cliente),
  dentro del dominio autorizado. `proxy.ts` solo refresca la sesión de Supabase y
  no bloquea rutas, así que no requieren cambios de acceso.
- Alcanzables **sin login**: Google rechaza una política detrás de autenticación.
- Enlazadas desde el footer público (`components/home/site-footer.tsx`).
- Shell compartido: `components/legal/legal-shell.tsx` (header + footer de la
  landing, tipografía de prosa, fecha de última actualización).

### 14.3 Contenido obligatorio de la política

Por tratarse de un scope restringido, la política **debe declarar explícitamente**
el cumplimiento de la *Google API Services User Data Policy*, incluidos los
requisitos de **Limited Use**. Además describe:

- qué datos se leen: solo correos de los remitentes de `system_senders` (BCP),
  con acceso de **solo lectura**; Bernie no envía, modifica ni borra correos;
- qué se extrae y guarda en `expenses` (monto, moneda, comercio, fecha, números de
  operación/documento) y en `payment_methods` (solo los últimos dígitos);
- qué **no** se guarda: credenciales bancarias, contraseñas, ni el contenido
  completo de los correos;
- dónde vive: Supabase con RLS por `user_id`; el refresh token de Google en
  `google_tokens`, cifrado con AES-256-GCM;
- que no se comparten ni venden datos a terceros, ni se usan para publicidad ni
  para entrenar modelos;
- cómo revocar el acceso (`myaccount.google.com/permissions`) y cómo pedir el
  borrado de la cuenta.

---

## 14.5 Endurecimiento

**Cabeceras de seguridad** (`next.config.ts`): `frame-ancestors 'none'` más
`X-Frame-Options: DENY` contra clickjacking, `nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` —las URLs llevan ids de
categorías y no deben viajar a terceros—, `Permissions-Policy` cerrando cámara,
micrófono, ubicación y pagos, y HSTS por un año. **No hay CSP completa todavía**:
Next inyecta scripts en línea y una CSP estricta necesita nonces por request; es su
propia tanda y romper la app por hacerla a medias sería peor.

**Aviso de entorno** (`scripts/check-dev-env.mjs`, vía `predev`): mientras la base de
desarrollo y la de producción sean la misma (§11.1), arrancar `pnpm dev` imprime una
advertencia visible. Es un paliativo consciente, no la solución: la solución es
separarlas.

## 14.4 Datos personales y derechos del titular (Ley 29733)

Desde que hay usuarios que no son el autor, aplica la **Ley N.° 29733** y su
reglamento (D.S. 016-2024-JUS, vigente desde el 31-03-2025). Lo que eso exige del
producto, y dónde vive:

- **Acceso y portabilidad.** `GET /api/export` devuelve en JSON todo lo que la app
  guarda del usuario. Corre con su propia sesión, así que RLS garantiza que nadie
  pueda pedir los datos de otro. **No incluye los tokens de Google**: son
  credenciales, no datos del titular, y entregarlas en claro crearía el problema que
  el cifrado evita.
- **Supresión.** `deleteAccount()` revoca primero el permiso en Google, luego borra
  la fila de `users` —que arrastra en cascada gastos, categorías, subcategorías,
  medios, bancos, tokens, retos, descubrimientos y fallos de sync— y por último borra
  el usuario de `auth.users` con la secret key. Ese orden importa: si falla el último
  paso queda una cuenta sin datos, que es molesto; al revés quedarían datos vivos sin
  dueño, que es grave. Una prueba de migraciones comprueba la cascada, así que una
  tabla nueva que olvide `on delete cascade` hace fallar el build.
- **Rectificación** y **oposición** ya existían: editar gastos en Activity, y
  desconectar Gmail o borrar la cuenta.
- La política de privacidad declara finalidad, base legal (consentimiento), plazo de
  conservación, transferencia internacional y el canal de reclamo ante la ANPD.

**Canal de reporte.** Configuración → Ayuda abre un `mailto` al buzón de soporte.
Es un `mailto` a propósito: un formulario propio guardaría texto libre —donde la
gente pega lo que sea, incluido el correo del banco— y un servicio de terceros sería
un encargado de tratamiento más que declarar. El cuerpo del correo pide
explícitamente no copiar el contenido de los correos del banco.

**Los logs no llevan contenido.** El sync registra conteos, nunca remitentes ni
asuntos: un asunto del BCP incluye monto y comercio, y los logs viven en un tercero
con otra retención y otros accesos. Lo que el usuario necesite ver de sus propios
correos vive en `sync_discoveries`, protegido por RLS.

## 15. Apps conectadas: Casorio Club vía OAuth 2.1 (hito 13)

> **Estado: propuesta, pendiente de aprobación.** Nada de esta sección se implementa
> hasta que se apruebe. Contrato del lado cliente: `docs/integracion-bernie.md` en
> el repo de Casorio Club. Se diseña **listo para producción**: el contrato no cambia
> si mañana se conectan más apps o se cambia el proveedor OAuth.

### 15.1 Objetivo

Que el usuario pueda **pasar a Casorio Club los gastos de las categorías que elija**
(ej. "Matrimonio") con un botón **"Conectar con Bernie Wallet"**, como cualquier
"Conectar con Google". Bernie es el **proveedor** (autorización + API de solo
lectura); Casorio es el **cliente**. Casorio nunca escribe en Bernie.

### 15.2 Estándares que se siguen

| Área | Estándar | Cómo se aplica |
|---|---|---|
| Autorización | **OAuth 2.1** + **RFC 9700** (OAuth Security BCP) | Authorization code + **PKCE S256** obligatorio, `state` anti-CSRF, redirect URIs exactas, rotación de refresh tokens. Lo implementa el **OAuth 2.1 Server de Supabase Auth** (beta, gratis); Bernie pone la pantalla de consentimiento. |
| Cliente | RFC 6749 §2.1 | Casorio = cliente **confidencial** (`client_secret_basic`). Registro dinámico **desactivado**. |
| Mínimo privilegio | — | Solo categorías elegidas y solo `id`, fecha, monto, moneda, comercio, subcategoría. Nunca medio de pago, banco, nº de operación ni correo. |
| Contrato de API | **OpenAPI 3.1** | `docs/api/openapi.json`, servido en `/api/v1/openapi.json`. Versión en la ruta (`/v1`); cambios incompatibles = `/v2`. |
| Sincronización | Cursor incremental (patrón Plaid `transactions/sync`) | `added / modified / removed` desde un cursor opaco. |
| Errores | **RFC 9457** Problem Details | `application/problem+json` con `type`, `title`, `status`, `detail`, `code`. |
| Rate limiting | `429` + `Retry-After` + cabeceras `RateLimit-*` (borrador IETF) | 60 req/min por `(client_id, usuario)`. |
| Webhooks | **Standard Webhooks** (standardwebhooks.com) | Cabeceras `webhook-id`, `webhook-timestamp`, `webhook-signature` (HMAC-SHA256), reintentos con backoff, entrega al menos una vez. |
| Dinero | — | `amount` como **string decimal** en JSON (no float). |
| Fechas | RFC 3339 | `occurredAt` en UTC. |

### 15.3 Seguridad en la base de datos

Un access token OAuth de Supabase es un JWT `authenticated` con el `sub` del usuario
**más el claim `client_id`**. Con las políticas actuales (`user_id = auth.uid()`) ese
token leería **todo**, incluido `google_tokens`. Por eso:

1. **Política restrictiva en cada tabla personal** (las de §7.3 + las nuevas):
   ```sql
   create policy "no oauth clients" on <tabla>
     as restrictive for all to authenticated
     using ((auth.jwt() ->> 'client_id') is null);
   ```
2. **Un único camino de datos:** la función `shared_expense_changes(...)`
   (`security definer`, `search_path = ''`, `execute` revocado a `public` y `anon`)
   que filtra a mano por `auth.uid()`, por el `client_id` del token, por
   `integration_clients.active` y por `integration_shares`.
3. **Validación del token en la API:** firma, `iss` = proyecto de Bernie, `exp`, y
   `client_id` presente y activo en `integration_clients`. Supabase no soporta
   *resource indicators* (RFC 8707), así que el `aud` es el estándar
   (`authenticated`); el `client_id` + la política restrictiva cumplen ese rol.
4. **Llaves de firma asimétricas (ES256).** Se migra el proyecto a *JWT signing
   keys* para validar tokens localmente contra el JWKS sin llamar a Auth. Es un
   cambio de todo el proyecto: se hace con rotación (sin cortar sesiones) y con
   aprobación explícita.

### 15.4 Modelo de datos (migración `0009_oauth_integrations.sql`)

**Tablas de sistema** (sin acceso de usuarios; solo `service_role`):
- `integration_clients` — `client_id` text PK, `name`, `webhook_url`,
  `webhook_secret` (cifrado AES-256-GCM con `lib/crypto.ts`), `active` bool,
  `created_at`. Lista blanca de apps: reemplaza a una variable de entorno.
- `integration_events` — *outbox* de webhooks: `id` uuid (= `webhook-id`),
  `client_id`, `user_id`, `type`, `payload` jsonb, `attempts`, `next_attempt_at`,
  `delivered_at`, `dead_at`, `last_error`, `created_at`.
- `api_rate_limits` — `(client_id, user_id, window_start)` PK, `count`.

**Tablas personales** (RLS de dueño + restrictiva OAuth):
- `integration_connections` — `(user_id, client_id)` PK, `client_name` (el que mostró
  la pantalla de consentimiento; Configuración no depende de la API beta de grants),
  `shares_version` int
  (sube con cada cambio de categorías compartidas; un cursor con otra versión →
  `cursor_reset`), `created_at`, `updated_at`. Borrarla = desconectar (cascada a shares).
- `integration_shares` — `(user_id, client_id, category_id)` PK, `created_at`,
  FK a `integration_connections`.
- `integration_audit` — `user_id`, `client_id`, `action`
  (`granted | shares_changed | revoked`), `detail` jsonb, `created_at`. Solo lectura
  para el usuario: es su historial de accesos.

**Cambios en `expenses`:**
- `updated_at timestamptz not null default now()` + trigger que lo actualiza en
  cada `update`. Es la base del cursor.
- `expense_tombstones` — `expense_id`, `user_id`, `deleted_at`, llenada por trigger
  `after delete` en `expenses`. Se purgan a los 90 días (pg_cron); un cursor más
  viejo que eso recibe `reset`.

**Funciones** (`security definer`, `search_path = ''`, solo `authenticated`):
`shared_expense_changes(since_ts, since_id, shares_version, limit)`,
`integration_shares_version()`, `consume_rate_limit(limit)`,
`revoke_integration(client_id)` (una app solo puede revocarse a sí misma; si
revoca el usuario, se encola `grant.revoked`). `cursor_reset` se lanza con
`errcode = 'PT409'` para que PostgREST responda 409.

**Triggers que encolan eventos** (solo si el usuario tiene una app conectada):
cambios en gastos de una categoría compartida, y cambios en `integration_shares`
→ insertan en `integration_events` el tipo `expenses.sync_available` (uno por
usuario y cliente, deduplicado mientras haya uno pendiente).

### 15.5 Flujo de autorización

1. Casorio redirige a `…/auth/v1/oauth/authorize` (PKCE S256, `state`, `scope=email`).
2. Supabase redirige a **`/oauth/consent?authorization_id=…`**.
3. Sin sesión → `/login?next=…`. **Nuevo:** `/login` y el callback respetan `next`
   solo si es una ruta interna (empieza con `/`, no con `//` ni `/\`): sin open
   redirects. Usuario anónimo (demo) → "Necesitas una cuenta real para conectar apps".
4. Pantalla de consentimiento: nombre de la app (de `getAuthorizationDetails`),
   **qué compartirá** (campos de 15.2), **selector de categorías** (preselecciona la de
   boda: "Matrimonio", "matri", "Boda", "Wedding"…; al menos una obligatoria), aviso "lo verán todos los
   miembros de tu boda en Casorio", **Permitir / Cancelar**.
5. Permitir → Server Action: guarda `integration_shares` + `integration_audit`
   (`granted`) → `approveAuthorization()` → redirige con el código.
   Cancelar → `denyAuthorization()`.
6. Si ya había autorizado (no viene `authorization_id`), redirige directo.

### 15.6 API v1

Todas: `Authorization: Bearer <access token OAuth>`, `runtime = "nodejs"`, sin
caché (`Cache-Control: no-store`), errores RFC 9457, rate limit de 15.2, log
estructurado por request (`client_id`, `user_id`, ruta, status, latencia; sin
montos ni comercios).

**`GET /api/v1/shared-expenses/sync?cursor=<opaco>&limit=<1..500, def. 200>`**
```json
{
  "added":    [ { "id": "uuid", "occurredAt": "2026-10-01T15:04:05Z", "amount": "150.00",
                  "currency": "PEN", "merchant": "…", "subcategory": "Fotógrafo" } ],
  "modified": [ … mismo formato … ],
  "removed":  [ "uuid" ],
  "nextCursor": "opaco",
  "hasMore": false
}
```
- Sin `cursor` = sincronización inicial: todo en `added`.
- El cursor es opaco para el cliente (base64url de `{v, ts, id, sharesVersion}`).
  Orden estable por `(updated_at, id)`. Se relee una **ventana de 2 min** antes del
  cursor para no perder transacciones que confirmaron tarde; el cliente es idempotente.
- Un gasto que **sale** de una categoría compartida aparece en `removed`.
- Si cambiaron las categorías compartidas o el cursor es más viejo que los
  tombstones → `409` con `code: "cursor_reset"`: el cliente borra su cursor y
  resincroniza desde cero.
- `hasMore: true` → el cliente vuelve a llamar con `nextCursor`.

**`POST /api/v1/connection/revoke`** — la app se desconecta a sí misma:
**primero** revoca el grant en Supabase Auth (invalida sus refresh tokens) y
**después** borra la conexión y registra `revoked`. Si el grant no se puede
revocar responde `503` sin tocar nada: nunca queda un grant vivo sin conexión,
que haría que Supabase auto-apruebe la próxima conexión saltándose
`/oauth/consent`. Responde `204`. Un fallo transitorio de Auth al validar el
token responde `503` (`unavailable`), no `401`, para que la app no crea que fue
desconectada.
Supabase no expone RFC 7009, por eso existe este endpoint.

**`GET /api/v1/openapi.json`** — el contrato (público).

### 15.7 Webhooks (Standard Webhooks)

- **Delgados:** no llevan datos de gastos, solo avisan. Si se filtran, no exponen nada.
  ```json
  { "type": "expenses.sync_available", "timestamp": "RFC 3339",
    "data": { "userId": "uuid" } }
  ```
  Tipos: `expenses.sync_available`, `grant.revoked`.
- Firma `v1,<base64(HMAC-SHA256(secret, id.timestamp.body))>` con el
  `webhook_secret` del cliente.
- **Entrega:** `after()` de `next/server` intenta enviar al momento; además
  `pg_cron` + `pg_net` llaman cada minuto a `POST /api/internal/webhooks/deliver`
  (protegido con un secreto) para los pendientes. Backoff exponencial
  (1 min → 24 h, 8 intentos); luego `dead_at`.
- El cliente debe responder `2xx` rápido; cualquier otro estado = reintento.
- Los webhooks **no reemplazan** el pull: si se pierden, el cliente igual
  sincroniza (Casorio: al abrir la bandeja).

### 15.8 Configuración → "Apps conectadas"

Por cada conexión (`integration_connections`): fecha, categorías compartidas
(editables, al menos una → `shares_changed`), historial de `integration_audit` y
**Desconectar**. Oculta para usuarios demo.

**Desconectar** primero corta el acceso a datos (`revoke_integration`) y después
revoca el grant en Supabase Auth (`revokeGrant`). Si lo segundo falla, la app ya no
lee nada; el grant queda listado como **permiso huérfano** (de `listGrants()` sin
conexión) con un botón **Quitar permiso** para reintentar. Sin esto, un grant
huérfano haría que Supabase auto-apruebe la próxima conexión sin pasar por la
pantalla de consentimiento, y la app quedaría sin categorías.

### 15.9 Configuración manual (la hace el usuario)

1. **Variables de Bernie** (Vercel + `.env.local`): `SUPABASE_SECRET_KEY`,
   `INTEGRATION_SECRET_KEY` (`openssl rand -base64 32`) e `INTERNAL_CRON_SECRET`
   (`openssl rand -base64 32`).
2. **Migración 0009** a la base (es producción, §11.1): `pnpm db:push`.
3. **Supabase → Authentication → OAuth Server:** activar; authorization path
   `/oauth/consent`. Verificar Site URL = dominio de producción de Bernie.
4. **OAuth Apps → nuevo cliente "Casorio Club"**, confidencial, redirect URIs exactas:
   `https://casorio-club.vercel.app/api/bernie/callback` y
   `http://localhost:3400/api/bernie/callback`. El `client_id` y el secret van a
   Casorio.
5. **Registrar el cliente en Bernie** (genera el secreto de webhook y lo imprime una vez):
   `node --conditions=react-server --env-file=.env.local scripts/register-integration-client.ts <client_id> "Casorio Club" https://casorio-club.vercel.app/api/webhooks/bernie`
6. **Vault** (SQL editor), para que `pg_cron` pueda llamar a la entrega de respaldo:
   ```sql
   select vault.create_secret('https://bernie-wallet.vercel.app', 'bernie_site_url');
   select vault.create_secret('<INTERNAL_CRON_SECRET>', 'internal_cron_secret');
   ```
7. *(Opcional, recomendado)* migrar a llaves JWT asimétricas (15.3.4).

### 15.10 Páginas legales

`/privacy` hoy dice que no se comparten datos con terceros. Se actualiza: "solo con
apps que **tú** conectas, solo las categorías que elijas; puedes ver el historial y
desconectarlas en Configuración".

### 15.11 Pruebas

- `node:test`: validador de `next`; codificar/decodificar cursor; firma de
  webhooks contra los vectores de prueba de Standard Webhooks; Problem Details.
- **Contrato:** los ejemplos de `openapi.json` son fixtures; un test valida que la
  respuesta real del endpoint los cumple. Casorio usa los mismos ejemplos (§10 de su spec).
- SQL documentado en la migración (`set request.jwt.claims`): con `client_id` →
  0 filas en todas las tablas personales; `shared_expense_changes` solo devuelve
  categorías compartidas; un gasto movido de categoría sale en `removed`.

### 15.12 Riesgos

- **OAuth Server de Supabase en beta.** Mitigación: el contrato (OpenAPI, cursor,
  webhooks) no depende de Supabase; si cambia, se reemplaza solo el servidor de
  autorización sin tocar a los clientes.
- **Una sola base compartida** (§11.1): antes de invitar usuarios reales, separar
  dev/prod. Bloqueado por el límite de 2 proyectos gratis de Supabase: hay que pausar
  otro proyecto, pagar el plan Pro, o levantar Supabase local con Docker, que es
  gratis y además aísla del todo. Mientras tanto, `pnpm dev` avisa (§14.5).

## 16. Gamificación y logros compartibles (hito 14)

### 16.1 Objetivo

Dar al usuario un motivo para volver cada día y algo que pueda publicar en sus redes
sin exponer su vida financiera. El público objetivo es joven y quiere mostrar lo que
hace; la app tiene que dejarlo presumir **disciplina**, nunca **consumo**.

### 16.2 Regla de privacidad (manda sobre todo lo demás)

Lo compartible se construye **solo** con conteos, rachas, porcentajes y fechas.

Queda **prohibido** en cualquier imagen o texto compartible:

- Montos, saldos, promedios y proyecciones, en cualquier moneda.
- Nombres de comercio (`expenses.merchant`), que revelan ubicación y rutina.
- Nombres de personas, que llegan como comercio en Yape/Plin y transferencias.
- Medio de pago, que insinúa el perfil crediticio.
- Nombres de categoría: en un historial real las que más pesan suelen ser Salud o
  Transferencias, que son justamente las íntimas.

De esta regla se deriva la decisión técnica más importante del hito: como el
contenido no es sensible y no hay nada que proteger con un token, **no existe página
pública de share ni tabla `shares`**. La imagen se genera y se entrega al usuario; él
decide dónde la publica. Sin ruta pública no hay datos personales fuera de RLS, ni
link que revocar, ni snapshot que versionar.

### 16.3 Racha diaria ("estar al día")

**Un día cuenta** si al cerrarse no queda ningún gasto de ese día sin `subcategory_id`.
Un día sin gastos cuenta solo: el usuario está al día.

La definición nace de la mecánica de Duolingo, donde la racha funciona porque la
acción diaria **siempre está disponible** (siempre se puede hacer una lección). En
esta app categorizar depende de que haya habido un gasto, así que la acción que
siempre está disponible es *estar al día*, no *categorizar*. Medir eso y no el número
de gastos tocados evita castigar al usuario por un día tranquilo.

- La racha se **deriva de `expenses`**; no hay tabla ni contador que mantener, así que
  no puede desfasarse del dato real.
- **Un gasto importado después del cierre de su día nunca rompe la racha hacia atrás.**
  El sync puede traer un correo con retraso y el usuario no controla eso. Esos gastos
  van a "ponerte al día", que vive **fuera** de la racha.
- El backlog histórico (gastos viejos sin categoría) tampoco entra en la racha: una
  meta que arranca en una montaña desmotiva. Se muestra aparte, como progreso propio:
  una insignia discreta en el ítem "Actividad" del menú (punto en móvil), el enlace
  "Ponerte al día" de la tarjeta de racha, y un chip **Sin categoría** en los filtros
  de Activity que viaja por el mismo parámetro `cat` con el valor `none`. El chip solo
  aparece si hay pendientes: un filtro que siempre devuelve cero es ruido.

**Congeladas.** Hasta 2 acumulables, otorgadas automáticamente al llegar a 7 y a 30
días; una congelada se consume sola para cubrir un día incumplido. No se compran ni se
reclaman: están en el bolsillo del usuario antes de necesitarlas. Existen porque una
racha rota es el momento en que se pierde al usuario.

### 16.4 Catálogo de logros

- **Racha de días al día** — el loop principal. Hitos compartibles a los 7, 30, 100 y
  365 días. El de 7 es el que más importa.
- **Mes 100% categorizado.**
- **Movimientos anotados automáticamente** — hitos en 100, 500 y 1000. Es el logro que
  mejor cuenta la promesa del producto: muchos gastos registrados, cero escritos a mano.
- **Días seguidos sin gastar.**
- **Retos de abstinencia** (30 días sin delivery, semana sin taxis). Se comparten
  **en progreso**, no solo al terminar: un reto en curso invita a otros a sumarse, y
  esa es la unidad que de verdad circula en redes.

El catálogo se mantiene corto a propósito. Un catálogo grande se vuelve inventario
muerto, y hay que seguir alimentándolo para siempre.

**La gamificación celebra o calla, nunca reprocha.** No hay tarjeta de "gastaste más
que el mes pasado", ni logros negativos, ni rachas rotas anunciadas con alarde.

### 16.5 El objeto visual

Un número suelto no se comparte; lo que se comparte es un objeto que se lee en medio
segundo. El de esta app es la **grilla de días**: una celda por día, llena si el día
contó. Es la misma idea que la grilla de contribuciones de GitHub o los anillos de
Apple Watch, y cuenta la historia completa sin un solo dato privado.

**La semana empieza el lunes**, como fija ISO 8601 y como se usa en la región.
`Date.getUTCDay()` numera 0 = domingo, que es la convención estadounidense, así que
`weekdayIndex()` rota. Configuración ofrece cambiarlo a domingo
(`users.week_starts_on`, migración 0012) para quien venga de esa convención; un
usuario nuevo arranca en lunes.

**Los ejes viven solo en la app.** La grilla del dashboard lleva las iniciales de
lunes, miércoles y viernes a la izquierda —las siete no entran a 9px, y en español M
y S se repiten— y el mes arriba de la columna donde empieza. La imagen compartible no
los lleva: se mira medio segundo en una historia, donde la grilla es una textura que
dice "constancia", no un gráfico para leer. Es la misma lógica de las *sparklines* de
Tufte, que por definición no tienen marcos ni marcas de eje, y la de la literatura de
*glanceable visualization*: los ejes sirven a quien examina y estorban a quien ojea.
GitHub sí rotula la suya porque vive en un perfil que se recorre y se consulta —mismo
gráfico, otro medio, otro mobiliario.

En su lugar la imagen lleva **una sola línea**: `cada cuadrito, un día`. No es un eje,
es el **título** del gráfico, y explica lo único que nadie puede adivinar: qué
representa una celda. La duración se intuye por el ancho, y decir "los últimos 12
meses" sería falso para cualquiera que lleve menos de un año.

**Lo que se ve en la app es lo que se comparte.** Antes de compartir, el usuario ve la
tarjeta: el diálogo pide `/api/share/streak` y muestra **ese mismo archivo**, no una
reconstrucción, así que no pueden desfasarse. Por eso también la grilla del dashboard
usa los **dos tonos** de la imagen: un día cubierto por una congelada se pinta como
contado —porque contó— y el detalle queda en el tooltip. Las únicas diferencias son de
mobiliario, no de contenido: los ejes y el anillo que marca el día de hoy, que en una
imagen compartida no significa nada.

### 16.6 Técnico

- La racha, los logros y el conteo se cargan en `lib/streak-data.ts`
  (`loadStreakContext`, envuelto en `React.cache`): el layout, el dashboard y la ruta
  de la imagen comparten una sola consulta por request. La lógica pura vive en
  `lib/streak.ts` con tests en `lib/streak.test.ts`.
- Imágenes con `next/og` `ImageResponse` en `app/api/share/streak/route.tsx`, que ya
  se usa para los iconos de la PWA. Dos formatos: 1080×1920 para stories (default) y
  1200×630 para enlaces (`?format=link`).
- **Zona segura de las historias.** Instagram dibuja su propia interfaz encima de la
  imagen: autor, sticker de música y de enlace arriba; barra de respuesta y
  reacciones abajo. El mínimo publicado deja libre 14% arriba, 20% abajo y 6% a los
  lados. El formato vertical usa márgenes mayores (17% / 22% / 9%) porque un sticker
  de música o de enlace baja todavía más el encabezado. El formato de enlace no pasa
  por esa interfaz y conserva márgenes normales.
- Entrega con la Web Share API cuando existe, descarga como alternativa.
- Paleta y tipografía del sistema visual (`.interface-design/system.md`): la tarjeta
  es una pieza de marca, no un pantallazo del dashboard.
- Nada de esto necesita migración, salvo que más adelante se guarden los retos
  elegidos por el usuario; la racha y los logros se calculan desde `expenses`.

### 16.6.1 Retos

Un reto es una apuesta corta: **no gastar en una categoría durante N días**. Es la
pieza que de verdad circula en redes, porque un reto en curso **invita** ("día 12 de
30 sin delivery, ¿te sumás?") en vez de presumir un resultado cerrado.

- **Uno activo a la vez.** Varios en paralelo convierten la mecánica en inventario y
  ninguno se siente importante.
- **Lo arma el usuario**: elige una categoría o subcategoría propia y una duración de
  7, 14 o 30 días. Un catálogo fijo de nombres no sirve, porque las categorías son
  del usuario y no se parecen entre cuentas.
- **Romperlo no castiga: el contador se reinicia solo.** Un gasto de esa categoría
  no cierra el reto ni pide volver a empezar a mano; el conteo arranca de nuevo al día
  siguiente y el reto sigue en pie. No hay tarjeta de fracaso ni efecto sobre la
  racha: §16.4 manda, la gamificación celebra o calla.
- El progreso es **derivado**, igual que la racha: días desde el último gasto de esa
  categoría, o desde el inicio del reto si no hubo ninguno. Se deriva también el
  mejor intento, que es la racha limpia más larga desde que empezó. Lo único que se
  guarda es la apuesta.
- Un reto cumplido entra al catálogo de logros y se comparte como el resto, con la
  misma regla de §16.2: el nombre de la categoría **no** viaja en la imagen, porque
  puede ser Salud. La tarjeta dice "30 días sin gastar en una categoría" y el detalle
  queda dentro de la app.

**Modelo de datos** (`challenges`, migración 0011): `user_id`, `category_id` **o**
`subcategory_id` (uno de los dos), `target_days`, `started_on`, `ended_on`,
`outcome` ('active' | 'done' | 'abandoned'). No existe un estado "roto": romperlo
reinicia el contador, no termina el reto. RLS por `user_id` y la
política restrictiva "no oauth clients" como el resto de las tablas de usuario. Un
índice único parcial garantiza un solo reto activo por usuario.

### 16.7 Celebración (no invasiva)

El logro se celebra **después** de la acción del usuario, nunca encima de lo que
está haciendo. Tres reglas:

1. **Solo hitos.** El resto del progreso vive en la tarjeta de racha del dashboard,
   que no interrumpe. Un modal por cada gasto categorizado sería ruido.
2. **Una sola vez por logro.** Los logros ya celebrados se recuerdan en el navegador
   (`localStorage`), no en la base: son derivados y no justifican una tabla.
3. **Línea base silenciosa.** La primera vez no se celebra nada: se guardan los
   logros que el usuario ya tenía. Si no, alguien con 90 días de racha abriría la app
   y recibiría cuatro modales seguidos.

El modal aparece con un retardo corto para no competir con el render de la página, y
ofrece compartir o cerrar. Como los logros se calculan en el layout del grupo
`(dashboard)`, la celebración llega también al categorizar en Activity, que es donde
el usuario hace el trabajo.

**Límite conocido:** `localStorage` es por navegador, así que un mismo logro puede
volver a celebrarse en otro dispositivo. Se acepta a cambio de no crear tabla ni
migración; si molesta, se mueve a una columna de `users`.

### 16.7 Riesgos

- **Latencia del sync.** Es el riesgo central y lo cubre la regla de §16.3: ningún
  gasto importado tarde rompe una racha ya ganada.
- **Fuga por acumulación.** Un solo logro no dice nada, pero varias tarjetas seguidas
  podrían dibujar un patrón. Se mitiga manteniendo la regla de §16.2 sin excepciones,
  en particular sin nombres de comercio ni de categoría.
- **Virality menor que un "Wrapped" con nombres propios.** Es un costo aceptado y
  consciente: a cambio funciona desde la primera semana, no se rompe nunca por
  privacidad, y cada vez que alguien comparte está mostrando que la app anota sola.

## 17. Panel de administración (hito 15)

### 17.1 Para qué

Hoy operar la app significa consultar SQL a mano: cuántas sincronizaciones
fallaron, qué asuntos nuevos aparecieron, si un banco está activo. Eso no escala
más allá del autor, y bloquea tareas concretas —como mapear las plantillas de un
banco nuevo— detrás de alguien que sepa escribir consultas.

El panel es **la consola del operador**, no una vista privilegiada de los datos de
los usuarios. Esa distinción define todo lo demás.

### 17.2 La regla que manda: agregados, nunca filas

La política de privacidad declara que solo el usuario ve sus gastos, y el
aislamiento vive en la base con RLS (§7.3). Un panel que leyera gastos ajenos
rompería ambas cosas: convertiría la política en falsa y, bajo la Ley 29733, sería
tratar datos más allá de la finalidad declarada.

Por eso el panel **solo puede contar**. Las métricas se exponen como funciones
`security definer` que devuelven conteos, y no existe ninguna que devuelva filas de
`expenses`. No es disciplina del código de la página: es que la consulta peligrosa
no está escrita en ninguna parte.

Lo único con texto libre que ve el panel son los **asuntos descubiertos**
(`sync_discoveries`), porque mapear un banco exige leerlos. Van sin el `user_id`
asociado: interesa la plantilla, no de quién es el correo.

### 17.3 Autorización

- Columna `users.is_admin`, por defecto `false`, que **solo se activa a mano** desde
  Supabase. Nadie se vuelve admin desde la app.
- Las funciones de métricas **verifican el flag por dentro** y devuelven vacío si
  quien llama no es admin. La protección vive en la base, no en el guard de la
  página; el guard solo evita mostrar una pantalla inútil.
- Route group `(admin)` con su propio layout y guard, separado de `(dashboard)`.

Esconder la ruta no cuenta como control: OWASP recuerda que `/admin` es lo primero
que alguien prueba.

### 17.4 Auditoría

Toda acción del panel que cambie algo queda registrada en `admin_audit`: quién,
qué, cuándo y el valor anterior. OWASP liga la separación administrativa a la
trazabilidad, y acá es barato: son tres o cuatro acciones posibles.

### 17.5 Qué muestra (v1)

**Salud de las sincronizaciones**
- Corridas de las últimas 24 h y 7 días, por origen (`manual` / `cron`).
- Cuántas fallaron y con qué código; cuántas cuentas perdieron el acceso a Gmail.
- Correos descartados y corridas detenidas por el cortacircuitos.

**Mapeo de bancos**
- Asuntos descubiertos todavía sin mapear, con su remitente y cuántas veces
  aparecieron. Es la herramienta para cerrar TC y TD de Interbank.
- Por banco: activo sí/no y descubrimiento encendido/apagado.

**Uso agregado**
- Usuarios registrados, cuántos con Gmail conectado, cuántos activos esta semana.
- Gastos registrados en total y en la semana. Un número, nunca un monto.

### 17.6 El interruptor de descubrimiento se muda a la base

`SYNC_DISCOVERY` deja de ser variable de entorno y pasa a ser
`system_banks.discovering`. Tres razones:

1. **Por banco, no global**: quien solo usa BCP deja de gastar cuota en una búsqueda
   que no va a descubrir nada.
2. **Sin redeploy**: hoy apagarlo exige volver a desplegar.
3. **Con registro**: encenderlo queda en `admin_audit`, y una variable de entorno no
   deja rastro de quién la tocó.

### 17.7 Dónde vive, y cuándo se muda

Arranca **dentro de este proyecto**, como route group. Es lo proporcional a un
operador único y dos usuarios.

**Antes de abrir la app más allá de la familia**, se muda a su **propio proyecto de
Vercel** desde el mismo repositorio, con dominio aparte y Deployment Protection
encendida: el panel exigiría la cuenta de Vercel del operador antes de servir una
sola página. Eso materializa el "host separado" que recomienda OWASP sin duplicar
código.

La mudanza es barata **si** la lógica vive en funciones de base y componentes
propios, no desparramada en las páginas. Esa es la razón de diseñarlo así desde el
principio.

Un repositorio aparte no se justifica: con un solo desarrollador, mantener dos en
sincronía cuesta más de lo que protege.

### 17.8 Riesgos

- **El panel es superficie nueva.** Se mitiga con agregados (§17.2): comprometerlo
  expone "hay 5 usuarios", no la plata de nadie.
- **`security definer` ejecuta con permisos elevados.** Cada función fija su
  `search_path` y valida `is_admin` en su primera línea.
- **Mezclar operación y producto.** Uber Central muestra el riesgo: las excepciones
  de la herramienta interna terminan filtrándose a las reglas del producto. Acá el
  panel no escribe sobre datos de usuario — solo sobre tablas de sistema.
