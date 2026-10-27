import Link from "next/link";
import { rutaDeArticulo, rutaDeManual, type ManualDeAyuda } from "@/lib/ayuda";
import { cn } from "@/lib/utils";

/** El menú lateral de un manual: sus capítulos y guías, con la que se está leyendo marcada. */
export function MenuDelManual({ manual, actual }: { manual: ManualDeAyuda; actual?: string }) {
  return (
    <nav aria-label={manual.titulo} className="rounded-tarjeta bg-white p-5 shadow-tarjeta">
      <Link href={rutaDeManual(manual.perfil)} className="mb-4 block text-[13px] leading-snug font-semibold text-navy-700 hover:underline">
        ← {manual.titulo}
      </Link>
      <div className="flex flex-col gap-4">
        {manual.capitulos.map((capitulo) => (
          <div key={capitulo.id}>
            <div className="mb-1.5 text-[11px] leading-none font-semibold tracking-[.07em] text-sutil uppercase">{capitulo.titulo}</div>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {capitulo.articulos.map((a) => {
                const activa = a.slug === actual;
                return (
                  <li key={a.slug}>
                    <Link
                      href={rutaDeArticulo(manual.perfil, a.slug)}
                      aria-current={activa ? "page" : undefined}
                      className={cn(
                        "block rounded-lg px-2.5 py-1.5 text-[13.5px] leading-snug transition-colors hover:bg-navy-50/70 hover:text-navy-700",
                        activa ? "bg-navy-50 font-semibold text-navy-700" : "text-tinta-2",
                      )}
                    >
                      {a.titulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <Link href={`${rutaDeManual(manual.perfil)}#preguntas`} className="rounded-lg px-2.5 py-1.5 text-[13.5px] leading-snug font-semibold text-tinta-2 hover:bg-navy-50/70 hover:text-navy-700">
          Preguntas frecuentes
        </Link>
      </div>
    </nav>
  );
}
