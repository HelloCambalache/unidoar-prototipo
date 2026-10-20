import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad de todo el sitio (solo en producción: en desarrollo el panel de vista previa puede enmarcar la página):
 * - `X-Frame-Options: DENY`: ningún otro sitio puede meter una página nuestra en un marco. Sin esto, una página ajena podía superponer
 *   botones y hacer que alguien toque "Retirar postulación", "Enviar mi CV" o "Pedir la baja" sin saberlo.
 * - **Ninguna `Content-Security-Policy` en esta lista**: la política de contenido (scripts con nonce, `base-uri`, `object-src`) sale de
 *   `src/proxy.ts` (ver `src/lib/csp.ts`). Una `Content-Security-Policy` fija acá llegaba también al pedido que lee Next en Vercel y tapaba
 *   al nonce (los scripts salían sin él). No volver a ponerla. `X-Frame-Options` cubre los marcos.
 * - `nosniff`: el navegador no adivina el tipo de un archivo distinto del que declaramos.
 * - `Referrer-Policy`: al salir a otro sitio solo viaja el dominio, no la dirección completa (que puede llevar ids).
 * - `Permissions-Policy`: el sitio no usa cámara, micrófono, ubicación ni pagos del navegador: ningún script (ni uno inyectado) puede pedirlos.
 *   Las fotos y los PDF se suben con el selector de archivos, que no pasa por acá.
 */
const CABECERAS_DE_SEGURIDAD = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // No hace falta contarle a nadie con qué está hecho el sitio.
  poweredByHeader: false,
  async headers() {
    return process.env.NODE_ENV === "production" ? [{ source: "/:path*", headers: CABECERAS_DE_SEGURIDAD }] : [];
  },
};

export default nextConfig;
