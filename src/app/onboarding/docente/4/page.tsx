import type { Metadata } from "next";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PasoDocumentacion } from "@/components/onboarding/paso-documentacion";
import { docenteParaDocumentacion } from "@/lib/alta";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { categoriasDe } from "@/lib/categorias-docente";
import { ID_FORMULARIO_ONBOARDING, PASOS_DOCENTE } from "@/lib/onboarding";
import { detalleDeDocente } from "@/lib/queries/onboarding";

export const metadata: Metadata = { title: "Documentación" };

/**
 * "Subí tu documentación": último paso, opcional. El alta ya se cerró al terminar "Niveles y horarios" (si no faltaba nada): terminar acá
 * manda al dashboard, con o sin documentación subida.
 */
export default async function PasoDocente4() {
  const { docente } = await docenteParaDocumentacion();
  const detalle = await detalleDeDocente(docente.id);

  return (
    <MarcoOnboarding rol="docente" paso={PASOS_DOCENTE["4"]} formId={ID_FORMULARIO_ONBOARDING}>
      <PasoDocumentacion
        altaCompleta={docente.onboardingCompleto}
        categorias={categoriasDe(docente)}
        estudio={detalle?.situacionEstudio === "estudiante" ? "estudiante" : "recibido"}
        documentos={detalle?.documentos ?? {}}
        almacenamientoDisponible={almacenamientoConfigurado()}
      />
    </MarcoOnboarding>
  );
}
