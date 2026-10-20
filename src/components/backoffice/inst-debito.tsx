import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { etiquetaPeriodo } from "@/lib/cobros";
import { ETIQUETA_SUSCRIPCION } from "@/lib/debito-automatico";
import { fechaCorta } from "@/lib/fechas";
import { pesos } from "@/lib/planes";
import type { DebitoParaBackoffice } from "@/lib/queries/suscripcion-backoffice";

const TONO_SUSCRIPCION = { autorizada: "verde", pendiente: "ambar", pausada: "naranja", cancelada: "neutro" } as const;
const COBRO: Record<string, { texto: string; tono: "verde" | "naranja" | "ambar" | "neutro" }> = {
  aprobado: { texto: "Cobrado", tono: "verde" },
  rechazado: { texto: "Rechazado", tono: "naranja" },
  pendiente: { texto: "En proceso", tono: "ambar" },
  cancelado: { texto: "Cancelado", tono: "neutro" },
};

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2.5 text-[13px] leading-[1.4]">
      <span className="flex-none text-apagado">{k}</span>
      <span className="min-w-0 text-right text-tinta [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/**
 * "Débito automático" de la ficha de una institución en el backoffice: en qué estado está la suscripción de Mercado Pago, cuándo cobra y los
 * últimos cobros (con los rechazos a la vista). Es solo lectura: se cancela desde la tarjeta de la institución o al suspenderla o darla de baja.
 */
export function InstDebito({ debito }: { debito: DebitoParaBackoffice }) {
  const { suscripcion, cobros } = debito;
  return (
    <Tarjeta className="p-[22px]">
      <EtiquetaSeccion className="mb-3">Débito automático</EtiquetaSeccion>
      {!suscripcion ? (
        <p className="m-0 text-[13px] leading-[1.5] text-apagado">
          {cobros.length > 0 ? "No tiene un débito automático vigente." : "No activó el débito automático."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Dato k="Estado">
            <Insignia tono={TONO_SUSCRIPCION[suscripcion.estado]} punto>
              {ETIQUETA_SUSCRIPCION[suscripcion.estado]}
            </Insignia>
          </Dato>
          <Dato k="Cobra por mes">{pesos(suscripcion.monto)}</Dato>
          {suscripcion.estado === "autorizada" && suscripcion.proximoCobro && <Dato k="Próximo cobro">{suscripcion.proximoCobro}</Dato>}
          <Dato k="Desde">{fechaCorta(suscripcion.desde)}</Dato>
          {suscripcion.email && <Dato k="Cuenta de Mercado Pago">{suscripcion.email}</Dato>}
        </div>
      )}
      {cobros.length > 0 && (
        <ul className="m-0 mt-3.5 flex list-none flex-col gap-2 border-t border-borde p-0 pt-3.5">
          {cobros.map((c) => {
            const estado = COBRO[c.resultado] ?? { texto: c.resultado, tono: "neutro" as const };
            return (
              <li key={c.id} className="flex items-center justify-between gap-2.5 text-[13px] leading-[1.4]">
                <span className="min-w-0 text-tinta-2">
                  {c.periodo ? etiquetaPeriodo(c.periodo) : "Cobro"}
                  {c.monto ? ` · ${pesos(c.monto)}` : ""}
                  {c.resultado === "rechazado" && c.intento > 0 ? <span className="text-apagado"> · intento {c.intento}</span> : null}
                </span>
                <Insignia tono={estado.tono}>{estado.texto}</Insignia>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}
