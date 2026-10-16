import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioRegistro } from "@/components/onboarding/formulario-registro";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { PRIMER_PASO_PROTEGIDO } from "@/lib/acceso";
import { sesionActual } from "@/lib/auth";
import { PASOS_DOCENTE, PORTADA_ONBOARDING } from "@/lib/onboarding";
import { googleHabilitado } from "@/lib/supabase/proveedores";

export const metadata: Metadata = { title: "Creá tu cuenta · Profesional" };

/**
 * Paso 1: registro (email + contraseña o Google). Pública: con sesión ya abierta salta a "¿Qué sos?".
 * Crear la cuenta se ve igual que ingresar (`MarcoAcceso`); desde el paso 2 sigue el marco del alta con su barra de progreso.
 */
export default async function PasoDocente1() {
  if (await sesionActual()) redirect(PRIMER_PASO_PROTEGIDO.docente);

  const portada = PORTADA_ONBOARDING.docente;
  return (
    <MarcoAcceso titulo={portada.titulo} bajada={portada.bajada} foto={PASOS_DOCENTE["1"].fondo}>
      <FormularioRegistro rol="docente" conGoogle={await googleHabilitado()} />
    </MarcoAcceso>
  );
}
