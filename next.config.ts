import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad de todo el sitio (solo en producción: en desarrollo el panel de vista previa puede enmarcar la página):
 * - `frame-ancestors 'none'` y `X-Frame-Options: DENY`: ningún otro sitio puede meter una página nuestra en un marco. Sin esto, una
 *   página ajena podía superponer botones y hacer que alguien toque "Retirar postulación", "Enviar mi CV" o "Pedir la baja" sin saberlo.
 * - `nosniff`: el navegador no adivina el tipo de un archivo distinto del que declaramos.
 * - `Referrer-Policy`: al salir a otro sitio solo viaja el dominio, no la dirección completa (que puede llevar ids).
 */
const CABECERAS_DE_SEGURIDAD = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return process.env.NODE_ENV === "production" ? [{ source: "/:path*", headers: CABECERAS_DE_SEGURIDAD }] : [];
  },
};

export default nextConfig;
