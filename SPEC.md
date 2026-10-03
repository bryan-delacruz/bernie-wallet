# SPEC.md — Bernie Wallet

> **Fuente de verdad (Spec-Driven Development).** Este documento manda. Ningún código puede contradecir esta spec. Si algo cambia, **primero se actualiza esta spec, luego el código**. Última actualización: 2026-10-03.

---

## 1. Objetivo

Bernie Wallet es una app web de **registro de gastos personales**. Lee correos de notificación bancaria desde Gmail, extrae los datos del gasto con un **parser programático (regex, sin IA)**, y los guarda en **Supabase**. El usuario también puede registrar gastos manualmente.

## 2. Alcance actual (v0)

- **Solo gastos (expenses)**: ver y registrar gastos. (Medios de pago avanzados, plan "pro", reportes, etc. quedan para más adelante.)
- **Registro manual SIEMPRE disponible**: cualquier usuario puede registrar gastos a mano. No es un "modo" que se elige.
- **Solo banco BCP** como origen de correos. (Interbank y otros: futuro.)
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
- `integration_connections` — `(user_id, client_id)` PK, `shares_version` int
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
   **qué compartirá** (campos de 15.2), **selector de categorías** (preselecciona
   "Matrimonio" si existe; al menos una obligatoria), aviso "lo verán todos los
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
revoca el permiso de ese `client_id` para ese usuario (`revokeGrant`; si el SDK
no lo permite con un token OAuth, se hace con la Admin API del lado del servidor),
borra sus `integration_shares` y registra `revoked` en la auditoría. Responde `204`.
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

Por cada app (`getUserGrants()`): fecha de conexión, categorías compartidas
(editables → evento `shares_changed`), historial de `integration_audit`, y
**Desconectar** → `revokeGrant()` + borra shares + webhook `grant.revoked`.

### 15.9 Configuración manual (la hace el usuario)

1. Supabase → Authentication → OAuth Server: activar, authorization path
   `/oauth/consent`. Verificar Site URL = dominio de producción.
2. OAuth Apps → cliente **Casorio Club**, confidencial, redirect URIs exactas:
   `https://casorio-club.vercel.app/api/bernie/callback` y
   `http://localhost:3000/api/bernie/callback`. Secret → Vercel de Casorio.
3. Fila en `integration_clients` con el `client_id`, la URL de webhook de Casorio y
   su secreto (se genera con un script, nunca a mano en SQL).
4. Migración a llaves JWT asimétricas (15.3.4).
5. Variables de Bernie: `INTEGRATION_SECRET_KEY` (cifrado de secretos de webhook) e
   `INTERNAL_CRON_SECRET`.

> ⚠️ Base compartida (§11.1): la migración 0009 y la migración de llaves se aplican
> a producción solo con aprobación explícita.

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
- **Una sola base compartida** (§11.1): antes de producción real, separar dev/prod.
