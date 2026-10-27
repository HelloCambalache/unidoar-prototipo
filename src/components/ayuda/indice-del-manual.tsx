import Link from "next/link";
import { Icono } from "@/components/icons";
import { rutaDeArticulo, type ManualDeAyuda } from "@/lib/ayuda";

/** El índice de un manual: los capítulos, cada uno con sus guías como tarjetas (título y una línea que dice para qué sirve). */
export function IndiceDelManual({ manual }: { manual: ManualDeAyuda }) {
  return (
    <div className="flex flex-col gap-9">
      {manual.capitulos.map((capitulo) => (
        <section key={capitulo.id} aria-labelledby={`capitulo-${capitulo.id}`}>
          <h2 id={`capitulo-${capitulo.id}`} className="font-display m-0 mb-4 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-navy-900">
            {capitulo.titulo}
          </h2>
          <ul className="m-0 grid list-none grid-cols-2 gap-3.5 p-0 max-[700px]:grid-cols-1">
            {capitulo.articulos.map((a) => (
              <li key={a.slug}>
                <Link
                  href={rutaDeArticulo(manual.perfil, a.slug)}
                  className="group flex h-full items-start gap-3.5 rounded-tarjeta bg-white p-5 shadow-tarjeta transition-shadow hover:shadow-tarjeta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
                >
                  <span aria-hidden className="inline-flex size-10 flex-none items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                    <Icono nombre="manual" tamano={19} trazo={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 block text-[15px] leading-snug font-semibold text-tinta group-hover:text-navy-700">{a.titulo}</span>
                    <span className="block text-[13.5px] leading-normal text-apagado">{a.resumen}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
