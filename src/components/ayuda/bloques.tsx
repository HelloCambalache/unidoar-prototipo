import Link from "next/link";
import type { BloqueDeAyuda } from "@/lib/ayuda";
import { partesDeTexto } from "@/lib/terminos-texto";

/** Un texto con sus marcas (**negrita**, [enlace](/ruta)) hecho elementos; nunca HTML. Los enlaces solo van a rutas del sitio. */
export function TextoDeAyuda({ texto }: { texto: string }) {
  return (
    <>
      {partesDeTexto(texto).map((p, i) =>
        p.tipo === "negrita" ? (
          <strong key={i} className="font-semibold text-tinta">
            {p.texto}
          </strong>
        ) : p.tipo === "enlace" ? (
          <Link key={i} href={p.href} className="font-semibold text-navy-700 underline decoration-navy-700/30 underline-offset-2 hover:decoration-navy-700">
            {p.texto}
          </Link>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  );
}

/** Los bloques de una guía o de una respuesta: párrafos, pasos numerados, listas y notas destacadas. */
export function BloquesDeAyuda({ bloques }: { bloques: BloqueDeAyuda[] }) {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-[1.7] text-tinta-2">
      {bloques.map((b, i) => {
        if ("p" in b) {
          return (
            <p key={i} className="m-0">
              <TextoDeAyuda texto={b.p} />
            </p>
          );
        }
        if ("pasos" in b) {
          return (
            <ol key={i} className="m-0 flex list-none flex-col gap-3 p-0">
              {b.pasos.map((paso, n) => (
                <li key={n} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-[3px] inline-flex size-6 flex-none items-center justify-center rounded-full bg-navy-700 text-[12px] leading-none font-semibold text-white"
                  >
                    {n + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <TextoDeAyuda texto={paso} />
                  </span>
                </li>
              ))}
            </ol>
          );
        }
        if ("lista" in b) {
          return (
            <ul key={i} className="m-0 flex list-disc flex-col gap-2.5 pl-5 marker:text-sutil">
              {b.lista.map((item, n) => (
                <li key={n} className="pl-1">
                  <TextoDeAyuda texto={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <aside key={i} role="note" className="m-0 rounded-caja border-l-4 border-navy-700 bg-navy-50/70 px-4 py-3 text-[14px] leading-[1.6] text-tinta-2">
            <TextoDeAyuda texto={b.nota} />
          </aside>
        );
      })}
    </div>
  );
}
