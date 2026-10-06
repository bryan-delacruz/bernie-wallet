/**
 * La imagen de la racha se pide una sola vez y se usa para dos cosas: mostrarla
 * antes de compartir y compartirla. Lo que se previsualiza es el archivo real, no
 * una reconstrucción, así que no pueden desfasarse.
 *
 * No hay página pública ni link que revocar: la imagen va directo a quien la pidió
 * (SPEC §16.2).
 */

export async function fetchStreakImage(): Promise<Blob> {
  const response = await fetch("/api/share/streak");
  if (!response.ok) throw new Error("No se pudo generar la imagen");
  return response.blob();
}

/** Hoja nativa del teléfono (Instagram, WhatsApp) cuando existe; descarga cuando no. */
export async function shareBlob(blob: Blob): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], "bernie-racha.png", { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      // Cancelar la hoja nativa no es un fallo.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
