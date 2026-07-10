import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa-icon";

// Icono 512 del manifest (purpose "any").
export function GET() {
  return new ImageResponse(<AppIcon size={512} radius={112} glyphRatio={0.6} />, {
    width: 512,
    height: 512,
  });
}
