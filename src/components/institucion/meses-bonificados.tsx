import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ETIQUETA_DE_MES, mesesTexto, resumenDeMeses, type EstadoDeMes } from "@/lib/bonificacion";
import { etiquetaPeriodo } from "@/lib/cobros";
import { fechaCorta } from "@/lib/fechas";
import { pesos } from "@/lib/planes";
import type { MesVista } from "@/lib/queries/bonificaciones";

const TONO: Record<EstadoDeMes, "verde" | "azul" | "neutro" | "ambar"> = {
  disponible: "verde",
  usado: "azul",
  "a-devolver": "ambar",
  devuelto: "neutro",
};

/** Lo que dice cada mes de lo que pasó con él (el nombre de quien se recomendó y, si hubo un cobro, qué pasa con la plata). */
function detalleDeMes(m: MesVista) {
  const partes: string[] = [];
  if (m.recomendada) partes.push(`Por recomendar a ${m.recomendada}`);
  if (m.estado === "usado") partes.push("No se te facturó ese mes");
  if (m.estado === "a-devolver") partes.push(`Mercado Pago cobró${m.monto ? ` ${pesos(m.monto)}` : ""} y te lo devolvemos`);
  if (m.estado === "devuelto") partes.push(`Te devolvimos el cobro${m.monto ? ` de ${pesos(m.monto)}` : ""}${m.devueltoEn ? ` el ${fechaCorta(m.devueltoEn)}` : ""}`);
  if (m.estado === "disponible") partes.push("Se descuenta de tu próxima factura");
  return partes.join(" · ");
}

/**
 * «Tus meses bonificados» (Referidos y Plan y facturación): los meses sin cargo que ganó por recomendar a otra institución cuando paga mes a mes.
 * Cada uno se descuenta de la próxima factura; con débito automático el cobro se devuelve. No se muestra si nunca tuvo ninguno.
 */
export function MesesBonificados({ meses, className }: { meses: MesVista[]; className?: string }) {
  if (meses.length === 0) return null;
  const r = resumenDeMeses(meses);

  return (
    <Tarjeta como="section" className={className ?? "p-[22px]"} aria-labelledby="meses-bonificados-titulo">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="meses-bonificados-titulo" className="m-0 text-base leading-tight font-semibold">
          Tus meses bonificados
        </h2>
        <span className="text-[13px] text-apagado">
          {r.disponibles} {r.disponibles === 1 ? "disponible" : "disponibles"} · {r.usados} {r.usados === 1 ? "usado" : "usados"}
        </span>
      </div>
      {r.disponibles > 0 && (
        <p className="m-0 mb-3 text-sm leading-normal text-tinta-2">
          Tenés {mesesTexto(r.disponibles)} sin cargo por recomendar a otras instituciones. Se descuentan solos de tus próximas facturas; si pagás con débito automático,
          Mercado Pago cobra igual y te devolvemos lo cobrado.
        </p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {meses.map((m) => (
          <li key={m.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t border-linea py-3 first:border-t-0 first:pt-0">
            <div className="min-w-0 text-sm leading-snug">
              <span className="font-semibold text-tinta">{m.periodo ? etiquetaPeriodo(m.periodo) : "Mes sin usar"}</span>
              <span className="block text-[13px] text-apagado">{detalleDeMes(m)}</span>
            </div>
            <Insignia tono={TONO[m.estado]}>{ETIQUETA_DE_MES[m.estado]}</Insignia>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
