import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa-icon";

// Icono 192 del manifest (purpose "any").
export function GET() {
  return new ImageResponse(<AppIcon size={192} radius={42} glyphRatio={0.6} />, {
    width: 192,
    height: 192,
  });
}
