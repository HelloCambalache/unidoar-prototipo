import type { Metadata } from "next";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { VitrinaFormulario, type DatosFormularioVitrina } from "@/components/institucion/vitrina-formulario";
import { BotonLink } from "@/components/ui/button";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { requerirInstitucion } from "@/lib/auth";
import { esRolGestor } from "@/lib/equipo";
import { rolEnInstitucion } from "@/lib/queries/equipo";
import { datosVitrina } from "@/lib/queries/vitrina";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function Vitrina() {
  const { usuario, institucion: i } = await requerirInstitucion();

  // Editar la vitrina es de quien administra la cuenta; el resto del equipo la ve como la ven los docentes.
  if (!esRolGestor(await rolEnInstitucion(i, usuario.id))) {
    return (
      <EstadoVacio
        titulo="Solo el dueño y los administradores editan el perfil público"
        texto="Pedile a alguien con ese rol que actualice la vitrina. Mientras tanto podés ver cómo la ven los docentes."
        accion={
          <BotonLink href={`/instituciones/${i.slug}`} target="_blank" rel="noopener noreferrer" variante="secundario">
            Ver perfil público
          </BotonLink>
        }
      />
    );
  }

  const datos = await datosVitrina(i.id);
  const inicial: DatosFormularioVitrina = {
    portadaUrl: i.portadaUrl ?? "",
    logoUrl: i.logoUrl ?? "",
    nombre: i.nombre,
    tipo: i.tipo,
    zona: i.zona ?? "",
    fundada: i.fundada?.toString() ?? "",
    alumnos: i.alumnos?.toString() ?? "",
    niveles: i.niveles ?? "",
    turnos: i.turnos ?? "",
    docentesPlanta: i.docentesPlanta?.toString() ?? "",
    descripcion: i.descripcion ?? "",
    contactoNombre: i.contactoNombre ?? "",
    contactoRol: i.contactoRol ?? "",
    mision: i.mision ?? "",
    vision: i.vision ?? "",
    valores: i.valores,
    direccion: i.direccion ?? "",
    horarioAdministracion: i.horarioAdministracion ?? "",
  };

  return (
    <VitrinaFormulario
      slug={i.slug}
      verificada={i.verificada}
      inicial={inicial}
      fotos={datos.fotos}
      novedades={datos.novedades}
      cursos={datos.cursos}
      busquedasAbiertas={datos.busquedasAbiertas}
      almacenamientoDisponible={almacenamientoConfigurado()}
    />
  );
}
