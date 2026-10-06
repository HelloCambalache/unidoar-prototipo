import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioInstitucion } from "@/components/onboarding/formulario-institucion";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { institucionPropia, usuarioParaAlta } from "@/lib/alta";
import { RUTA_INICIO } from "@/lib/catalogo";
import { ID_FORMULARIO_ONBOARDING, PASOS_INSTITUCION } from "@/lib/onboarding";
import { institucionComoMiembro } from "@/lib/queries/equipo";
import { opcionesDeUbicacion } from "@/lib/queries/onboarding";
import { datosDeSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Tu institución" };

/**
 * Paso 2: datos de la institución. Es el primer paso con sesión: acá se crea la fila `usuarios`
 * con rol "institucion". Si la institución ya existe, se precarga y guardar la actualiza.
 */
export default async function PasoInstitucion2() {
  const usuario = await usuarioParaAlta("institucion");
  const institucion = await institucionPropia(usuario.id);
  // Quien llega invitado al equipo de otra institución (o ya es miembro) no crea una propia: entra directo.
  if (!institucion && (await institucionComoMiembro(usuario, (await datosDeSesion())?.nombre))) {
    redirect(RUTA_INICIO.institucion);
  }
  const { partidos, provincias } = await opcionesDeUbicacion();

  const inicial = {
    nombre: institucion?.nombre,
    tipo: institucion?.tipo,
    fundada: institucion?.fundada?.toString(),
    contactoNombre: institucion?.contactoNombre ?? undefined,
    contactoRol: institucion?.contactoRol ?? undefined,
    telefono: institucion?.telefono ?? undefined,
    cuit: institucion?.cuit ?? undefined,
    cue: institucion?.cue ?? undefined,
    direccion: institucion?.direccion ?? undefined,
    partido: institucion?.partido ?? undefined,
    provincia: institucion?.provincia ?? undefined,
  };

  return (
    <MarcoOnboarding rol="institucion" paso={PASOS_INSTITUCION["2"]} formId={ID_FORMULARIO_ONBOARDING}>
      <FormularioInstitucion inicial={inicial} yaCreada={Boolean(institucion)} partidos={partidos} provincias={provincias} />
    </MarcoOnboarding>
  );
}
