import type { Metadata } from "next";
import { FormularioPerfilInstitucion } from "@/components/onboarding/formulario-perfil-institucion";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { institucionEnAlta } from "@/lib/alta";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { ID_FORMULARIO_ONBOARDING, PASOS_INSTITUCION } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Completá tu perfil" };

/** Paso 3: descripción, logo y portada (todo opcional). Exige la institución creada en el paso 2. */
export default async function PasoInstitucion3() {
  const { institucion } = await institucionEnAlta();

  return (
    <MarcoOnboarding rol="institucion" paso={PASOS_INSTITUCION["3"]} formId={ID_FORMULARIO_ONBOARDING}>
      <FormularioPerfilInstitucion
        inicial={{
          descripcion: institucion.descripcion ?? undefined,
          logoUrl: institucion.logoUrl ?? undefined,
          portadaUrl: institucion.portadaUrl ?? undefined,
        }}
        almacenamientoDisponible={almacenamientoConfigurado()}
      />
    </MarcoOnboarding>
  );
}
