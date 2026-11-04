import type { Metadata } from "next";
import { z } from "zod";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CursoFiltros } from "@/components/docente/curso-filtros";
import { CursoTarjeta } from "@/components/docente/curso-tarjeta";
import { CursosSecciones } from "@/components/institucion/cursos-secciones";
import { BotonLink } from "@/components/ui/button";
import { requerirInstitucion } from "@/lib/auth";
import { cursosParaInstitucion, filtrarCursos } from "@/lib/queries/cursos";
import { exigirBeneficio } from "@/lib/queries/puntuales";

export const metadata: Metadata = { title: "Explorar cursos" };

/** Un valor inválido en la URL se ignora en vez de romper la página. */
const paramsSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  modalidad: z.enum(["Presencial", "Online"]).optional().catch(undefined),
  inscripto: z.literal("1").optional().catch(undefined),
});

type Params = Record<string, string | string[] | undefined>;

/**
 * Los cursos de las demás instituciones: la institución los explora y puede anotar a la suya (para su staff o para la institución).
 * Lo que publica ella misma se administra en «Mis cursos».
 */
export default async function ExplorarCursos({ searchParams }: { searchParams: Promise<Params> }) {
  const { institucion } = await requerirInstitucion();
  await exigirBeneficio(institucion.plan, "cursos");
  const crudo = await searchParams;
  const p = paramsSchema.parse(Object.fromEntries(Object.entries(crudo).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));

  const vigentes = await cursosParaInstitucion(institucion.id);
  const filtros = { q: p.q ?? "", modalidad: p.modalidad ?? "", soloInscripto: p.inscripto === "1" };
  const cursos = filtrarCursos(vigentes, filtros);
  const hayFiltros = !!(filtros.q || filtros.modalidad || filtros.soloInscripto);
  const anotados = vigentes.filter((c) => c.inscripto).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Explorar cursos"
        bajada="Los cursos y capacitaciones que ofrecen otras instituciones. Podés anotar a tu institución, para tu equipo o para la institución."
        className="mb-4"
      />
      <CursosSecciones activa="explorar" />

      <CursoFiltros q={filtros.q} modalidad={filtros.modalidad} soloInscripto={filtros.soloInscripto} />
      {anotados > 0 && !filtros.soloInscripto && (
        <p className="m-0 mb-4 text-[13px] leading-normal text-apagado">
          Tu institución está inscripta en {anotados === 1 ? "1 curso" : `${anotados} cursos`}.
        </p>
      )}

      {cursos.length === 0 ? (
        <EstadoVacio
          titulo={hayFiltros ? "No hay cursos que coincidan con lo que buscás" : "Todavía no hay cursos de otras instituciones"}
          texto={
            hayFiltros
              ? "Probá con otra palabra o quitá algún filtro."
              : "Cuando otra institución publique un curso, lo vas a ver acá y vas a poder anotar a la tuya."
          }
          accion={
            hayFiltros ? (
              <BotonLink href="/institucion/cursos/explorar" variante="secundario">
                Ver todos los cursos
              </BotonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-[18px] max-[560px]:grid-cols-1">
          {cursos.map((c) => (
            <CursoTarjeta key={c.id} c={c} href={`/institucion/cursos/explorar/${c.id}`} />
          ))}
        </div>
      )}
    </>
  );
}
