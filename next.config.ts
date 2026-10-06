import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad. No hay CSP completa todavía: Next inyecta scripts en
 * línea y una CSP estricta pide nonces por request, que es su propia tanda. Lo que
 * sí entra acá es lo que no puede romper nada y cubre los ataques baratos.
 */
const SECURITY_HEADERS = [
  // Clickjacking: nadie puede meter la app en un iframe. `frame-ancestors` es la
  // forma moderna; X-Frame-Options queda para navegadores viejos.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // Que el navegador no adivine tipos: un archivo subido no se ejecuta como script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Las URLs llevan ids de categorías y filtros: no se mandan a terceros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app no usa cámara, micrófono ni ubicación. Si algún día las usa, se abre acá.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Un año de HTTPS obligatorio, incluidos subdominios.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
