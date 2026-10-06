import type { Metadata } from "next";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PasoNivelesHorarios } from "@/components/onboarding/paso-niveles-horarios";
import { docenteEnAlta } from "@/lib/alta";
import { ID_FORMULARIO_ONBOARDING, PASOS_DOCENTE, grillaDesdeJson, separarNiveles } from "@/lib/onboarding";
import { detalleDeDocente } from "@/lib/queries/onboarding";

export const metadata: Metadata = { title: "Niveles y horarios" };

/**
 * "¿A quiénes y cuándo?": niveles y disponibilidad semanal. La ruta conserva el nombre del prototipo;
 * las asignaturas en sí se eligen en "¿Qué sos?".
 */
export default async function PasoDocenteNivelesHorarios() {
  const { docente } = await docenteEnAlta();
  const detalle = await detalleDeDocente(docente.id);
  const { estandar, otros, marcaOtro } = separarNiveles(docente.niveles);

  return (
    <MarcoOnboarding rol="docente" paso={PASOS_DOCENTE.asignaturas} formId={ID_FORMULARIO_ONBOARDING}>
      <PasoNivelesHorarios
        inicial={{
          niveles: estandar,
          incluyeOtro: marcaOtro,
          otros,
          grilla: grillaDesdeJson(detalle?.grillaDisponibilidad),
        }}
      />
    </MarcoOnboarding>
  );
}
