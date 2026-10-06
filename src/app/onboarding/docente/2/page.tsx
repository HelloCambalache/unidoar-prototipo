import type { Metadata } from "next";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PasoCv } from "@/components/onboarding/paso-cv";
import { docenteEnAlta } from "@/lib/alta";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { ID_FORMULARIO_ONBOARDING, PASOS_DOCENTE } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Tu CV" };

/** "Tu CV": subida opcional de un PDF al bucket privado (sin lectura automática del archivo). */
export default async function PasoDocente2() {
  const { docente } = await docenteEnAlta();

  return (
    <MarcoOnboarding rol="docente" paso={PASOS_DOCENTE["2"]} formId={ID_FORMULARIO_ONBOARDING}>
      <PasoCv cvInicial={docente.cvUrl} almacenamientoDisponible={almacenamientoConfigurado()} />
    </MarcoOnboarding>
  );
}
