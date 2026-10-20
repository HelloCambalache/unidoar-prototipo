import type { Metadata } from "next";
import { FormularioRecuperar } from "@/components/onboarding/formularios-clave";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";

export const metadata: Metadata = { title: "Recuperá tu contraseña" };

// Dinámica a propósito: una página generada en el build no puede llevar el nonce de la política de contenido (ver src/lib/csp.ts).
export const dynamic = "force-dynamic";

export default function PaginaRecuperar() {
  return (
    <MarcoAcceso volverHref="/ingresar" volverTexto="‹ Volver a ingresar">
      <FormularioRecuperar />
    </MarcoAcceso>
  );
}
