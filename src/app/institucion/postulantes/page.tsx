import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cerrarBusqueda, reabrirBusqueda } from "@/app/actions/busquedas";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonAccion } from "@/components/institucion/boton-accion";
import { EstadoBusqueda } from "@/components/institucion/insignias-busqueda";
import { SelectorBusqueda } from "@/components/institucion/selector-busqueda";
import { TableroPipeline } from "@/components/institucion/tablero-pipeline";
import { BotonLink } from "@/components/ui/button";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { busquedaPorDefecto, opcionesDeBusqueda, pipelineDeBusqueda } from "@/lib/queries/pipeline";
import { sedesDeInstitucion } from "@/lib/queries/sedes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Postulantes" };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Postulantes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario, institucion } = await requerirInstitucion();
  const sp = await searchParams;
  const vista = uno(sp.vista) === "tabla" ? "tabla" : "kanban";
  const pedida = uno(sp.busqueda);

  if (pedida && !esUuid(pedida)) notFound();
  const consultaOpciones = opcionesDeBusqueda(institucion.id);
  const busquedaId = pedida || busquedaPorDefecto(await consultaOpciones);

  if (!busquedaId) {
    return (
      <EstadoVacio
        titulo="Todavía no publicaste ninguna búsqueda"
        texto="Cuando publiques una, acá vas a ver a quienes se postulen y mover a cada uno por las etapas hasta contratar."
        accion={
          <BotonLink href="/institucion/publicar" variante="cta">
            Publicar una búsqueda
          </BotonLink>
        }
      />
    );
  }

  const [datos, opciones, sedes] = await Promise.all([
    pipelineDeBusqueda(institucion, usuario.id, busquedaId),
    consultaOpciones,
    sedesDeInstitucion(institucion.id),
  ]);
  if (!datos) notFound();
  const { busqueda, postulantes } = datos;
  // Filtro por sede de la lista de búsquedas (?sede=): solo vale una sede de esta institución.
  const pedidaSede = uno(sp.sede);
  const sedeFiltro = sedes.some((s) => s.id === pedidaSede) ? pedidaSede : "";
  const sedeDeLaBusqueda = sedes.length > 1 ? (sedes.find((s) => s.id === opciones.find((o) => o.id === busqueda.id)?.sedeId)?.nombre ?? null) : null;
  const cerrada = busqueda.estado === "cerrada";
  const base = `/institucion/postulantes?busqueda=${busqueda.id}`;

  const enlaceVista = (activa: boolean) =>
    cn(
      "flex min-h-9 items-center gap-1.5 rounded-full px-4 text-[13px] leading-none font-semibold transition-colors",
      activa ? "bg-white text-navy-900 shadow-[0_1px_3px_rgba(4,11,53,.12)] hover:text-navy-900" : "text-apagado hover:text-tinta",
    );

  const barra = (
    <>
      {cerrada ? (
        <BotonAccion accion={reabrirBusqueda.bind(null, busqueda.id)} exito="Búsqueda reabierta">
          ↺ Reabrir búsqueda
        </BotonAccion>
      ) : (
        <BotonAccion
          accion={cerrarBusqueda.bind(null, busqueda.id)}
          exito="Búsqueda cerrada"
          confirmar={`¿Cerrar «${busqueda.puesto}»? Los postulantes se conservan y podés reabrirla cuando quieras.`}
          className="border-verde-borde text-verde"
        >
          ✓ Cerrar búsqueda
        </BotonAccion>
      )}
      <BotonLink href={`/institucion/publicar?editar=${busqueda.id}`} variante="secundario" tamano="sm">
        ✎ Editar búsqueda
      </BotonLink>
      <div role="group" aria-label="Vista" className="ml-auto flex flex-none gap-1 rounded-full bg-[#E9E7E1] p-1">
        <Link href={base} aria-current={vista === "kanban" ? "page" : undefined} className={enlaceVista(vista === "kanban")}>
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="18" rx="1.5" />
            <rect x="14" y="3" width="7" height="10" rx="1.5" />
          </svg>
          Kanban
        </Link>
        <Link href={`${base}&vista=tabla`} aria-current={vista === "tabla" ? "page" : undefined} className={enlaceVista(vista === "tabla")}>
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="1.5" />
            <path d="M3 10h18M9 10v10" />
          </svg>
          Tabla
        </Link>
      </div>
    </>
  );

  return (
    <>
      <nav aria-label="Ruta" className="mb-2.5 flex items-center gap-2">
        <Link
          href="/institucion/busquedas"
          aria-label="Volver a Publicaciones"
          className="inline-flex size-[30px] flex-none items-center justify-center rounded-full border border-borde bg-white text-tinta-2 shadow-[0_1px_2px_rgba(31,36,33,.06)] transition-colors hover:border-borde-fuerte hover:bg-[#F0EFEA]"
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <span className="min-w-0 truncate text-[13px] leading-none text-apagado">
          <Link href="/institucion/busquedas" className="text-apagado hover:text-tinta">
            Publicaciones
          </Link>
          <span className="px-[7px] text-borde-fuerte">/</span>
          <span className="font-medium text-tinta">{busqueda.puesto}</span>
        </span>
      </nav>

      <section className="mb-5 flex flex-col gap-3.5 rounded-panel bg-white px-6 py-5 shadow-tarjeta">
        <span className="text-[11.5px] leading-none font-semibold tracking-[0.1em] text-apagado">POSTULANTES</span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display m-0 text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] text-navy-900 max-[860px]:text-[22px]">
            {busqueda.puesto}
          </h1>
          <EstadoBusqueda b={{ estado: busqueda.estado, rapida: busqueda.rapida, plazo: null }} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-[24px] leading-none font-semibold text-navy-900">{busqueda.postulantes}</span>
            <span className="text-sm text-apagado">{busqueda.postulantes === 1 ? "postulante" : "postulantes"}</span>
          </span>
          <span className="text-sm leading-none text-apagado">
            Publicada {busqueda.publicada}
            {sedeDeLaBusqueda && ` · ${sedeDeLaBusqueda}`}
          </span>
        </div>
        {opciones.length > 1 && (
          <SelectorBusqueda
            opciones={opciones}
            actual={busqueda.id}
            vista={vista}
            sedes={sedes.map((s) => ({ id: s.id, nombre: s.nombre }))}
            sedeFiltro={sedeFiltro}
          />
        )}
      </section>

      <TableroPipeline busqueda={busqueda} postulantes={postulantes} vista={vista} barra={barra} />
    </>
  );
}
