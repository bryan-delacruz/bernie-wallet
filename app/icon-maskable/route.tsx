import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa-icon";

// Se genera una vez en el build: el ícono no cambia entre peticiones.
export const dynamic = "force-static";

// Icono maskable 512 (a sangre completa; huella dentro de la zona segura).
export function GET() {
  return new ImageResponse(<AppIcon size={512} radius={0} glyphRatio={0.48} />, {
    width: 512,
    height: 512,
  });
}
