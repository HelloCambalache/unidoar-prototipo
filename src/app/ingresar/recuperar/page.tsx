import type { Metadata } from "next";
import { FormularioRecuperar } from "@/components/onboarding/formularios-clave";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";

export const metadata: Metadata = { title: "Recuperá tu contraseña" };

export default function PaginaRecuperar() {
  return (
    <MarcoAcceso volverHref="/ingresar" volverTexto="‹ Volver a ingresar">
      <FormularioRecuperar />
    </MarcoAcceso>
  );
}
