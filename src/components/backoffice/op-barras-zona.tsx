import { DOCENTES_POR_BUSQUEDA_MINIMO, DOCENTES_POR_BUSQUEDA_OK, listaLegible } from "@/lib/backoffice-operacion";
import { plural } from "@/lib/busquedas";
import type { NivelZona, ZonaOperacion } from "@/lib/queries/backoffice-operacion";
import { cn } from "@/lib/utils";

const COLOR: Record<NivelZona, string> = { ok: "bg-navy-700", justo: "bg-[#F0B400]", falta: "bg-naranja" };
const LEYENDA: { nivel: NivelZona; texto: string }[] = [
  { nivel: "ok", texto: `Hay oferta (${DOCENTES_POR_BUSQUEDA_OK} o más profesionales por búsqueda)` },
  { nivel: "justo", texto: "Justo" },
  { nivel: "falta", texto: `Falta oferta (menos de ${DOCENTES_POR_BUSQUEDA_MINIMO} por búsqueda)` },
];

/**
 * "Docentes por zona" frente a las búsquedas abiertas. La barra es la cantidad de docentes (relativa a la zona con más);
 * el color sale de cuántos docentes hay por cada búsqueda abierta. Un docente cuenta en cada partido donde trabaja.
 */
export function OpBarrasZona({ zonas, sinZona }: { zonas: ZonaOperacion[]; sinZona: number }) {
  const maximo = Math.max(1, ...zonas.map((z) => z.docentes));
  const faltantes = zonas.filter((z) => z.nivel === "falta").map((z) => z.zona);

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {zonas.map((z) => (
          <li key={z.zona} className="flex items-center gap-2.5">
            <span className="w-[116px] flex-none">
              <span className="block truncate text-[13px] leading-tight text-tinta-2">{z.zona}</span>
              <span className="block text-[11.5px] leading-tight text-sutil">
                {z.busquedas === 0 ? "sin búsquedas abiertas" : plural(z.busquedas, "búsqueda abierta", "búsquedas abiertas")}
              </span>
            </span>
            <span
              role="img"
              aria-label={`${z.zona}: ${plural(z.docentes, "profesional", "profesionales")} y ${plural(z.busquedas, "búsqueda abierta", "búsquedas abiertas")}`}
              className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0EFEA]"
            >
              <span className={cn("block h-full rounded-full", COLOR[z.nivel])} style={{ width: `${(z.docentes / maximo) * 100}%` }} />
            </span>
            <span className="w-9 flex-none text-right text-[13px] leading-none font-semibold tabular-nums">{z.docentes}</span>
          </li>
        ))}
      </ul>

      <ul className="m-0 mt-3.5 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11.5px] leading-tight text-sutil">
        {LEYENDA.map((l) => (
          <li key={l.nivel} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 flex-none rounded-full", COLOR[l.nivel])} />
            {l.texto}
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "mt-3.5 rounded-lg px-3.5 py-3 text-[13px] leading-normal",
          faltantes.length > 0 ? "bg-naranja-tint text-naranja-ink" : "bg-verde-tint text-verde",
        )}
      >
        {faltantes.length > 0
          ? `${listaLegible(faltantes)}: hay búsquedas abiertas sin profesionales suficientes. Sumar oferta ahí.`
          : "Todas las zonas tienen profesionales de sobra para las búsquedas abiertas."}
        {sinZona > 0 && (
          <span className="mt-1 block text-xs opacity-80">
            {plural(sinZona, "búsqueda abierta no menciona", "búsquedas abiertas no mencionan")} una zona del catálogo y no entra en este cálculo.
          </span>
        )}
      </div>
    </>
  );
}
