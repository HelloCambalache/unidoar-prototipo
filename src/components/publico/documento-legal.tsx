import Link from "next/link";
import { partesDeTexto, type BloqueTexto, type SeccionLegal } from "@/lib/terminos-texto";

/** Un texto con sus marcas (**negrita**, [enlace](/ruta)) hecho elementos; nunca HTML. */
function Texto({ texto }: { texto: string }) {
  return (
    <>
      {partesDeTexto(texto).map((p, i) =>
        p.tipo === "negrita" ? (
          <strong key={i} className="font-semibold text-tinta">
            {p.texto}
          </strong>
        ) : p.tipo === "enlace" ? (
          <Link key={i} href={p.href} className="font-semibold text-naranja">
            {p.texto}
          </Link>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  );
}

function Bloques({ bloques }: { bloques: BloqueTexto[] }) {
  return (
    <>
      {bloques.map((b, i) => {
        if ("p" in b) {
          return (
            <p key={i} className="m-0">
              <Texto texto={b.p} />
            </p>
          );
        }
        const claseLista =
          b.marcador === "ninguno"
            ? "list-none pl-0"
            : b.marcador === "letras"
              ? "list-[lower-alpha] pl-6 marker:text-tinta-2"
              : "list-disc pl-5 marker:text-sutil";
        return (
          <ul key={i} className={`m-0 flex flex-col gap-2.5 ${claseLista}`}>
            {b.lista.map((item) => (
              <li key={item.slice(0, 40)} className={b.marcador === "ninguno" ? "" : "pl-1"}>
                <Texto texto={item} />
              </li>
            ))}
          </ul>
        );
      })}
    </>
  );
}

/**
 * Un documento legal de la titular (términos o política de privacidad) tal como lo escribió: título, fecha y versión, un índice para saltar a cada
 * sección y las secciones con su texto. La página no agrega nada más: ver el comentario de `src/lib/terminos-texto.ts`.
 */
export function DocumentoLegal({
  titulo,
  actualizacion,
  version,
  secciones,
  etiquetaDelIndice,
}: {
  titulo: string;
  actualizacion: string;
  version: string;
  secciones: SeccionLegal[];
  etiquetaDelIndice: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[780px] flex-1 px-12 py-14 max-[560px]:px-6 max-[560px]:py-10">
      {/* El título del documento va entero en mayúsculas: más chico que un título común para que no ocupe media pantalla en el celular. */}
      <h1 className="mb-3 text-[24px] leading-[1.25] font-semibold tracking-[-0.01em] text-balance text-tinta max-[560px]:text-[20px]">{titulo}</h1>
      <p className="m-0 text-sm leading-normal text-sutil">Última actualización: {actualizacion}</p>
      <p className="mb-8 text-sm leading-normal text-sutil">Versión: {version}</p>

      <nav aria-label={etiquetaDelIndice} className="mb-9 rounded-interno border border-borde bg-superficie px-5 py-4">
        <h2 className="m-0 mb-2.5 text-xs leading-none font-semibold tracking-[.09em] text-apagado uppercase">Índice</h2>
        <ol className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-1.5 p-0 text-sm leading-snug max-[560px]:grid-cols-1">
          {secciones.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-navy-700 hover:underline focus-visible:underline">
                {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-9 text-[15px] leading-[1.7] text-tinta-2">
        {secciones.map((s) => (
          <section key={s.id} id={s.id} className="flex scroll-mt-6 flex-col gap-3.5">
            <h2 className="m-0 text-xl leading-[1.3] font-semibold tracking-[-0.01em] text-tinta">{s.titulo}</h2>
            <Bloques bloques={s.bloques} />
          </section>
        ))}
      </div>
    </div>
  );
}
