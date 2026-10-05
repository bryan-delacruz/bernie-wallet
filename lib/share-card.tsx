import type { ReactElement } from "react";
import type { StreakDay } from "@/lib/streak";

/**
 * Tarjeta de racha para redes (SPEC §16.5). Solo conteos, rachas y fechas: ni
 * montos, ni comercios, ni nombres de categoría. Se dibuja con el subconjunto de
 * flexbox que entiende `ImageResponse`, así que la grilla son columnas, no CSS grid.
 */

const EMERALD_DEEP = "#0b3f2e";
const EMERALD = "#0f5a40";
const EMERALD_LIGHT = "#5DCAA5";
const BRONZE = "#e2b074";
const IVORY = "#f6f4ef";

const CELL: Record<StreakDay["state"], string> = {
  clean: EMERALD_LIGHT,
  quiet: "rgba(93,202,165,0.3)",
  frozen: BRONZE,
  missed: "rgba(246,244,239,0.12)",
  pending: "rgba(246,244,239,0.12)",
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
  // El relleno y la tipografía salen del alto: la misma tarjeta sirve para la
  // historia vertical y para la imagen de enlace, que es mucho más baja.
  const pad = Math.round(height * 0.08);
  // La celda crece hasta llenar el ancho: con pocas semanas la grilla igual se ve,
  // y con un año entero el propio ancho la achica.
  const fit = Math.floor((width - pad * 2) / Math.max(weeks.length, 1)) - 4;
  const cell = Math.max(6, Math.min(Math.round(width / 22), fit));

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: pad,
        rowGap: Math.round(height * 0.04),
        background: `linear-gradient(135deg, ${EMERALD} 0%, ${EMERALD_DEEP} 100%)`,
        color: IVORY,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", letterSpacing: 6, fontSize: Math.round(height * 0.022), color: BRONZE }}>
        BERNIE WALLET
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: Math.round(height * 0.14), lineHeight: 1 }}>
          {current}
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: Math.round(height * 0.035), color: EMERALD_LIGHT }}>
          {current === 1 ? "día al día" : "días al día"}
        </div>

        <div style={{ display: "flex", marginTop: Math.round(height * 0.04), gap: 4 }}>
          {weeks.map((week, w) => (
            <div key={w} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {week.map((day, d) => (
                <div
                  key={d}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: 2,
                    background: day ? CELL[day.state] : "transparent",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: Math.round(height * 0.032) }}>
          {totalExpenses} {totalExpenses === 1 ? "gasto anotado" : "gastos anotados"}
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: Math.round(height * 0.024), color: EMERALD_LIGHT }}>
          se anotan solos
        </div>
      </div>
    </div>
  );
}
