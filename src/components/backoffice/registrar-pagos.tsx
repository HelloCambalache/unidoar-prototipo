import Link from "next/link";
import { CobroPago, type FacturaParaPago } from "@/components/backoffice/cobro-pago";
import { CobroPagoEfectivo } from "@/components/backoffice/cobro-pago-efectivo";
import { CobroPuntualPago } from "@/components/backoffice/cobro-puntual";
import { CobroSemestre } from "@/components/backoffice/cobro-semestre";
import { Tarjeta } from "@/components/ui/tarjeta";
import { getDb } from "@/db";
import { etiquetaPeriodo, fechaDeColumna, periodoActual, sumarMeses } from "@/lib/cobros";
import { pesos, type PlanClave, type Planes } from "@/lib/planes";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { detalleDeCobros } from "@/lib/queries/backoffice-cobros";
import { cantidadDeSedes } from "@/lib/queries/sedes";

/**
 * Los botones para registrar un pago, en la ficha de la institución (la misma botonera que la ficha de Cobros, sin cargar facturas ni anular
 * pagos, que quedan en Cobros): el pago de la próxima factura, un pago en efectivo, un semestre al contado y, con la búsqueda puntual, el pago
 * de una búsqueda. Lee sus propios datos: la ficha solo le dice de qué institución y de qué plan se trata.
 */
export async function RegistrarPagos({ institucionId, plan, P, debitoVigente }: { institucionId: string; plan: PlanClave; P: Planes; debitoVigente: boolean }) {
  const [detalle, sedes, acuerdo] = await Promise.all([
    detalleDeCobros(institucionId),
    cantidadDeSedes(getDb(), [institucionId]).then((m) => m.get(institucionId) ?? 1),
    acuerdoDe(getDb(), institucionId),
  ]);
  if (!detalle) return null;

  const { institucion: i, facturas, proximo } = detalle;
  const esPuntual = P.esPuntual(plan);
  const impagas = facturas.filter((f) => f.estado !== "pagada").sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro));
  // Primer mes sin factura: el siguiente al último cargado (o el actual si es más tarde).
  const ultimo = facturas.reduce((m, f) => (f.periodo > m ? f.periodo : m), "");
  const actual = periodoActual();
  const sugerido = ultimo && sumarMeses(ultimo, 1) > actual ? sumarMeses(ultimo, 1) : actual;
  const periodoSugerido = impagas[0]?.periodo ?? sugerido;
  const paraPago = (f: (typeof facturas)[number]): FacturaParaPago => ({
    id: f.id,
    periodo: etiquetaPeriodo(f.periodo),
    monto: pesos(f.monto),
    vence: fechaDeColumna(f.fechaCobro),
    vencida: f.estado === "vencida",
  });

  return (
    <Tarjeta className="flex flex-col gap-2 p-[22px]" aria-labelledby="registrar-pagos-titulo">
      <h2 id="registrar-pagos-titulo" className="m-0 mb-1 text-base leading-tight font-semibold">
        Registrar un pago
      </h2>
      {proximo && (
        <CobroPago factura={paraPago(proximo)} medioInicial={proximo.medio ?? i.medioPago} variante="primario" tamano="md" bloque>
          {`Registrar pago de ${etiquetaPeriodo(proximo.periodo)}`}
        </CobroPago>
      )}
      {!esPuntual && (
        <CobroPagoEfectivo
          institucionId={institucionId}
          sedes={sedes}
          acuerdo={acuerdo}
          catalogo={P.catalogo}
          plan={plan}
          periodoSugerido={periodoSugerido}
          facturas={facturas.map((f) => ({ periodo: f.periodo, pagada: f.estado === "pagada", monto: f.monto }))}
        />
      )}
      {P.planDe(plan).periodo === "mes" && (
        <CobroSemestre
          institucionId={institucionId}
          sedes={sedes}
          acuerdo={acuerdo}
          catalogo={P.catalogo}
          plan={plan}
          periodoSugerido={periodoSugerido}
          facturas={facturas.map((f) => ({ periodo: f.periodo, estado: f.estado, mesesCubiertos: f.mesesCubiertos }))}
          debitoVigente={debitoVigente}
        />
      )}
      {esPuntual && (
        <CobroPuntualPago institucionId={institucionId} monto={pesos(P.montoDePlan(plan, 1, acuerdo))} vigenciaDias={P.condiciones.puntual.vigenciaDias} />
      )}
      <p className="m-0 mt-1 text-xs leading-normal text-sutil">
        Para cargar una factura, anular un pago o ver el detalle,{" "}
        <Link href={`/backoffice/cobros/${institucionId}`} className="font-medium">
          abrí sus cobros →
        </Link>
      </p>
    </Tarjeta>
  );
}
