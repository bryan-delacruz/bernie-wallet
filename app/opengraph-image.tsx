import { ImageResponse } from "next/og";

// Imagen que representa la marca al compartir el link (WhatsApp, redes, etc.).
export const alt = "Bernie Wallet — Tus gastos se anotan solos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          color: "#f6f4ef",
          fontFamily: "sans-serif",
          background: "linear-gradient(150deg, #12946a 0%, #0e7c58 46%, #0a4a36 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 600 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              display: "flex",
              background: "#c9904e",
            }}
          />
          Bernie Wallet
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 82, fontWeight: 600, lineHeight: 1.02, letterSpacing: -2, maxWidth: 900 }}>
            Tus gastos se anotan solos.
          </div>
          <div style={{ fontSize: 30, color: "rgba(246,244,239,0.82)", maxWidth: 820 }}>
            Bernie lee los correos de tu banco y registra cada gasto por ti.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "rgba(246,244,239,0.7)", fontFamily: "monospace" }}>
          S/ · solo lectura de tu Gmail · cifrado
        </div>
      </div>
    ),
    size,
  );
}
