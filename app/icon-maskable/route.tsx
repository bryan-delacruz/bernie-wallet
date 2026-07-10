import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa-icon";

// Icono maskable 512 (a sangre completa; huella dentro de la zona segura).
export function GET() {
  return new ImageResponse(<AppIcon size={512} radius={0} glyphRatio={0.48} />, {
    width: 512,
    height: 512,
  });
}
