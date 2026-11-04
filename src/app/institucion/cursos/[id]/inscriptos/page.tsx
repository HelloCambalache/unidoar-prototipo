import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CursoDescargarLista, type FilaInscripto } from "@/components/institucion/curso-descargar-lista";
import { CursoInscripto } from "@/components/institucion/curso-inscripto";
import { CursoMigas } from "@/components/institucion/curso-migas";
import { BotonLink } from "@/components/ui/button";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { requerirInstitucion } from "@/lib/auth";
import { exigirBeneficio } from "@/lib/queries/puntuales";
import { esUuid } from "@/lib/busquedas";
import { etiquetaInscriptos, PUNTAJE_POR_DEFECTO } from "@/lib/cursos";
import { fechaDeInput } from "@/lib/fechas";
import { hoyArgentina } from "@/lib/fechas-curso";
import { cursoConInscriptos } from "@/lib/queries/cursos-institucion";
import { iniciales } from "@/lib/utils";

export const metadata: Metadata = { title: "Inscriptos" };

export default async function InscriptosDelCurso({ params }: { params: Promise<{ id: string }> }) {
  const { institucion } = await requerirInstitucion();
  await exigirBeneficio(institucion.plan, "cursos");
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const datos = await cursoConInscriptos(institucion.id, id);
  if (!datos) notFound();
  const { curso: c, inscriptos, instituciones: anotadas } = datos;
  const totalInscriptos = inscriptos.length + anotadas.length;

  const terminaron = inscriptos.filter((i) => i.terminoEn).length;
  const resumen = [
    etiquetaInscriptos(totalInscriptos).toLowerCase(),
    terminaron > 0 && (terminaron === 1 ? "1 ya lo terminó" : `${terminaron} ya lo terminaron`),
  ]
    .filter(Boolean)
    .join(" · ");
  const empezo = !c.fechaInicio || c.fechaInicio <= hoyArgentina();

  const filas: FilaInscripto[] = [
    ...inscriptos.map((i) => ({
      nombre: i.nombre,
      categoria: i.categoria,
      inscriptoEl: i.inscriptoEl,
      estado: i.terminoEn ? `Terminó el ${fechaDeInput(i.terminoEn)}` : "Cursando",
      certificado: !c.certifica ? "Sin certificado" : i.certificadoEnviado ? "Enviado" : "Sin enviar",
    })),
    // Una institución anotada es una sola fila (anotó a su staff o a la institución): no tiene certificado por persona.
    ...anotadas.map((i) => ({ nombre: i.nombre, categoria: "Institución", inscriptoEl: i.inscriptaEl, estado: "Inscripta", certificado: "—" })),
  ];

  return (
    <>
      <CursoMigas actual="Inscriptos" />
      <div className="max-w-[900px]">
        <EncabezadoPagina
          titulo="Inscriptos"
          bajada={`${c.titulo} · ${resumen}`}
          acciones={<CursoDescargarLista titulo={c.titulo} filas={filas} />}
        />
        {totalInscriptos === 0 ? (
          <EstadoVacio
            titulo="Todavía no se anotó nadie en este curso"
            texto="Cuando un profesional o una institución se inscriba, aparece acá y te llega un aviso."
            accion={
              <BotonLink href={`/institucion/cursos/${c.id}`} variante="secundario">
                Volver al curso
              </BotonLink>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            {inscriptos.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {inscriptos.map((i) => (
                  <CursoInscripto
                    key={i.docenteId}
                    cursoId={c.id}
                    i={i}
                    certifica={c.certifica}
                    puntos={c.puntaje ?? PUNTAJE_POR_DEFECTO}
                    empezo={empezo}
                  />
                ))}
              </ul>
            )}
            {anotadas.length > 0 && (
              <section aria-labelledby="instituciones-inscriptas">
                <h2 id="instituciones-inscriptas" className="m-0 mb-1 text-[15px] leading-none font-semibold">
                  {anotadas.length === 1 ? "Institución inscripta" : "Instituciones inscriptas"}
                </h2>
                <p className="m-0 mb-3 text-[13px] leading-normal text-apagado">
                  Anotaron a su equipo o a la institución. Para esto no hay certificado por persona: lo coordinás con ellas.
                </p>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {anotadas.map((i) => (
                    <li
                      key={i.institucionId}
                      className="flex flex-wrap items-center gap-3 rounded-tarjeta border border-linea bg-white px-[18px] py-4"
                    >
                      <Avatar iniciales={iniciales(i.nombre)} fotoUrl={i.logoUrl} tamano={32} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/instituciones/${i.slug}`}
                          className="block truncate text-[15px] leading-[1.3] font-semibold text-tinta hover:text-navy-700 hover:underline"
                        >
                          {i.nombre}
                        </Link>
                        <span className="block text-xs leading-[1.4] text-apagado">Se inscribió el {i.inscriptaEl}</span>
                      </div>
                      <Insignia tono="azul">Institución</Insignia>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
