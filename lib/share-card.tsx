import type { ReactElement } from "react";
import type { StreakDay } from "@/lib/streak";

/**
 * Tarjeta de racha para redes (SPEC §16.5). Solo conteos, rachas y fechas: ni
 * montos, ni comercios, ni nombres de categoría.
 *
 * La grilla es el protagonista: el número solo no se comparte, el cuadro sí. Por
 * eso la composición cambia con el formato — apilada en la historia vertical, a
 * dos columnas en la imagen de enlace, que es casi el doble de ancha que alta.
 *
 * Se dibuja con el subconjunto de flexbox que entiende `ImageResponse`: la grilla
 * son columnas de 7 celdas, no CSS grid.
 */

// Paleta del sistema (.interface-design/system.md): gema esmeralda de fondo, bronce
// solo como sello de marca, marfil para el texto. Un solo acento.
const PANEL = "linear-gradient(155deg,#0d7351,#0a5540,#073c2d)";
const EMERALD_LIGHT = "#49c395";
const BRONZE = "#e2b074";
const IVORY = "#f6f4ef";

/** Dos tonos y nada más: el día contó o no contó. Un día cubierto por una
 *  congelada contó de verdad, así que se pinta igual; el bronce queda reservado
 *  para la marca, no para un tercer estado que nadie puede interpretar afuera. */
const COUNTED: Record<StreakDay["state"], boolean> = {
  clean: true,
  quiet: true,
  frozen: true,
  missed: false,
  pending: false,
};

/** Agrupa los días en columnas de 7, alineadas al día de la semana real. */
function toWeeks(days: StreakDay[]): (StreakDay | null)[][] {
  if (days.length === 0) return [];
  const offset = new Date(`${days[0].day}T00:00:00Z`).getUTCDay();
  const cells: (StreakDay | null)[] = [...Array<null>(offset).fill(null), ...days];
  const weeks: (StreakDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function Grid({ weeks, cell, gap }: { weeks: (StreakDay | null)[][]; cell: number; gap: number }) {
  return (
    <div style={{ display: "flex", gap }}>
      {weeks.map((week, w) => (
        <div key={w} style={{ display: "flex", flexDirection: "column", gap }}>
          {week.map((day, d) => (
            <div
              key={d}
              style={{
                width: cell,
                height: cell,
                borderRadius: Math.max(2, Math.round(cell * 0.18)),
                background: day
                  ? COUNTED[day.state]
                    ? EMERALD_LIGHT
                    : "rgba(246,244,239,0.1)"
                  : "transparent",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StreakShareCard({
  current,
  days,
  totalExpenses,
  width,
  height,
}: {
  current: number;
  days: StreakDay[];
  totalExpenses: number;
  width: number;
  height: number;
}): ReactElement {
  const weeks = toWeeks(days);
  const stacked = height > width;
  const unit = Math.min(width, height); // escala tipográfica: el lado corto manda

  // Zona segura de las historias de Instagram: la app dibuja su propia interfaz
  // sobre la imagen —autor y sticker de música arriba, barra de respuesta y
  // reacciones abajo— y tapa lo que quede ahí. El mínimo publicado es 14% arriba,
  // 20% abajo y 6% a los lados; acá se va por encima de ese mínimo porque un
  // sticker de enlace o de música baja todavía más el encabezado.
  const inset = stacked
    ? {
        top: Math.round(height * 0.17),
        bottom: Math.round(height * 0.22),
        side: Math.round(width * 0.09),
      }
    : {
        top: Math.round(height * 0.08),
        bottom: Math.round(height * 0.08),
        side: Math.round(width * 0.06),
      };

  // El ancho disponible para la grilla cambia con la composición; la celda se topa
  // por los dos ejes para que ni una semana ni un año se salgan de la zona segura.
  const safeWidth = width - inset.side * 2;
  const safeHeight = height - inset.top - inset.bottom;
  const gridWidth = stacked ? safeWidth : safeWidth * 0.52;
  const gridHeight = stacked ? safeHeight * 0.42 : safeHeight;
  const gap = Math.max(2, Math.round(unit * 0.005));
  const cell = Math.max(
    5,
    Math.min(
      Math.round(unit * 0.05),
      Math.floor(gridWidth / Math.max(weeks.length, 1)) - gap,
      Math.floor(gridHeight / 7) - gap,
    ),
  );

  const headline = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          fontFamily: "Fraunces",
          fontSize: Math.round(unit * 0.2),
          lineHeight: 1,
          color: IVORY,
        }}
      >
        {current}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: Math.round(unit * 0.02),
          fontSize: Math.round(unit * 0.045),
          color: "rgba(246,244,239,0.72)",
        }}
      >
        {current === 1 ? "día al día" : "días al día"}
      </div>
    </div>
  );

  const footer = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: Math.round(unit * 0.034), color: IVORY }}>
        {totalExpenses} {totalExpenses === 1 ? "gasto anotado" : "gastos anotados"}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: Math.round(unit * 0.008),
          fontSize: Math.round(unit * 0.028),
          color: "rgba(246,244,239,0.55)",
        }}
      >
        ninguno a mano
      </div>
    </div>
  );

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        paddingTop: inset.top,
        paddingBottom: inset.bottom,
        paddingLeft: inset.side,
        paddingRight: inset.side,
        background: PANEL,
        color: IVORY,
        fontFamily: "Geist",
      }}
    >
      {/* Sello de marca: wordmark en bronce sobre una hairline, igual que la
          tarjeta de saldo. Es el único uso del bronce. */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Fraunces",
            fontSize: Math.round(unit * 0.034),
            color: BRONZE,
          }}
        >
          Bernie Wallet
        </div>
        <div
          style={{
            display: "flex",
            marginTop: Math.round(unit * 0.025),
            width: "100%",
            height: 1,
            background: "rgba(226,176,116,0.45)",
          }}
        />
      </div>

      {stacked ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: Math.round(unit * 0.07),
          }}
        >
          {headline}
          <Grid weeks={weeks} cell={cell} gap={gap} />
          {footer}
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: inset.side }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              gap: Math.round(unit * 0.07),
            }}
          >
            {headline}
            {footer}
          </div>
          <Grid weeks={weeks} cell={cell} gap={gap} />
        </div>
      )}
    </div>
  );
}
