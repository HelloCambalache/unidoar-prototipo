import type { Metadata } from "next";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PasoDocumentacion } from "@/components/onboarding/paso-documentacion";
import { docenteEnAlta } from "@/lib/alta";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { ID_FORMULARIO_ONBOARDING, PASOS_DOCENTE } from "@/lib/onboarding";
import { detalleDeDocente } from "@/lib/queries/onboarding";

export const metadata: Metadata = { title: "Documentación" };

/** "Subí tu documentación": último paso. Terminar (o "Lo subo después") cierra el alta y manda al dashboard. */
export default async function PasoDocente4() {
  const { docente } = await docenteEnAlta();
  const detalle = await detalleDeDocente(docente.id);

  return (
    <MarcoOnboarding rol="docente" paso={PASOS_DOCENTE["4"]} formId={ID_FORMULARIO_ONBOARDING}>
      <PasoDocumentacion
        categoria={docente.categoria}
        estudio={detalle?.situacionEstudio === "estudiante" ? "estudiante" : "recibido"}
        documentos={detalle?.documentos ?? {}}
        almacenamientoDisponible={almacenamientoConfigurado()}
      />
    </MarcoOnboarding>
  );
}
