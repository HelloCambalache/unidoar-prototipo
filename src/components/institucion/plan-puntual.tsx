import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { fechaCorta } from "@/lib/fechas";
import { pesos } from "@/lib/planes";
import { ETIQUETA_DE_CREDITO, type EstadoDeCredito } from "@/lib/puntual";
import type { CreditoVista } from "@/lib/queries/puntuales";

const TONO: Record<EstadoDeCredito, "verde" | "azul" | "neutro" | "ambar"> = {
  disponible: "verde",
  "en-curso": "azul",
  vencida: "neutro",
  cerrada: "neutro",
};

/**
 * «Tus búsquedas puntuales» (Plan y facturación de una institución sin abono): cuántas búsquedas pagadas tiene, cuántas abiertas, la vigencia, qué
 * incluye y no incluye su plan, y cada pago con en qué está. Para publicar otra se paga la tarifa: el pago lo registra el equipo (Contacto).
 */
export function PlanPuntual({
  creditos,
  disponibles,
  abiertas,
  vigenciaDias,
  precio,
  incluyeCursos,
  incluyeBuscador,
}: {
  creditos: CreditoVista[];
  disponibles: number;
  abiertas: number;
  vigenciaDias: number;
  /** Lo que cuesta una búsqueda para esta institución, ya escrito ("$ 110.000"). */
  precio: string;
  incluyeCursos: boolean;
  incluyeBuscador: boolean;
}) {
  const noIncluye = [!incluyeCursos && "la difusión de cursos", !incluyeBuscador && "el buscador y la base de profesionales"].filter(Boolean) as string[];

  return (
    <Tarjeta como="section" className="mt-5 max-w-[980px] p-[22px]" aria-labelledby="puntual-titulo">
      <h2 id="puntual-titulo" className="m-0 mb-1 text-base leading-tight font-semibold">
        Tus búsquedas puntuales
      </h2>
      <p className="m-0 mb-4 text-sm leading-normal text-apagado">
        Tu plan no tiene abono mensual: pagás cada búsqueda ({precio}). Una vez pagada, la publicás y queda abierta {vigenciaDias} días; pasado ese plazo se
        cierra sola.
      </p>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[150px] flex-1 rounded-interno bg-superficie px-4 py-3">
          <div className="font-display text-[26px] leading-none font-bold text-tinta">{disponibles}</div>
          <div className="mt-1 text-[13px] leading-snug text-apagado">{disponibles === 1 ? "búsqueda pagada para publicar" : "búsquedas pagadas para publicar"}</div>
        </div>
        <div className="min-w-[150px] flex-1 rounded-interno bg-superficie px-4 py-3">
          <div className="font-display text-[26px] leading-none font-bold text-tinta">{abiertas}</div>
          <div className="mt-1 text-[13px] leading-snug text-apagado">{abiertas === 1 ? "búsqueda abierta ahora" : "búsquedas abiertas ahora"}</div>
        </div>
      </div>

      {noIncluye.length > 0 && (
        <p className="m-0 mb-4 text-[13px] leading-normal text-apagado">No incluye {noIncluye.join(" ni ")}: son parte del abono mensual.</p>
      )}

      {creditos.length > 0 && (
        <ul className="m-0 mb-4 flex list-none flex-col p-0">
          {creditos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-linea py-3 first:border-t-0 first:pt-0">
              <div className="min-w-0 text-sm leading-snug">
                <span className="font-semibold text-tinta">{c.busqueda ? c.busqueda.puesto : "Búsqueda sin publicar"}</span>
                <span className="block text-[13px] text-apagado">
                  Pagada el {fechaCorta(c.pagadoEn)} · {pesos(c.monto)}
                  {c.usadoEn && c.venceEn ? ` · ${c.estado === "vencida" ? "venció" : "vence"} el ${fechaCorta(c.venceEn)}` : ""}
                </span>
              </div>
              <Insignia tono={TONO[c.estado]}>{ETIQUETA_DE_CREDITO[c.estado]}</Insignia>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {disponibles > 0 && (
          <BotonLink href="/institucion/publicar" variante="primario">
            Publicar mi búsqueda
          </BotonLink>
        )}
        <BotonLink href="/contacto" variante="secundario">
          {disponibles > 0 ? "Abonar otra búsqueda" : "Abonar una búsqueda"}
        </BotonLink>
        <span className="text-[13px] leading-normal text-sutil">Escribinos y, apenas registremos el pago, la habilitamos.</span>
      </div>
    </Tarjeta>
  );
}
