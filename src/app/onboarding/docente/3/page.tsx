import type { Metadata } from "next";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { PasoDatosDocente } from "@/components/onboarding/paso-datos-docente";
import { docenteEnAlta } from "@/lib/alta";
import { ID_FORMULARIO_ONBOARDING, PASOS_DOCENTE } from "@/lib/onboarding";
import { detalleDeDocente, opcionesDeUbicacion, zonasConocidas } from "@/lib/queries/onboarding";

export const metadata: Metadata = { title: "Tu perfil" };

/** "Tu perfil": datos personales (los privados van en `docente_detalle`) y zonas con sugerencias de la tabla `zonas`. */
export default async function PasoDocente3() {
  const { docente } = await docenteEnAlta();
  const [detalle, zonas, { partidos, provincias }] = await Promise.all([
    detalleDeDocente(docente.id),
    zonasConocidas(),
    opcionesDeUbicacion(),
  ]);

  return (
    <MarcoOnboarding rol="docente" paso={PASOS_DOCENTE["3"]} formId={ID_FORMULARIO_ONBOARDING}>
      <PasoDatosDocente
        inicial={{
          nombre: docente.nombre,
          apellido: docente.apellido,
          fechaNacimiento: detalle?.fechaNacimiento ?? undefined,
          dni: detalle?.dni ?? undefined,
          telefono: docente.telefono ?? undefined,
          cuil: detalle?.cuil ?? undefined,
          direccion: detalle?.direccion ?? undefined,
          partido: detalle?.partido ?? undefined,
          provincia: detalle?.provincia ?? undefined,
        }}
        zonasIniciales={docente.zonas}
        zonasSugeridas={zonas.map((z) => z.nombre)}
        partidos={partidos}
        provincias={provincias}
      />
    </MarcoOnboarding>
  );
}
