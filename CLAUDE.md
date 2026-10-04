# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> Este documento está en español, igual que `SPEC.md`. Los términos técnicos, nombres
> de archivos, comandos y identificadores se mantienen en inglés, tal cual aparecen en
> el código.

## Desarrollo guiado por la spec (SDD)

`SPEC.md` es la **fuente de verdad** y manda sobre el código. Ningún cambio puede
contradecirla: si el comportamiento debe cambiar, **primero se actualiza `SPEC.md`,
luego el código**. Ahí viven el stack cerrado, el modelo de datos, el algoritmo de
sync, el contrato del parser, las variables de entorno y la hoja de ruta incremental
(§13). Lee la sección correspondiente antes de tocar una funcionalidad.

El desarrollo es **incremental, una pieza a la vez**, y el diseño/alcance de **cada
página nueva se confirma con el usuario antes de construirla**. Ante cualquier duda,
preguntar en vez de asumir.

## Comandos (pnpm — no usar npm ni yarn)

```bash
pnpm dev                 # servidor de desarrollo (puerto 3000)
pnpm build               # build de producción
pnpm lint                # eslint (flat config)
pnpm exec tsc --noEmit   # typecheck — lo corre CI; no existe script `typecheck`
pnpm test                # tests del parser con node:test (no hay framework de tests)
pnpm test:db             # migraciones + RLS + apps conectadas sobre PGlite (Postgres en memoria)
pnpm db:new <nombre>     # nuevo archivo de migración de Supabase
pnpm db:status           # migraciones locales vs. aplicadas en el proyecto enlazado
pnpm db:push             # aplica las migraciones pendientes al proyecto enlazado
```

Un solo test: `pnpm exec node --test --test-name-pattern "<regex>" lib/parser/parser-service.test.ts`

CI (`.github/workflows/ci.yml`) corre lint → tsc → test → test:db en cada PR y push a `main`.

**Aviso sobre la base de datos:** durante el MVP hay un único proyecto Supabase
compartido entre local y producción (§11.1). Esa base *es* producción — nunca correr
scripts de reseteo ni truncados.

## Convenciones de idioma

Código, nombres de archivos, carpetas y schema de la DB en **inglés**. El texto visible
de la UI, la prosa de documentación y los literales externos (remitentes del banco,
`subject_pattern`, nombres de categorías) se quedan en **español**. Comentarios: en
español, cortos y solo donde el código no es obvio — los comentarios existentes
explican *por qué*; seguir ese estilo.

Los commits siguen **Conventional Commits**.

## Next.js 16 — patrones prohibidos y obligatorios

Leer `node_modules/next/dist/docs/` antes de escribir código de framework. Este no es
el Next.js del entrenamiento. Diferencias clave (lista completa en SPEC §5–6):

- El interceptor de requests en la raíz es **`proxy.ts`**, no `middleware.ts` (`export function proxy(request)` + `config.matcher`).
- `cookies()` / `headers()` se awaitan; `params` en route handlers es una Promise.
- El caching es **opt-in** con `"use cache"` (requiere `cacheComponents: true`); nunca cachear datos de usuario.
- Nada de Pages Router, `getServerSideProps`, `next/router`, `next/head`, class components.
- Ninguna dependencia fuera de SPEC §4. Gmail usa `fetch` nativo; el cifrado usa `node:crypto` — la ausencia de `googleapis` es deliberada.
- El `import()` dinámico de código cliente pesado debe vivir en un componente **cliente** (ver `components/dashboard/lazy-charts.tsx`), si no Next no divide el chunk.

## Arquitectura

**El pipeline de sync es el corazón de la app.** `POST /api/sync`
(`app/api/sync/route.ts`, `runtime = "nodejs"`) corre todo el flujo en un solo request:

1. Lee el cursor (`sync_logs.last_sync_at`; primera corrida = últimos `SYNC_INITIAL_DAYS`, default 30).
2. Arma la query de Gmail con los bancos del usuario → filas de `system_senders` (`from:` + `subject:` + `after:`), lista **todos** los ids que coinciden (listar es gratis) y filtra los `message_id` ya importados y los descartados (`sync_failures`).
3. Procesa **del más viejo al más nuevo**, como máximo `SYNC_MAX_RESULTS` por corrida, avanzando el cursor por correo: una corrida truncada continúa sin dejar huecos.
4. Por correo: sender+subject → `notification_type` → `extractExpense()` → buscar o crear `payment_methods` según `payment_source_type` + identificador → autocategorizar con la memoria por comercio (subcategoría más frecuente en los últimos ~2000 gastos categorizados, sin IA) → insertar en `expenses`.

