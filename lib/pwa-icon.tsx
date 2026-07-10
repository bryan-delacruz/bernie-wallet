import type { ReactElement } from "react";

// Billetera (mismo glifo que el logo/favicon) para incrustar en ImageResponse.
const WALLET =
  "<path d='M22 11V9.5a1.5 1.5 0 0 0-1.5-1.5H9a2 2 0 0 0 0 4h12.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9a2 2 0 0 1-2-2V10'/><path d='M23 15.5h-3a2 2 0 0 0 0 4h3'/>";

function walletDataUri(stroke: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none' stroke='${stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${WALLET}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Icono de la app (PWA / apple-icon): billetera marfil sobre degradado esmeralda,
 *  mismo lenguaje visual que el logo y la balance card. */
export function AppIcon({
  size,
  radius = 0,
  glyphRatio = 0.62,
}: {
  size: number;
  radius?: number;
  glyphRatio?: number;
}): ReactElement {
  const glyph = Math.round(size * glyphRatio);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0e7c58 0%, #0b3f2e 100%)",
        borderRadius: radius,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img width={glyph} height={glyph} src={walletDataUri("#f6f4ef")} alt="" />
    </div>
  );
}
