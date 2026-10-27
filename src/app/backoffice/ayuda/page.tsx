import type { Metadata } from "next";
import Link from "next/link";
import { BuscadorDeAyuda, ResultadosDeAyuda } from "@/components/ayuda/buscador-de-ayuda";
import { IndiceDelManual } from "@/components/ayuda/indice-del-manual";
import { PreguntasFrecuentes } from "@/components/ayuda/preguntas-frecuentes";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/auth";
import { buscarEnAyuda, MANUALES, MANUALES_PUBLICOS, rutaDeManual } from "@/lib/ayuda";

export const metadata: Metadata = { title: "Ayuda · Backoffice" };
export const dynamic = "force-dynamic";

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** El manual del equipo. Es interno: documenta criterios de verificación y movimientos de dinero. */
export default async function AyudaBackoffice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requerirUsuario("admin");
  const q = uno((await searchParams).q).trim().slice(0, 80);
  // Acá se busca en los tres manuales: el equipo también tiene que saber qué le explicamos a las instituciones y a los profesionales.
  const resultados = q ? buscarEnAyuda(Object.values(MANUALES), q) : null;
  const manual = MANUALES.equipo;

  return (
    <>
      <div className="mb-5">
        <h1 className="m-0 mb-1.5 text-[24px] leading-[1.2] font-semibold tracking-[-0.018em] max-[860px]:text-[22px]">Ayuda</h1>
        <p className="m-0 text-sm leading-normal text-apagado">{manual.bajada}</p>
      </div>

      <div className="mb-8">
        <BuscadorDeAyuda accion="/backoffice/ayuda" consulta={q} claro />
      </div>

      {resultados && (
        <div className="mb-10">
          <ResultadosDeAyuda consulta={q} resultados={resultados} />
        </div>
      )}

      <div className="flex flex-col gap-10">
        <IndiceDelManual manual={manual} />
        <PreguntasFrecuentes preguntas={manual.preguntas} />

        <Tarjeta className="p-6">
          <h2 className="m-0 mb-1.5 text-[16px] leading-tight font-semibold">Lo que ven las instituciones y los profesionales</h2>
          <p className="m-0 mb-3 text-sm leading-normal text-apagado">
            Los manuales que están en el sitio público. Conviene conocerlos para ayudar a quien escribe por Contacto.
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
            {MANUALES_PUBLICOS.map((m) => (
              <li key={m.perfil}>
                <Link href={rutaDeManual(m.perfil)} className="font-semibold text-navy-700 underline decoration-navy-700/30 underline-offset-2 hover:decoration-navy-700">
                  {m.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </>
  );
}
