import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { ESTADO_FACTURA } from "@/lib/facturacion";
import { pesos } from "@/lib/planes";
import type { FacturaVista } from "@/lib/queries/plan";

/** Historial de facturación: una fila por cobro, con su estado y la hoja imprimible para descargar. */
export function PlanHistorial({ facturas }: { facturas: FacturaVista[] }) {
  return (
    <section aria-labelledby="historial-facturacion" className="max-w-[980px]">
      <h2 id="historial-facturacion" className="m-0 mt-7 mb-3 text-base leading-[1.2] font-semibold tracking-[-0.01em]">
        Historial de facturación
      </h2>
      {facturas.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no tenés facturas"
          texto="Cuando se genere el primer cobro de tu plan, aparece acá con su estado y podés descargar el comprobante."
        />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Período</th>
              <th>Fecha de cobro</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Comprobante</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((f) => {
              const estado = ESTADO_FACTURA[f.estado];
              return (
                <tr key={f.id}>
                  <td>
                    <div className="font-medium">{f.periodo}</div>
                    <div className="text-xs text-apagado">{f.planLabel}</div>
                  </td>
                  <td className="whitespace-nowrap">{f.fechaCobro}</td>
                  <td className="whitespace-nowrap">{pesos(f.monto)}</td>
                  <td>
                    <Insignia tono={estado.tono}>{estado.texto}</Insignia>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/institucion/plan/facturas/${f.id}?imprimir=1`}
                      aria-label={`Descargar el comprobante de ${f.periodo}`}
                      className="text-[13px] leading-none font-medium text-navy-700 hover:underline"
                    >
                      Descargar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      )}
    </section>
  );
}
