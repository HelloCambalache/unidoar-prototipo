import Link from "next/link";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIAS, CATEGORIA_INFO } from "@/lib/catalogo";
import { focoDeFoto } from "@/lib/fotos";
import { num, plural } from "@/lib/publico";
import type { ConteoCategoria } from "@/lib/queries/publico";
import { CATEGORIAS_PUBLICAS } from "./categorias";

/** Las tres tarjetas altas de categoría (landing y /categorias), con el conteo real de cada una. */
export function TarjetasCategoria({ conteos }: { conteos: Record<CategoriaDocente, ConteoCategoria> }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 p-0">
      {CATEGORIAS.map((c) => {
        const info = CATEGORIA_INFO[c];
        const pub = CATEGORIAS_PUBLICAS[c];
        const n = conteos[c];
        return (
          <li key={c} className="grid">
            <Link
              href={pub.ruta}
              className="group relative block h-[520px] overflow-hidden rounded-[30px] bg-white shadow-tarjeta transition-[transform,box-shadow] duration-[250ms] hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(4,11,53,.22)] focus-visible:ring-[3px] focus-visible:ring-navy-700/40 focus-visible:outline-none"
            >
              <span
                aria-hidden
                style={{ backgroundImage: `url("${pub.fotoTarjeta}")`, backgroundPosition: focoDeFoto(pub.fotoTarjeta) }}
                className="absolute inset-0 bg-cover bg-no-repeat"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,14,30,.05)_0%,rgba(10,14,30,.55)_55%,rgba(10,14,30,.92)_100%)]"
              />
              <span className="relative flex h-full flex-col items-center justify-end p-7 pb-8 text-center text-white">
                <span aria-hidden style={{ background: info.color }} className="mb-3.5 h-1 w-10 rounded-full" />
                <span className="font-display mb-2 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em]">{pub.nombre}</span>
                <span className="text-base leading-normal">{pub.descripcionTarjeta}</span>
                {(n.verificados > 0 || n.busquedasActivas > 0) && (
                  <span className="mt-3.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[13px] leading-snug font-medium text-white/80">
                    {n.verificados > 0 && <span>{plural(n.verificados, "verificado", "verificados")}</span>}
                    {n.busquedasActivas > 0 && (
                      <span>
                        {num(n.busquedasActivas)} {n.busquedasActivas === 1 ? "búsqueda activa" : "búsquedas activas"}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
