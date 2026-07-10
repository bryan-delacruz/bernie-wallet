import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon (iOS redondea el cuadrado). */
export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={180} radius={0} glyphRatio={0.6} />, { ...size });
}
