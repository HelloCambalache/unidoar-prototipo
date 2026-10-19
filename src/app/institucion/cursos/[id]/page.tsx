import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CursoFoto } from "@/components/docente/curso-foto";
import { CursoMigas } from "@/components/institucion/curso-migas";
import { BotonLink } from "@/components/ui/button";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { etiquetaInscriptos, PUNTAJE_POR_DEFECTO } from "@/lib/cursos";
import { etiquetaFechas } from "@/lib/fechas-curso";
import { cursoConInscriptos } from "@/lib/queries/cursos-institucion";

export const metadata: Metadata = { title: "Curso" };

const AVISOS: Record<string, string> = {
  creado: "Curso creado. Los profesionales ya lo ven en su sección de Cursos.",
  editado: "Cambios guardados.",
};

/** Cuántos nombres se listan en la ficha; el resto está en el detalle de inscriptos. */
const MAX_NOMBRES = 8;

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-tarjeta border border-linea bg-white p-4">
      <div className="mb-1.5 text-[11px] leading-none font-semibold tracking-[.05em] text-sutil uppercase">{etiqueta}</div>
      <div className="text-[15px] leading-[1.3] font-semibold">{valor}</div>
    </div>
  );
}

export default async function FichaCurso({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { institucion } = await requerirInstitucion();
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!esUuid(id)) notFound();
  const datos = await cursoConInscriptos(institucion.id, id);
  if (!datos) notFound();
  const { curso: c, inscriptos } = datos;

  const avisoTexto = AVISOS[Array.isArray(aviso) ? (aviso[0] ?? "") : (aviso ?? "")];
  // Los links se cargan validados, pero un valor viejo que no sea http(s) se muestra como texto, nunca como enlace.
  const enlace = c.link && /^https?:\/\//i.test(c.link) ? c.link : null;

  return (
    <>
      <CursoMigas actual={c.titulo} />
      {avisoTexto && (
        <p role="status" className="mb-4 max-w-[1180px] rounded-caja bg-verde-tint px-3.5 py-2.5 text-[13px] leading-normal text-verde">
          {avisoTexto}
        </p>
      )}

      <div className="max-w-[1180px]">
        <CursoFoto url={c.fotoUrl} altura={320} className="rounded-xl max-[760px]:h-[200px]!" />

        <div className="mt-[22px] mb-[18px] flex items-end justify-between gap-4 max-[860px]:flex-col max-[860px]:items-stretch max-[860px]:gap-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 text-[28px] leading-[1.25] font-semibold tracking-[-0.018em] max-[860px]:text-[22px]">{c.titulo}</h1>
              <Insignia tono={c.modalidad === "Online" ? "azul" : "neutro"}>{c.modalidad}</Insignia>
            </div>
            {c.subtitulo && <div className="mt-1 text-[15px] leading-[1.3] font-medium text-navy-700">{c.subtitulo}</div>}
          </div>
          <BotonLink href={`/institucion/cursos/${c.id}/editar`} variante="secundario" className="max-[860px]:w-full">
            Editar curso
          </BotonLink>
        </div>

        <div className="mb-[22px] grid grid-cols-4 gap-3.5 max-[760px]:grid-cols-2 max-[700px]:grid-cols-1">
          <Dato etiqueta="Modalidad" valor={c.modalidad} />
          <Dato etiqueta="Dicta" valor={c.profesor || "A confirmar"} />
          <Dato etiqueta="Fechas" valor={etiquetaFechas(c.fechaInicio, c.fechaFinal)} />
          <Dato etiqueta="Horario" valor={c.horario || "A confirmar"} />
        </div>

        {c.direccion && (
          <p className="m-0 mb-3.5 text-sm leading-normal text-tinta-2">
            <b className="font-semibold">Dirección:</b> {c.direccion}
          </p>
        )}
        {c.link && (
          <p className="m-0 mb-3.5 text-sm leading-normal break-all text-tinta-2">
            <b className="font-semibold">Link:</b>{" "}
            {enlace ? (
              <a href={enlace} target="_blank" rel="noopener noreferrer" className="underline">
                {enlace}
              </a>
            ) : (
              c.link
            )}
          </p>
        )}
        {c.link && c.linkClave && (
          <p className="m-0 mb-3.5 text-sm leading-normal break-all text-tinta-2">
            <b className="font-semibold">Contraseña o código:</b>{" "}
            <code className="rounded-md bg-lienzo px-1.5 py-0.5 font-medium text-tinta select-all">{c.linkClave}</code>
          </p>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {c.certifica ? (
            <>
              <Insignia tono="verde">Entrega certificado</Insignia>
              <Insignia className="bg-[#FDF1C7] font-semibold text-[#7A5900]">
                +{c.puntaje ?? PUNTAJE_POR_DEFECTO} puntos
              </Insignia>
            </>
          ) : (
            <Insignia>Sin certificado</Insignia>
          )}
        </div>

        <p className="m-0 mb-6 max-w-[70ch] text-[15px] leading-[1.6] whitespace-pre-line text-tinta-2">
          {c.descripcion || "Todavía no cargaste una descripción para este curso."}
        </p>

        <section aria-labelledby="inscriptos-curso" className="max-w-[420px] rounded-tarjeta border border-linea bg-white p-5">
          <h2 id="inscriptos-curso" className="m-0 mb-3 text-[15px] leading-none font-semibold">
            {etiquetaInscriptos(inscriptos.length)}
          </h2>
          {inscriptos.length > 0 ? (
            <>
              <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
                {inscriptos.slice(0, MAX_NOMBRES).map((i) => (
                  <li key={i.docenteId} className="flex items-center gap-2.5 text-sm leading-[1.4] text-tinta-2">
                    <Avatar iniciales={i.iniciales} fotoUrl={i.fotoUrl} tamano={30} />
                    {i.perfilVisible ? (
                      <Link href={`/institucion/docente/${i.docenteId}`} className="text-tinta-2 hover:text-navy-700 hover:underline">
                        {i.nombre}
                      </Link>
                    ) : (
                      i.nombre
                    )}
                  </li>
                ))}
              </ul>
              {inscriptos.length > MAX_NOMBRES && (
                <p className="m-0 mb-4 text-[13px] leading-none text-apagado">y {inscriptos.length - MAX_NOMBRES} más</p>
              )}
              <BotonLink href={`/institucion/cursos/${c.id}/inscriptos`} variante="secundario" tamano="sm">
                Detalle de inscriptos
              </BotonLink>
            </>
          ) : (
            <p className="m-0 text-sm leading-normal text-apagado">
              Todavía no se anotó nadie. Los profesionales lo ven en su sección de Cursos.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
