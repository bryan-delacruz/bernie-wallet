import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa-icon";

// Se genera una vez en el build: el ícono no cambia entre peticiones.
export const dynamic = "force-static";

// Icono 192 del manifest (purpose "any").
export function GET() {
  return new ImageResponse(<AppIcon size={192} radius={42} glyphRatio={0.6} />, {
    width: 192,
    height: 192,
  });
}
