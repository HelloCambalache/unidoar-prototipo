import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonLink } from "@/components/ui/button";
import { CursoDetalle } from "@/components/docente/curso-detalle";
import { CursoFiltros } from "@/components/docente/curso-filtros";
import { CursoHistorialLista } from "@/components/docente/curso-historial";
import { CursoLateral } from "@/components/docente/curso-lateral";
import { CursoAgenda, CursoTarjeta } from "@/components/docente/curso-tarjeta";
import { requerirDocente } from "@/lib/auth";
import {
  cursoPorId,
  cursosParaDocente,
  filtrarCursos,
  historialCursos,
  resumenFormacion,
} from "@/lib/queries/cursos";
import { cn } from "@/lib/utils";
import { Icono } from "@/components/icons";

export const metadata: Metadata = { title: "Cursos" };

/** Un valor inválido en la URL se ignora en vez de romper la página. */
const paramsSchema = z.object({
  vista: z.enum(["lista", "agenda", "historial"]).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  modalidad: z.enum(["Presencial", "Online"]).optional().catch(undefined),
  inscripto: z.literal("1").optional().catch(undefined),
  curso: z.guid().optional().catch(undefined),
});

type Params = Record<string, string | string[] | undefined>;

const PILDORA =
  "inline-flex flex-none items-center gap-[7px] rounded-full px-[18px] py-[9px] text-[13px] leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";

export default async function CursosDocentePage({ searchParams }: { searchParams: Promise<Params> }) {
  const { docente } = await requerirDocente();
  const crudo = await searchParams;
  const p = paramsSchema.parse(Object.fromEntries(Object.entries(crudo).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));

  if (p.curso) {
    const curso = await cursoPorId(docente.id, p.curso);
    if (!curso) notFound();
    return <CursoDetalle c={curso} />;
  }

  const vista = p.vista ?? "lista";
  const [vigentes, historial] = await Promise.all([cursosParaDocente(docente.id), historialCursos(docente.id)]);
  const resumen = resumenFormacion(historial);
  const filtros = { q: p.q ?? "", modalidad: p.modalidad ?? "", soloInscripto: p.inscripto === "1" };
  const cursos = filtrarCursos(vigentes, filtros);
  const hayFiltros = !!(filtros.q || filtros.modalidad || filtros.soloInscripto);

  const href = (v: "lista" | "agenda" | "historial") => {
    const sp = new URLSearchParams();
    if (v !== "lista") sp.set("vista", v);
    if (v !== "historial") {
      if (filtros.q) sp.set("q", filtros.q);
      if (filtros.modalidad) sp.set("modalidad", filtros.modalidad);
      if (filtros.soloInscripto) sp.set("inscripto", "1");
    }
    const qs = sp.toString();
    return qs ? `/docente/cursos?${qs}` : "/docente/cursos";
  };

  const pestana = (v: "lista" | "agenda" | "historial", children: React.ReactNode) => (
    <Link
      href={href(v)}
      aria-current={vista === v ? "page" : undefined}
      className={cn(
        PILDORA,
        vista === v
          ? "bg-navy-700 text-white"
          : "bg-white text-tinta-2 shadow-[inset_0_0_0_1px_#E3E1DC] hover:bg-superficie",
      )}
    >
      {children}
    </Link>
  );

  const destacado = [...vigentes].filter((c) => !c.inscripto).sort((a, b) => b.inscriptos - a.inscriptos)[0] ?? null;

  return (
    <>
      <EncabezadoPagina
        titulo="Cursos"
        bajada="Cursos cortos y certificaciones que ofrecen las instituciones de tu zona, y los que ya hiciste."
        className="mb-[18px]"
      />
      <nav aria-label="Vista de cursos" className="mb-5 flex gap-2 overflow-x-auto max-[860px]:pb-1">
        {pestana(
          "lista",
          <>
            <Icono nombre="lista" tamano={14} trazo={2} />
            Lista
          </>,
        )}
        {pestana(
          "agenda",
          <>
            <Icono nombre="calendario" tamano={14} trazo={1.9} />
            Agenda
          </>,
        )}
        {pestana("historial", <>Mis cursos · {historial.length}</>)}
      </nav>

      {vista === "historial" ? (
        <div className="flex flex-wrap items-start gap-[18px]">
          {historial.length > 0 ? (
            <CursoHistorialLista cursos={historial} />
          ) : (
            <div className="min-w-[340px] flex-1 max-[860px]:min-w-0">
              <EstadoVacio
                titulo="Todavía no te inscribiste a ningún curso"
                texto="Cuando te inscribas, vas a ver acá el avance, el certificado y el puntaje que suman a tu perfil."
                accion={<BotonLink href="/docente/cursos">Ver cursos disponibles</BotonLink>}
              />
            </div>
          )}
          <CursoLateral
            variante="historial"
            resumen={resumen}
            enCurso={historial.find((c) => c.estado === "en-curso") ?? null}
          />
        </div>
      ) : (
        <>
          <CursoFiltros q={filtros.q} modalidad={filtros.modalidad} soloInscripto={filtros.soloInscripto} />
          <div className="flex flex-wrap items-start gap-6 max-[860px]:flex-col max-[860px]:gap-4">
            <div className="min-w-0 flex-1 max-[860px]:w-full">
              {cursos.length === 0 ? (
                <EstadoVacio
                  titulo={
                    hayFiltros
                      ? "No hay cursos que coincidan con lo que buscás"
                      : "Todavía no hay cursos publicados"
                  }
                  texto={
                    hayFiltros
                      ? "Probá con otra palabra o quitá algún filtro."
                      : "Cuando una institución abra un curso, lo vas a ver acá."
                  }
                  accion={
                    hayFiltros ? (
                      <BotonLink href="/docente/cursos" variante="secundario">
                        Ver todos los cursos
                      </BotonLink>
                    ) : undefined
                  }
                />
              ) : vista === "agenda" ? (
                <CursoAgenda cursos={cursos} />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-[18px] max-[560px]:grid-cols-1">
                  {cursos.map((c) => (
                    <CursoTarjeta key={c.id} c={c} />
                  ))}
                </div>
              )}
            </div>
            <CursoLateral variante="lista" resumen={resumen} destacado={destacado} />
          </div>
        </>
      )}
    </>
  );
}
