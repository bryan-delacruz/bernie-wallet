# Bernie Wallet — Interface Design System

App web que registra gastos leyendo correos bancarios (BCP) de Gmail. UI en
español; código/tokens en inglés. Stack: Next.js 16 (App Router), React 19,
Tailwind v4 + shadcn/ui (Base UI, tokens CSS light/dark), Fraunces + Geist.

## Dirección y feel

**Premium con contención** — como el estatus de quien tiene un Boyero de Berna,
no juguetón. Una sola pieza heroica (la tarjeta-joya metálica), bronce usado con
cuentagotas, espaciado generoso, bordes hairline, serif display para acento
editorial (`font-heading` = Fraunces) sobre cuerpo Geist sans.

## Paleta (hardcodeada en componentes de marca; tokens shadcn para chrome)

- Primario esmeralda: `#0E7C58` (light) / `#2FB985` (dark) — token `--primary`
- Bronce (sello: huella, hairlines, "PREMIUM"): `#A96E32` / `#C9904E`, on-card `#E2B074`
- Fondo marfil `#F6F4EF` / carbón `#0E0F0C`; card `#FFFFFF` / `#222220`
- Foreground `#17160F` / `#ECEAE0`; muted-fg `#6B675B` / `#9A968A`
- Border hairline `#E8E4DA` / `#2E2F29`
- Gasto (rojo refinado) `#B23A36` / `#E06A62`
- **Gradiente esmeralda "gema"** (tarjeta de saldo): `linear-gradient(150deg,#12946a,#0e7c58,#0a5540)`
- **Gradiente esmeralda "panel"** (fondo showcase, más profundo para que la gema resalte):
  `linear-gradient(155deg,#0d7351,#0a5540,#073c2d)`

Distribución ~60/30/10: marfil domina, esmeralda comunica (acción/estado/marca),
bronce es sello puntual. **Un solo acento.** Color = significado, nunca decoración.

## Depth y forma

- **Estrategia:** color/superficie (tints marfil↔carbón) + sombras suaves para lift.
  Bordes hairline para dividir, no para estructurar. Nada de bordes duros.
- **Radio:** token `--radius: 0.875rem` (14px). Cascada shadcn: inputs ~11px,
  botones `rounded-lg` 14px, cards `rounded-xl` ~20px / `rounded-2xl` ~25px.
  Anidado: interior < exterior (concéntrico).
- **Sombra premium (lift en móvil/flotante):** `0_24px_60px_-15px_rgba(0,0,0,0.45)`.

## Tipografía y jerarquía

- `font-heading` (Fraunces) para wordmark + títulos; Geist sans cuerpo/UI; Geist Mono
  para montos (`tabular-nums`) y kickers (`tracking-[0.16em] uppercase`).
- Jerarquía por **peso + color/opacidad**, no solo tamaño. Títulos `font-medium
  tracking-tight text-balance`; cuerpo `text-muted-foreground`, `text-pretty`.

## Espaciado

Base 4px. Densidad **airada** (premium): padding de tarjeta 32px (`p-8`),
`space-y-8` entre bloques de formulario, secciones home `py-24/py-28`.

## Patrones de componentes

- **BalanceGem** (`components/home/balance-gem.tsx`) — la firma. Tarjeta metálica
  esmeralda con sheen, glow bronce en esquina, `rounded-3xl`, saldo en mono
  `tabular-nums`. Reutilizable como ancla visual (hero, showcase de login).
- **CTA principal** — esmeralda sólido `#0e7c58`, `rounded-xl`, `h-12`, hover
  `#13946a`, `active:scale-[0.97]`, `motion-reduce` cubierto.
- **Login split-screen** (`app/(auth)/login/`):
  - Desktop `lg:grid lg:grid-cols-[55fr_45fr]`: izquierda `LoginShowcase` (panel
    esmeralda + titular + gema + 3 garantías con íconos bronce `#e2b074`),
    derecha columna de acceso sobria en marfil.
  - **Móvil**: fondo esmeralda a pantalla completa + **tarjeta flotante** `bg-card`
    con el formulario; logo y footer en blanco sobre el esmeralda. La tarjeta se
    disuelve en desktop (`lg:bg-transparent lg:shadow-none lg:p-0`).
  - Mismo componente, capas responsivas — no duplicar páginas.
- **Barra de confianza móvil** — `grid grid-cols-3`, ícono `text-primary` +
  label 11px `text-muted-foreground`, separada por hairline `border-t`.
- Foco por vista: **una** acción domina (en login, el botón full-width). La firma
  (gema) no compite con la acción — vive en panel aparte, no encima del botón.

## Marca

Logo = billetera Lucide (`Wallet`). `BernieLogo` (currentColor, adaptativo) para
poder recolorear (p.ej. blanco sobre esmeralda); `BernieLogoColor` (esmeralda fijo).
Wordmark "Bernie Wallet" en Fraunces. `PawMark` = sello de huella reutilizable.

## Reglas

- Usar tokens shadcn (`bg-card`, `text-muted-foreground`, `border-border`) para el
  chrome que debe responder a light/dark; hex de marca solo en piezas de marca
  (gema, paneles esmeralda, CTA) que son fijas por diseño.
- `motion-reduce` siempre cubierto. Validación visual la hace el usuario en su
  navegador; verificar con `pnpm lint` + `pnpm build`.
