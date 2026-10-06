import Link from "next/link";
import type { LogoInstitucion } from "@/lib/queries/publico";
import { Imagen } from "./imagen";

/** Pocas instituciones: se repiten dentro de cada copia para que la tira siempre llene el ancho. */
const MINIMO_POR_COPIA = 9;

/** Tira "Confían en UNIDOAR": logos de instituciones verificadas en marquee continuo. */
export function TiraLogos({ logos }: { logos: LogoInstitucion[] }) {
  if (logos.length === 0) return null;
  const repeticiones = Math.ceil(MINIMO_POR_COPIA / logos.length);
  const copia = Array.from({ length: repeticiones }, () => logos).flat();

  return (
    <section
      aria-label="Instituciones que confían en UNIDOAR"
      className="overflow-hidden border-y border-borde bg-superficie py-9"
    >
      <h2 className="mb-[22px] text-center text-xs leading-none font-medium tracking-[.08em] text-sutil uppercase">
        Confían en UNIDOAR
      </h2>
      <div className="w-full overflow-hidden">
        <div className="pub-marquee-logos flex w-max items-center">
          {[0, 1].map((n) => (
            <ul
              key={n}
              aria-hidden={n === 1 || undefined}
              className="m-0 flex flex-none list-none items-center gap-[72px] p-0 pr-[72px]"
            >
              {copia.map((l, i) => (
                <li key={`${l.id}-${i}`}>
                  <Link
                    href={`/instituciones/${l.slug}`}
                    tabIndex={n === 1 ? -1 : undefined}
                    title={l.nombre}
                    className="block rounded opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-navy-700/40 focus-visible:outline-none focus-visible:grayscale-0"
                  >
                    <Imagen src={l.logoUrl} alt={l.nombre} className="h-12 w-auto object-contain" />
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
