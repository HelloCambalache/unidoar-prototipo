import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioRegistro } from "@/components/onboarding/formulario-registro";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PRIMER_PASO_PROTEGIDO } from "@/lib/acceso";
import { sesionActual } from "@/lib/auth";
import { PASOS_INSTITUCION } from "@/lib/onboarding";
import { googleHabilitado } from "@/lib/supabase/proveedores";

export const metadata: Metadata = { title: "Creá tu acceso · Institución" };

/** Paso 1: registro (email + contraseña o Google). Pública: con sesión ya abierta salta al paso 2. */
export default async function PasoInstitucion1() {
  if (await sesionActual()) redirect(PRIMER_PASO_PROTEGIDO.institucion);

  return (
    <MarcoOnboarding rol="institucion" paso={PASOS_INSTITUCION["1"]}>
      <FormularioRegistro rol="institucion" conGoogle={await googleHabilitado()} />
    </MarcoOnboarding>
  );
}
