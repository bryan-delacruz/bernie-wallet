/**
 * Entrega la imagen de un logro al usuario: hoja nativa del teléfono (Instagram,
 * WhatsApp) cuando existe, descarga cuando no. No hay página pública ni link que
 * revocar: la imagen va directo a quien la pidió (SPEC §16.2).
 */
export async function shareStreakImage(): Promise<"shared" | "downloaded" | "cancelled"> {
  const response = await fetch("/api/share/streak");
  if (!response.ok) throw new Error("No se pudo generar la imagen");
  const blob = await response.blob();
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
