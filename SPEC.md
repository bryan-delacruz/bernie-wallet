# SPEC.md — Bernie Wallet

> **Fuente de verdad (Spec-Driven Development).** Este documento manda. Ningún código puede contradecir esta spec. Si algo cambia, **primero se actualiza esta spec, luego el código**. Última actualización: 2026-06-28.

---

## 1. Objetivo

Bernie Wallet es una app web de **registro de gastos personales**. Lee correos de notificación bancaria desde Gmail, extrae los datos del gasto con la **Claude API**, y los guarda en **Supabase**. El usuario también puede registrar gastos manualmente.

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
| `@anthropic-ai/sdk` | Cliente oficial para la **Claude API** que usa el parser. |
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
- Query params del OAuth: `access_type=offline` + `prompt=consent` → para obtener `provider_refresh_token`.
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
  → Leer cursor (último last_sync_at; si no existe → hace 30 días)
  → Gmail API: query por remitente + asunto + fecha:
      from:(remitentes activos) subject:(subject_patterns) after:<cursor>
  → Listar TODOS los message_id que cumplen (paginando; listar es gratis).
  → Filtrar: quitar los ya importados (anti-duplicado) y los descartados
    (sync_failures.attempts >= MAX_ATTEMPTS).
  → Ordenar del MÁS VIEJO al MÁS NUEVO y tomar solo `SYNC_MAX_RESULTS` por
    corrida (el tope limita el parseo caro con Claude, no la cobertura).
  → Por cada correo (del más viejo al más nuevo):
      1. Detectar notification_type por sender + subject_pattern
         (si no matchea → descarte definitivo, se avanza el cursor)
      2. Pasar texto + tipo a Claude API → extraer datos del gasto
      3. payment_method_identifier → buscar o **auto-crear** medio de pago
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

## 10. Parser de extracción (Claude API)

- Modelo: **`claude-haiku-4-5`** vía `@anthropic-ai/sdk`.
- Salida forzada con **structured outputs** (`output_config.format`, json_schema) — contrato (campos en inglés):

```json
{
  "amount": number,
  "currency": string,
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

- `max_tokens` ~1024. Validar `stop_reason` antes de leer el contenido.

### 10.1 Prompts por `notification_type`

- **`credit_card_purchase` / `debit_card_purchase`**: extraer monto, moneda, comercio (campo "Empresa"), número de tarjeta (últimos 4 dígitos), fecha y hora, número de operación.
- **`yape`**: extraer monto, moneda, nombre del beneficiario, celular del beneficiario (enmascarado), celular del yapero/origen (enmascarado), número de operación, fecha y hora.
- **`service_payment`**: extraer monto, moneda, empresa, número de operación, número de documento (Doc. pago), fecha y hora. La "Cuenta de origen" puede ser **tarjeta de crédito, débito o cuenta** → clasificar en `payment_source_type` y poner sus últimos 4 dígitos en `payment_method_identifier`.
- **`transfer`**: extraer monto, moneda, nombre del beneficiario, cuenta de origen (últimos 4 dígitos si aparece), número de operación, fecha y hora. (Sin medio de pago asociado.)

---

## 11. Variables de entorno

| Variable | Ámbito | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente + servidor | Publishable key (`sb_publishable_...`) — reemplaza a la antigua anon key; segura para el cliente |
| `GOOGLE_CLIENT_ID` | servidor | Refrescar el access token de Gmail |
| `GOOGLE_CLIENT_SECRET` | servidor | Refrescar el access token de Gmail |
| `ANTHROPIC_API_KEY` | servidor | Claude API (parser) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | servidor | Clave AES-256-GCM (32 bytes base64) para cifrar el refresh token |

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
│   └── parser/parser-service.ts  ← Claude API
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
7. **Dashboard** (layout protegido + página).
8. **Activity** (lista de gastos) + registro manual de gasto.
9. **Categories**.
10. **Settings**.
11. **Gmail + Parser + Sync** (solo si eligió BCP).