El manejo de fallos es deliberado y hay que preservarlo: los pasos que lanzan se
reintentan con backoff exponencial (`MAX_RETRIES`), los correos agotados se mandan al
dead-letter `sync_failures` y se omiten, una racha de `CIRCUIT_LIMIT` fallos **detiene
la corrida sin confirmar los descartes** (se asume que Gmail está caído; no se pierde
nada), y un `null` del parser o un duplicado 23505 es descarte definitivo sin reintento.

**El parser es programático, nunca IA.** `lib/parser/parser-service.ts` expone la
función pura `extractExpense(text, notificationType) → ParsedExpense | null`: regex
sobre el texto normalizado del correo, una rama por `notification_type` (SPEC §10.1).
Es gratis, determinística y sin red. Devolver `null` es la red de seguridad ante un
cambio de plantilla del banco — mejor omitir un correo que guardar un gasto degradado.
Cada rama tiene fixtures en `parser-service.test.ts`; todo cambio del parser agrega su
fixture.

**El modelo de seguridad vive en la base de datos.** Cada tabla de usuario lleva
`user_id` y una política RLS (`user_id = auth.uid()`), así que el aislamiento no depende
del código de la app — `supabase/migrations/*.sql` es la fuente de verdad del esquema.
Los refresh tokens de Google se cifran con AES-256-GCM (`lib/crypto.ts`) en
`google_tokens`. El acceso a Gmail es de solo lectura y limitado a remitentes conocidos.
El índice único parcial sobre `(user_id, message_id)` es la garantía anti-duplicados.

**Auth.** Google vía Supabase Auth; el mismo grant de OAuth se reutiliza para Gmail
(`gmail.readonly`). `access_type=offline` siempre, `prompt=consent` **solo** en
`/login?reconnect=1` — forzarlo en cada login repinta la pantalla de consentimiento y
la de "app no verificada". Google entrega refresh token solo en la primera autorización
o con consentimiento forzado, así que el callback sobrescribe `google_tokens` únicamente
si llega uno nuevo. Un usuario autenticado sin fila en `users` se manda a
`/api/auth/signout`; los perfiles se crean solo en el callback de login (`lib/seed.ts`
siembra las categorías por defecto).

**Clientes de Supabase.** `lib/supabase/server.ts` para Server Components, route
handlers y Server Actions, con `getCurrentUser()` deduplicado por request vía
`React.cache`; `lib/supabase/client.ts` para el navegador; `proxy.ts` refresca la sesión
— mantener ahí `getUser()` inmediatamente después de `createServerClient`, sin lógica en
medio.

**Las consultas de agregación deben paginar.** La API de Supabase corta en `max_rows`
(1000) en silencio, así que los totales salen mal sin ningún error. Usar `fetchAllRows()`
de `lib/supabase/paginate.ts`, que recibe una *fábrica* de consultas (una por página).

**Modo demo.** `app/demo/page.tsx` crea un usuario **anónimo** de Supabase en el
navegador y luego `POST /api/demo` siembra tres meses de gastos ficticios
(`lib/demo.ts`) con la sesión del propio visitante, así RLS aplica igual que con una
cuenta real. Las filas se borran a las 24 h con un job de pg_cron (migraciones
0007/0008). La UI exclusiva de demo se condiciona con `isDemoUser()`.

**Rutas.** `(dashboard)` es un route group protegido (`/dashboard`, `/activity`,
`/categories`, `/settings`) cuyo `layout.tsx` es el guard de auth; las mutaciones son
Server Actions en el `actions.ts` de cada segmento + `revalidatePath`. `/`, `/privacy`,
`/terms` y `/demo` son públicas — las páginas legales deben seguir siendo alcanzables
sin login y sin JS de cliente, porque la revisión de OAuth de Google las exige
(SPEC §14).

## UI

Tailwind v4 + shadcn/ui (primitivas de Base UI), Recharts para gráficos, Sonner para
toasts, `next-themes` para light/dark. El sistema visual — paleta esmeralda premium +
bronce bernés, la tarjeta de saldo metálica como elemento firma, profundidad, escala
tipográfica y patrones de componentes — está documentado en
`.interface-design/system.md`; leerlo antes de agregar o reestilizar UI. Responsive
desde 320px: en móvil los filtros se colapsan en un bottom-sheet
(`components/ui/sheet.tsx`) y en desktop van inline; filtro por defecto = mes actual.
PWA instalable con `app/manifest.ts` e iconos generados con `next/og`, sin service
worker.

Las métricas del dashboard son deliberadamente "honestas" sobre el mes en curso
(SPEC §13, 12.1): el mes a la fecha se compara contra los **mismos días** del mes
anterior, la proyección se pinta como estimación translúcida apilada, y el mes en curso
se marca con sufijo `·` en el eje de la tendencia.
