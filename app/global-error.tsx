"use client";

/**
 * Último recurso: reemplaza al layout raíz, así que no tiene sus estilos ni
 * fuentes. Colores de la marca escritos a mano.
 */
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f6f4ef", color: "#14150f", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <title>Bernie Wallet</title>
        <main style={{ maxWidth: 380, padding: 24 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 28, margin: "0 0 12px" }}>Bernie no pudo cargar</h1>
          <p style={{ color: "#6b6b63", margin: "0 0 20px" }}>Tus gastos están a salvo. Vuelve a intentarlo en un momento.</p>
          <button
            onClick={() => unstable_retry()}
            style={{ font: "500 15px system-ui, sans-serif", padding: "11px 22px", borderRadius: 8, border: 0, background: "#0e7c58", color: "#fff", cursor: "pointer" }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
