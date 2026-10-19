import type { Metadata } from "next";
import { AlertaError } from "@/components/onboarding/elementos";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PasoDatosDocente } from "@/components/onboarding/paso-datos-docente";
import { docenteEnAlta } from "@/lib/alta";
import { ID_FORMULARIO_ONBOARDING, limitesDeNacimiento, PASOS_DOCENTE } from "@/lib/onboarding";
import { detalleDeDocente, opcionesDeUbicacion, zonasConocidas } from "@/lib/queries/onboarding";

export const metadata: Metadata = { title: "Tu perfil" };

/** "Tu perfil": datos personales (los privados van en `docente_detalle`) y zonas con sugerencias de la tabla `zonas`. */
export default async function PasoDocente3({ searchParams }: { searchParams: Promise<{ falta?: string }> }) {
  const { docente } = await docenteEnAlta();
  // Se llega con ?falta=dni cuando se intentó terminar el alta sin DNI (`guardarDocumentacionDocente`).
  const { falta } = await searchParams;
  const [detalle, zonas, { partidos, provincias }] = await Promise.all([
    detalleDeDocente(docente.id),
    zonasConocidas(),
    opcionesDeUbicacion(),
  ]);

  return (
    <MarcoOnboarding rol="docente" paso={PASOS_DOCENTE["3"]} formId={ID_FORMULARIO_ONBOARDING}>
      {falta === "dni" && (
        <AlertaError className="mb-4">Para terminar el alta falta tu DNI: lo necesitamos para verificarte. Cargalo y seguí.</AlertaError>
      )}
      <PasoDatosDocente
        inicial={{
          fechaNacimiento: detalle?.fechaNacimiento ?? undefined,
          dni: detalle?.dni ?? undefined,
          telefono: docente.telefono ?? undefined,
          cuil: detalle?.cuil ?? undefined,
          direccion: detalle?.direccion ?? undefined,
          partido: detalle?.partido ?? undefined,
          provincia: detalle?.provincia ?? undefined,
        }}
        limitesNacimiento={limitesDeNacimiento()}
        zonasIniciales={docente.zonas}
        zonasSugeridas={zonas.map((z) => z.nombre)}
        partidos={partidos}
        provincias={provincias}
      />
    </MarcoOnboarding>
  );
}
