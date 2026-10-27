import Link from "next/link";
import { logosEnMovimiento } from "@/lib/publico";
import type { LogoInstitucion } from "@/lib/queries/publico";
import { Imagen } from "./imagen";

/** Pocas instituciones (pero las suficientes para que corra): se repiten dentro de cada copia para que la tira siempre llene el ancho. */
const MINIMO_POR_COPIA = 9;

function Logo({ logo, escondido = false }: { logo: LogoInstitucion; escondido?: boolean }) {
  return (
    <Link
      href={`/instituciones/${logo.slug}`}
      tabIndex={escondido ? -1 : undefined}
      title={logo.nombre}
      className="block rounded opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-navy-700/40 focus-visible:outline-none focus-visible:grayscale-0"
    >
      <Imagen src={logo.logoUrl} alt={logo.nombre} className="h-12 w-auto object-contain" />
    </Link>
  );
}

/**
 * Tira "Confían en UNIDOAR": los logos de las instituciones fundadoras (ver `logosInstituciones`). Con varios corre como un marquee continuo; con
 * pocos —al principio, las primeras fundadoras— se muestran quietos y centrados, cada uno una sola vez.
 */
export function TiraLogos({ logos }: { logos: LogoInstitucion[] }) {
  if (logos.length === 0) return null;
  const enMovimiento = logosEnMovimiento(logos.length);
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
      {enMovimiento ? (
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
                    <Logo logo={l} escondido={n === 1} />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-[72px] gap-y-6 p-0 px-6">
          {logos.map((l) => (
            <li key={l.id}>
              <Logo logo={l} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
