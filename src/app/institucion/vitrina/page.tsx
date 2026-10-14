import type { Metadata } from "next";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { SedesFormulario } from "@/components/institucion/sedes-formulario";
import { VitrinaFormulario } from "@/components/institucion/vitrina-formulario";
import { BotonLink } from "@/components/ui/button";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { requerirInstitucion } from "@/lib/auth";
import { esRolGestor } from "@/lib/equipo";
import { rolEnInstitucion } from "@/lib/queries/equipo";
import { sedesParaEditar } from "@/lib/queries/sedes";
import { datosVitrina } from "@/lib/queries/vitrina";
import { huellaDeSedes } from "@/lib/sedes";
import { datosInicialesDeVitrina, huellaDeVitrina } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function Vitrina() {
  const { usuario, institucion: i } = await requerirInstitucion();

  // Editar la vitrina es de quien administra la cuenta; el resto del equipo la ve como la ven los docentes.
  if (!esRolGestor(await rolEnInstitucion(i, usuario.id))) {
    return (
      <EstadoVacio
        titulo="Solo el dueño y los administradores editan el perfil público"
        texto="Pedile a alguien con ese rol que actualice la vitrina. Mientras tanto podés ver cómo la ven los profesionales."
        accion={
          <BotonLink href={`/instituciones/${i.slug}`} target="_blank" rel="noopener noreferrer" variante="secundario">
            Ver perfil público
          </BotonLink>
        }
      />
    );
  }

  const [datos, sedes] = await Promise.all([datosVitrina(i.id), sedesParaEditar(i)]);
  const inicial = datosInicialesDeVitrina(i);

  return (
    <>
      <VitrinaFormulario
        slug={i.slug}
        verificada={i.verificada}
        inicial={inicial}
        fotos={datos.fotos}
        novedades={datos.novedades}
        cursos={datos.cursos}
        busquedasAbiertas={datos.busquedasAbiertas}
        almacenamientoDisponible={almacenamientoConfigurado()}
        huella={huellaDeVitrina({ ...i, fotos: datos.fotos, novedades: datos.novedades })}
      />
      <SedesFormulario sedes={sedes} huella={huellaDeSedes(sedes, { conCue: false })} />
    </>
  );
}
