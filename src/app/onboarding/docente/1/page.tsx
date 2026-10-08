import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioRegistro } from "@/components/onboarding/formulario-registro";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PRIMER_PASO_PROTEGIDO } from "@/lib/acceso";
import { sesionActual } from "@/lib/auth";
import { PASOS_DOCENTE } from "@/lib/onboarding";
import { googleHabilitado } from "@/lib/supabase/proveedores";

export const metadata: Metadata = { title: "Creá tu cuenta · Docente" };

/** Paso 1: registro (email + contraseña o Google). Pública: con sesión ya abierta salta a "¿Qué sos?". */
export default async function PasoDocente1() {
  if (await sesionActual()) redirect(PRIMER_PASO_PROTEGIDO.docente);

  return (
    <MarcoOnboarding rol="docente" paso={PASOS_DOCENTE["1"]}>
      <FormularioRegistro rol="docente" conGoogle={await googleHabilitado()} />
    </MarcoOnboarding>
  );
}
