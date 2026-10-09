import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DatosDeCuentaFormulario } from "@/components/backoffice/inst-datos-cuenta";
import { VolverBo } from "@/components/backoffice/inst-volver";
import { SedesFormulario } from "@/components/institucion/sedes-formulario";
import { VitrinaFormulario } from "@/components/institucion/vitrina-formulario";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { TIPOS_CON_CUE } from "@/lib/catalogo";
import { institucionParaEditar } from "@/lib/queries/backoffice-instituciones";
import { sedesParaEditar } from "@/lib/queries/sedes";
import { datosVitrina } from "@/lib/queries/vitrina";
import { datosInicialesDeVitrina } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Editar institución · Backoffice" };
export const dynamic = "force-dynamic";

/**
 * Edición del perfil de una institución por el equipo: el mismo formulario del "Perfil público" que usa la institución, más una
 * tarjeta con los datos de la cuenta que ella no puede tocar (teléfono, CUIT y CUE).
 */
export default async function EditarInstitucion({ params }: { params: Promise<{ id: string }> }) {
  // El layout ya lo exige, pero acá se editan datos de otra cuenta: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const i = await institucionParaEditar(id);
  if (!i) notFound();

  const [datos, sedes] = await Promise.all([datosVitrina(i.id), sedesParaEditar(i)]);

  return (
    <>
      <VolverBo href={`/backoffice/instituciones/${i.id}`} etiqueta={i.nombre} />
      <div className="mb-4">
        <VitrinaFormulario
          institucionIdAdmin={i.id}
          slug={i.slug}
          verificada={i.verificada}
          inicial={datosInicialesDeVitrina(i)}
          fotos={datos.fotos}
          novedades={datos.novedades}
          cursos={datos.cursos}
          busquedasAbiertas={datos.busquedasAbiertas}
          almacenamientoDisponible={almacenamientoConfigurado()}
        />
        <SedesFormulario institucionIdAdmin={i.id} sedes={sedes} conCue={TIPOS_CON_CUE.includes(i.tipo)} />
      </div>
      <Tarjeta className="max-w-[560px] p-[22px]">
        <EtiquetaSeccion className="mb-1">Datos de la cuenta</EtiquetaSeccion>
        <p className="m-0 mb-4 text-[13px] leading-[1.5] text-apagado">
          Lo que la institución cargó en el alta y no puede cambiar desde su perfil. El CUE se carga en cada sede.
        </p>
        <DatosDeCuentaFormulario institucionId={i.id} inicial={{ telefono: i.telefono ?? "", cuit: i.cuit ?? "" }} />
      </Tarjeta>
    </>
  );
}
