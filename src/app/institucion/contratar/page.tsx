import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioContratar } from "@/components/institucion/formulario-contratar";
import { BotonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/insignia";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { faltaExamenPreocupacional } from "@/lib/postulaciones";
import { postulacionPropia } from "@/lib/queries/pipeline";
import { iniciales } from "@/lib/utils";

export const metadata: Metadata = { title: "Contratar" };

export default async function Contratar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { institucion } = await requerirInstitucion();
  const { postulacion: crudo } = await searchParams;
  const id = Array.isArray(crudo) ? crudo[0] : crudo;
  if (!esUuid(id)) notFound();

  const fila = await postulacionPropia(institucion.id, id);
  if (!fila) notFound();
  const { postulacion, busqueda, docente } = fila;

  const nombre = `${docente.nombre} ${docente.apellido}`.trim();
  const detalle = [busqueda.disciplina, busqueda.nivel].filter(Boolean).join(" · ");
  const volver = `/institucion/postulantes?busqueda=${busqueda.id}`;

  const impedimento =
    postulacion.etapa === "contratado"
      ? "Esta persona ya figura como contratada para esta búsqueda."
      : postulacion.etapa === "descartado"
        ? "Esta postulación está archivada. Recuperala desde el pipeline antes de contratar."
        : busqueda.estado === "cerrada"
          ? "La búsqueda está cerrada. Reabrila desde Publicaciones para poder contratar."
          : null;

  return (
    <div className="flex flex-1 justify-center">
      <div className="w-[460px] max-w-full">
        <div className="mb-[22px] flex items-center gap-3.5">
          <Avatar iniciales={iniciales(nombre)} fotoUrl={docente.fotoUrl} tamano={48} />
          <div className="min-w-0">
            <h1 className="m-0 text-[18px] leading-tight font-semibold">{nombre}</h1>
            <div className="mt-0.5 text-[13px] leading-snug text-apagado">{detalle || busqueda.puesto}</div>
          </div>
        </div>
        <section className="rounded-tarjeta border border-linea bg-white p-[22px]">
          <h2 className="m-0 mb-1 text-[15px] leading-none font-semibold">Marcar como contratada</h2>
          <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">Para el puesto «{busqueda.puesto}».</p>
          {impedimento ? (
            <div className="flex flex-col gap-3.5">
              <p role="status" className="m-0 rounded-caja bg-superficie px-3.5 py-3 text-[13.5px] leading-normal text-tinta-2">
                {impedimento}
              </p>
              <BotonLink href={volver} variante="secundario" bloque>
                Volver al pipeline
              </BotonLink>
            </div>
          ) : (
            <FormularioContratar
              postulacionId={postulacion.id}
              busquedaId={busqueda.id}
              puesto={busqueda.puesto}
              inicioPorDefecto={busqueda.fechaInicio ?? ""}
              puedeCerrar={busqueda.estado !== "cerrada"}
              faltaExamen={faltaExamenPreocupacional(postulacion)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
