import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioRegistro } from "@/components/onboarding/formulario-registro";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { PRIMER_PASO_PROTEGIDO } from "@/lib/acceso";
import { sesionActual } from "@/lib/auth";
import { PASOS_INSTITUCION, PORTADA_ONBOARDING } from "@/lib/onboarding";
import { codigoPrecargado } from "@/lib/queries/referidos";
import { googleHabilitado } from "@/lib/supabase/proveedores";

export const metadata: Metadata = { title: "Creá tu acceso · Institución" };

/**
 * Paso 1: registro (email + contraseña o Google). Pública: con sesión ya abierta salta al paso 2.
 * Crear la cuenta se ve igual que ingresar (`MarcoAcceso`); desde el paso 2 sigue el marco del alta con su barra de progreso.
 */
export default async function PasoInstitucion1() {
  if (await sesionActual()) redirect(PRIMER_PASO_PROTEGIDO.institucion);

  const portada = PORTADA_ONBOARDING.institucion;
  return (
    <MarcoAcceso titulo={portada.titulo} bajada={portada.bajada} foto={PASOS_INSTITUCION["1"].fondo}>
      {/* Si llegó con el enlace de otra institución, su código viene puesto; quien solo tiene el código lo escribe acá (vale lo mismo). */}
      <FormularioRegistro rol="institucion" conGoogle={await googleHabilitado()} referido={{ precargado: await codigoPrecargado() }} />
    </MarcoAcceso>
  );
}
