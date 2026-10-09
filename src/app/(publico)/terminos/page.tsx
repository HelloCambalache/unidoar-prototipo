import type { Metadata } from "next";
import Link from "next/link";
import { PREAMBULO_TERMINOS, partesDeTexto, SECCIONES_TERMINOS, SUBTITULO_TERMINOS, type BloqueTexto } from "@/lib/terminos-texto";
import { TERMINOS_ACTUALIZADOS } from "@/lib/terminos";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Condiciones generales de uso de UNIDOAR para instituciones y postulantes: el servicio, las cuentas, las reglas de conducta, los datos personales, la responsabilidad y la jurisdicción.",
};

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
      {bloques.map((b, i) =>
        "p" in b ? (
          <p key={i} className="m-0">
            <Texto texto={b.p} />
          </p>
        ) : (
          <ul key={i} className="m-0 flex list-disc flex-col gap-2.5 pl-5 marker:text-sutil">
            {b.lista.map((item) => (
              <li key={item.slice(0, 40)} className="pl-1">
                <Texto texto={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

export default function Terminos() {
  return (
    <div className="mx-auto w-full max-w-[780px] flex-1 px-12 py-14 max-[560px]:px-6 max-[560px]:py-10">
      <h1 className="mb-2 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta">
        Términos y condiciones generales de uso
      </h1>
      <p className="m-0 mb-1 text-[15px] leading-normal font-medium text-tinta-2">{SUBTITULO_TERMINOS}</p>
      <p className="mb-8 text-sm leading-normal text-sutil">Última actualización: {TERMINOS_ACTUALIZADOS}</p>

      <div className="flex flex-col gap-4 text-[15px] leading-[1.7] text-tinta-2">
        {PREAMBULO_TERMINOS.map((p) => (
          <p key={p.slice(0, 40)} className="m-0">
            <Texto texto={p} />
          </p>
        ))}
      </div>

      <nav aria-label="Índice de los términos" className="my-9 rounded-ud border border-borde bg-superficie px-5 py-4">
        <h2 className="m-0 mb-2.5 text-xs leading-none font-semibold tracking-[.09em] text-apagado uppercase">Índice</h2>
        <ol className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-1.5 p-0 text-sm leading-snug max-[560px]:grid-cols-1">
          {SECCIONES_TERMINOS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-navy-700 hover:underline focus-visible:underline">
                {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-9 text-[15px] leading-[1.7] text-tinta-2">
        {SECCIONES_TERMINOS.map((s) => (
          <section key={s.id} id={s.id} className="flex scroll-mt-6 flex-col gap-3.5">
            <h2 className="m-0 text-xl leading-[1.3] font-semibold tracking-[-0.01em] text-tinta">{s.titulo}</h2>
            <Bloques bloques={s.bloques} />
            {s.subsecciones?.map((sub) => (
              <section key={sub.id} id={sub.id} className="flex scroll-mt-6 flex-col gap-3 pt-1">
                <h3 className="m-0 text-base leading-[1.4] font-semibold text-tinta">{sub.titulo}</h3>
                <Bloques bloques={sub.bloques} />
              </section>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
