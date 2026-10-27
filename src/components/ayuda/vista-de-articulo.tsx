import type { ArticuloDeAyuda, CapituloDeAyuda, ManualDeAyuda } from "@/lib/ayuda";
import { BloquesDeAyuda } from "./bloques";
import { MenuDelManual } from "./menu-del-manual";
import { VecinosDeArticulo } from "./vecinos-de-articulo";

/**
 * Una guía con el menú de su manual al costado (arriba de todo, en pantallas angostas va después) y «Anterior / Siguiente» al final. La usan el sitio
 * público y el backoffice: cada uno pone alrededor su propio marco.
 */
export function VistaDeArticulo({ manual, capitulo, articulo }: { manual: ManualDeAyuda; capitulo: CapituloDeAyuda; articulo: ArticuloDeAyuda }) {
  return (
    <div className="grid grid-cols-[270px_minmax(0,1fr)] items-start gap-7 max-[900px]:grid-cols-1">
      <div className="min-[901px]:sticky min-[901px]:top-6 max-[900px]:order-2">
        <MenuDelManual manual={manual} actual={articulo.slug} />
      </div>
      <article className="min-w-0 rounded-tarjeta bg-white p-9 shadow-tarjeta max-[560px]:p-5">
        <div className="mb-2 text-[11.5px] leading-none font-semibold tracking-[.07em] text-sutil uppercase">{capitulo.titulo}</div>
        <h1 className="font-display m-0 mb-2 text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-navy-900 max-[560px]:text-[25px]">{articulo.titulo}</h1>
        <p className="m-0 mb-7 text-[16px] leading-[1.55] text-apagado">{articulo.resumen}</p>
        <BloquesDeAyuda bloques={articulo.bloques} />
        <VecinosDeArticulo manual={manual} slug={articulo.slug} />
      </article>
    </div>
  );
}
