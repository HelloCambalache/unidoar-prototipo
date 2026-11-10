import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { comprobantesPago, creditosBusqueda, facturas, instituciones } from "@/db/schema";
import { etiquetaDeCobertura } from "@/lib/cobros";
import { numeroDeComprobante } from "@/lib/facturacion";
import { filtrarPagosPorAdjunto, filtrarPagosPorInstitucion, medioDelPago, ordenarPagos, type FiltrosDePagos, type PagoDelReporte } from "@/lib/pagos-reporte";

/*
 * Lectura del reporte de pagos del backoffice (Cobros → Pagos). Reúne en una sola lista todos los pagos que entraron en el rango pedido: cada factura
 * PAGA (la mensual, el semestre al contado, un cobro del débito automático o del pago del semestre por Mercado Pago: todos dejan su factura paga) y cada
 * búsqueda puntual pagada (que no es una factura). Solo lectura: no toca nada. Las reglas (filtros, totales, CSV) están en `src/lib/pagos-reporte.ts`.
 */

const ZONA = "America/Argentina/Buenos_Aires";

/** Tope duro de filas que se leen por cada origen (facturas y búsquedas): un rango de años enteros no debería poder agotar la memoria del servidor. */
const MAX_FILAS_POR_ORIGEN = 20_000;

/** Los pagos que cumplen los filtros, del más nuevo al más viejo. Corre siempre con `requerirUsuario("admin")` en quien llama. */
export async function pagosDelReporte(filtros: FiltrosDePagos): Promise<PagoDelReporte[]> {
  const db = getDb();

  // El día del pago en hora de Argentina (la fecha de `pagada_en` está en UTC: un pago de las 22:00 es del día de hoy y no de mañana).
  const diaDeFactura = sql<string>`to_char(coalesce(${facturas.pagadaEn}, ${facturas.creadoEn}) at time zone ${ZONA}, 'YYYY-MM-DD')`;
  const diaDeCredito = sql<string>`to_char(${creditosBusqueda.pagadoEn} at time zone ${ZONA}, 'YYYY-MM-DD')`;

  const [deFacturas, deBusquedas] = await Promise.all([
    db
      .select({
        id: facturas.id,
        dia: diaDeFactura,
        institucionId: instituciones.id,
        institucion: instituciones.nombre,
        cuit: instituciones.cuit,
        periodo: facturas.periodo,
        meses: facturas.mesesCubiertos,
        plan: facturas.plan,
        medio: facturas.medio,
        monto: facturas.monto,
        adjuntoId: comprobantesPago.id,
        adjuntoNombre: comprobantesPago.nombre,
      })
      .from(facturas)
      .innerJoin(instituciones, eq(instituciones.id, facturas.institucionId))
      .leftJoin(comprobantesPago, eq(comprobantesPago.facturaId, facturas.id))
      .where(
        and(
          eq(facturas.estado, "pagada"),
          sql`${diaDeFactura} between ${filtros.desde} and ${filtros.hasta}`,
          filtros.conEjemplo ? undefined : eq(instituciones.esDemo, false),
        ),
      )
      .limit(MAX_FILAS_POR_ORIGEN),
    db
      .select({
        id: creditosBusqueda.id,
        dia: diaDeCredito,
        institucionId: instituciones.id,
        institucion: instituciones.nombre,
        cuit: instituciones.cuit,
        medio: creditosBusqueda.medio,
        monto: creditosBusqueda.monto,
        adjuntoId: comprobantesPago.id,
        adjuntoNombre: comprobantesPago.nombre,
      })
      .from(creditosBusqueda)
      .innerJoin(instituciones, eq(instituciones.id, creditosBusqueda.institucionId))
      .leftJoin(comprobantesPago, eq(comprobantesPago.creditoId, creditosBusqueda.id))
      .where(
        and(sql`${diaDeCredito} between ${filtros.desde} and ${filtros.hasta}`, filtros.conEjemplo ? undefined : eq(instituciones.esDemo, false)),
      )
      .limit(MAX_FILAS_POR_ORIGEN),
  ]);

  const todos: PagoDelReporte[] = [
    ...deFacturas.map((r) => ({
      clave: `f:${r.id}`,
      pagoId: r.id,
      fecha: r.dia,
      institucionId: r.institucionId,
      institucion: r.institucion,
      cuit: r.cuit,
      tipo: "factura" as const,
      concepto: etiquetaDeCobertura(r.periodo, r.meses),
      plan: r.plan,
      medio: medioDelPago(r.medio),
      monto: r.monto,
      comprobante: numeroDeComprobante(r.id),
      adjunto: r.adjuntoId ? { id: r.adjuntoId, nombre: r.adjuntoNombre ?? "" } : null,
    })),
    ...deBusquedas.map((r) => ({
      clave: `p:${r.id}`,
      pagoId: r.id,
      fecha: r.dia,
      institucionId: r.institucionId,
      institucion: r.institucion,
      cuit: r.cuit,
      tipo: "puntual" as const,
      concepto: "Búsqueda puntual",
      plan: "puntual",
      medio: medioDelPago(r.medio),
      monto: r.monto,
      comprobante: null,
      adjunto: r.adjuntoId ? { id: r.adjuntoId, nombre: r.adjuntoNombre ?? "" } : null,
    })),
  ];

  // El medio y el nombre se filtran acá (y no en la consulta) para que «Sin dato» y las tildes se comporten igual que en el resto de la app.
  const delMedio = filtros.medio ? todos.filter((p) => p.medio === filtros.medio) : todos;
  return ordenarPagos(filtrarPagosPorAdjunto(filtrarPagosPorInstitucion(delMedio, filtros.q), filtros.adjunto));
}
