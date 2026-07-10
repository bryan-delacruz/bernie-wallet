import type { MetadataRoute } from "next";

/** Web App Manifest → permite instalar Bernie en iOS/Android (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bernie Wallet",
    short_name: "Bernie",
    description: "Tus gastos se anotan solos. Bernie lee los correos de tu banco y lleva la cuenta.",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ef",
    theme_color: "#0f5a40",
    lang: "es-PE",
    dir: "ltr",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
