import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioInstitucion } from "@/components/onboarding/formulario-institucion";
import { UnirseAlEquipo } from "@/components/onboarding/unirse-al-equipo";
import { MarcoOnboarding } from "@/components/onboarding/marco-onboarding";
import { institucionPropia, usuarioParaAlta } from "@/lib/alta";
import { infoDeRol } from "@/lib/equipo";
import { RUTA_INICIO } from "@/lib/catalogo";
import { ID_FORMULARIO_ONBOARDING, PASOS_INSTITUCION } from "@/lib/onboarding";
import { institucionDeMiembro, invitacionDeEmail } from "@/lib/queries/equipo";
import { opcionesDeUbicacion } from "@/lib/queries/onboarding";

export const metadata: Metadata = { title: "Tu institución" };

/**
 * Paso 2: datos de la institución. Es el primer paso con sesión: acá se crea la fila `usuarios`
 * con rol "institucion". Si la institución ya existe, se precarga y guardar la actualiza.
 */
export default async function PasoInstitucion2() {
  const usuario = await usuarioParaAlta("institucion");
  const institucion = await institucionPropia(usuario.id);
  // Con la institución verificada el equipo ya revisó estos datos: no se vuelven a editar desde el alta (`crearInstitucion` también lo corta).
  if (institucion?.verificada) redirect(RUTA_INICIO.institucion);
  if (!institucion) {
    // Quien ya es miembro de un equipo no crea una institución propia.
    if (await institucionDeMiembro(usuario)) redirect(RUTA_INICIO.institucion);
    // Quien tiene una invitación vigente elige: la acepta (y entra al equipo) o la rechaza (y sigue con su propia institución). Nunca
    // se la suma sola: un email que alguien invitó no puede quedar dentro de un equipo sin que la persona lo sepa.
    const invitacion = await invitacionDeEmail(usuario.email);
    if (invitacion) {
      return (
        <MarcoOnboarding rol="institucion" paso={PASOS_INSTITUCION["2"]}>
          <UnirseAlEquipo institucion={invitacion.institucion} rol={infoDeRol(invitacion.rol).label} pedirTerminos={!usuario.terminosAceptadosEn} />
        </MarcoOnboarding>
      );
    }
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
      <FormularioInstitucion
        inicial={inicial}
        yaCreada={Boolean(institucion)}
        pedirTerminos={!usuario.terminosAceptadosEn}
        partidos={partidos}
        provincias={provincias}
      />
    </MarcoOnboarding>
  );
}
