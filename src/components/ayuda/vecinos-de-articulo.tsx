import Link from "next/link";
import { rutaDeArticulo, vecinosDe, type ManualDeAyuda } from "@/lib/ayuda";

/** «Anterior» y «Siguiente»: la guía de antes y la de después, en el orden en que se lee el manual. */
export function VecinosDeArticulo({ manual, slug }: { manual: ManualDeAyuda; slug: string }) {
  const { anterior, siguiente } = vecinosDe(manual, slug);
  if (!anterior && !siguiente) return null;
  const tarjeta =
    "flex flex-col gap-1 rounded-tarjeta bg-white p-4 shadow-tarjeta transition-shadow hover:shadow-tarjeta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700";
  return (
    <nav aria-label="Otras guías" className="mt-10 grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
      {anterior ? (
        <Link href={rutaDeArticulo(manual.perfil, anterior.slug)} rel="prev" className={tarjeta}>
          <span className="text-xs font-semibold text-sutil">← Anterior</span>
          <span className="text-[14.5px] leading-snug font-semibold text-tinta">{anterior.titulo}</span>
        </Link>
      ) : (
        <span />
      )}
      {siguiente && (
        <Link href={rutaDeArticulo(manual.perfil, siguiente.slug)} rel="next" className={`${tarjeta} text-right max-[560px]:text-left`}>
          <span className="text-xs font-semibold text-sutil">Siguiente →</span>
          <span className="text-[14.5px] leading-snug font-semibold text-tinta">{siguiente.titulo}</span>
        </Link>
      )}
    </nav>
  );
}
