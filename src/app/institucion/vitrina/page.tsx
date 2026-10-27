import type { Metadata } from "next";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { VitrinaFormulario } from "@/components/institucion/vitrina-formulario";
import { BotonLink } from "@/components/ui/button";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { requerirInstitucion } from "@/lib/auth";
import { mensajeDeInstitucion, rutaDeInstitucion, urlCompleta } from "@/lib/compartir";
import { esRolGestor } from "@/lib/equipo";
import { rolEnInstitucion } from "@/lib/queries/equipo";
import { sedesParaEditar } from "@/lib/queries/sedes";
import { origenSitio } from "@/lib/sitio";
import { datosVitrina } from "@/lib/queries/vitrina";
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
        mensajeParaCompartir={mensajeDeInstitucion({ nombre: i.nombre, url: urlCompleta(await origenSitio(), rutaDeInstitucion(i.slug)) })}
        verificada={i.verificada}
        inicial={inicial}
        fotos={datos.fotos}
        novedades={datos.novedades}
        cursos={datos.cursos}
        busquedasAbiertas={datos.busquedasAbiertas}
        almacenamientoDisponible={almacenamientoConfigurado()}
        huella={huellaDeVitrina({ ...i, fotos: datos.fotos, novedades: datos.novedades })}
      />
      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-tarjeta border border-linea bg-white p-6">
        <div>
          <h2 className="font-display m-0 mb-1 text-[18px] font-semibold text-navy-900">Sedes</h2>
          <p className="m-0 text-[13.5px] text-apagado">
            {sedes.length === 1 ? "Tenés 1 sede." : `Tenés ${sedes.length} sedes.`} Ahora se cargan y se editan en su propia pantalla.
          </p>
        </div>
        <BotonLink href="/institucion/sedes" variante="secundario" className="rounded-full">
          Ir a Sedes
        </BotonLink>
      </section>
    </>
  );
}
