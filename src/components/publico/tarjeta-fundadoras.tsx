import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import type { CuposDeFundadoras } from "@/lib/queries/fundadoras";

/** Lo que reciben las instituciones fundadoras. El valor no se dice: lo define el equipo en Planes y se conversa con cada una. */
export const BENEFICIOS_FUNDADORA = [
  "Insignia de «Institución fundadora» en tu perfil público",
  "Tu logo en la portada del sitio, entre las primeras instituciones",
  "Un valor de fundadora, mientras seas parte de UNIDOAR",
  "Todo lo del abono: búsquedas ilimitadas, sin comisión por contratación",
];

/**
 * Tarjeta de «Fundadoras» de /planes: las primeras N instituciones. **No lleva precio** (decisión del cliente): dice cuántos lugares quedan y qué
 * beneficios tienen. Se dibuja solo mientras queden lugares.
 */
export function TarjetaFundadoras({ cupos }: { cupos: CuposDeFundadoras }) {
  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-tarjeta border border-navy-700/10 bg-celeste px-8 py-9 text-navy-700 max-[1179px]:col-span-2 max-[800px]:col-span-1 max-[560px]:px-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[70px] -right-[60px] size-[230px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.7),transparent_70%)]"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-xs leading-none font-semibold tracking-[.08em] text-navy-700/70 uppercase">Fundadoras</h2>
        <span className="rounded-full bg-navy-700 px-2.5 py-[5px] text-xs leading-none font-semibold text-white">
          Quedan {cupos.quedan} de {cupos.total}
        </span>
      </div>
      <div className="relative flex flex-1 flex-col min-[801px]:max-[1179px]:grid min-[801px]:max-[1179px]:grid-cols-2 min-[801px]:max-[1179px]:gap-x-10">
        <div>
          <div className="mt-4 mb-1 font-display text-[40px] leading-none font-bold tracking-[-0.03em] max-[560px]:text-[34px]">
            Las primeras {cupos.total}
          </div>
          <p className="mb-5 text-sm leading-normal text-navy-700/75">
            Las instituciones que se suman ahora quedan como fundadoras: un valor preferencial y el reconocimiento de haber estado desde el día uno.
          </p>
        </div>
        <ul className="m-0 flex flex-1 list-none flex-col gap-3 p-0 text-sm leading-normal text-navy-700 min-[801px]:max-[1179px]:mt-4">
          {BENEFICIOS_FUNDADORA.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-navy-700/12">
                <Icono nombre="tilde" tamano={11} trazo={2.6} />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>
      <BotonLink
        href={RUTA_REGISTRO_INSTITUCION}
        variante="cta"
        tamano="lg"
        bloque
        className="relative mt-[26px] h-[50px] bg-navy-700 text-white shadow-[0_4px_10px_rgba(22,33,79,.25)] hover:bg-navy-700 hover:text-white hover:brightness-125"
      >
        Quiero ser fundadora
      </BotonLink>
    </article>
  );
}
