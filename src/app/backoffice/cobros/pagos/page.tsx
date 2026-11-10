import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { Icono } from "@/components/icons";
import { CobrosSecciones } from "@/components/backoffice/cobros-secciones";
import { ComprobanteDePago } from "@/components/backoffice/comprobante-de-pago";
import { hrefDePagos, PagosFiltros } from "@/components/backoffice/pagos-filtros";
import { botonClases } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/auth";
import { fechaDeColumna, hoyAR } from "@/lib/cobros";
import { diasDelRango, leerFiltrosDePagos, SIN_DATO, totalesDePagos } from "@/lib/pagos-reporte";
import { pesos } from "@/lib/planes";
import { pagosDelReporte } from "@/lib/queries/backoffice-pagos";
import { planes } from "@/lib/queries/planes";

export const metadata: Metadata = { title: "Pagos · Cobros · Backoffice" };
export const dynamic = "force-dynamic";

/** Cuántas filas se dibujan en pantalla: el resto está en el CSV (los totales siempre cuentan todo lo encontrado). */
const FILAS_EN_PANTALLA = 300;

const TONO_DE_MEDIO: Record<string, "azul" | "verde" | "naranja" | "ambar" | "neutro"> = {
  Transferencia: "azul",
  Efectivo: "ambar",
  "Débito automático": "verde",
  "Mercado Pago": "verde",
  Tarjeta: "naranja",
  [SIN_DATO]: "neutro",
};

function Metrica({ valor, etiqueta, nota, color }: { valor: string | number; etiqueta: string; nota?: string; color: string }) {
  return (
    <Tarjeta className="p-4">
      <div style={{ color }} className="text-[22px] leading-none font-semibold">
        {valor}
      </div>
      <div className="mt-1 text-[13px] leading-none text-apagado">{etiqueta}</div>
      {nota && <div className="mt-2 text-xs leading-snug text-sutil">{nota}</div>}
    </Tarjeta>
  );
}

export default async function PagosBackoffice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // El layout ya lo exige, pero acá se leen montos y CUIT: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const hoy = hoyAR();
  const filtros = leerFiltrosDePagos(await searchParams, hoy);
  const [pagos, P] = await Promise.all([pagosDelReporte(filtros), planes()]);
  const { total, cantidad, porMedio } = totalesDePagos(pagos);
  const visibles = pagos.slice(0, FILAS_EN_PANTALLA);
  const dias = diasDelRango(filtros);
  const hayFiltrosExtra = Boolean(filtros.medio || filtros.q || filtros.adjunto);
  const conAdjunto = pagos.filter((p) => p.adjunto).length;
  const hrefCsv = hrefDePagos(filtros, {}, "/backoffice/cobros/pagos/csv");

  return (
    <>
      <EncabezadoPagina
        titulo="Planes y cobros"
        bajada="Todo lo que se cobró, de cualquier institución y por cualquier medio, con el método de pago de cada uno."
        acciones={
          <a href={hrefCsv} className={botonClases({ variante: "secundario" })}>
            <Icono nombre="descargar" tamano={16} trazo={2} />
            Descargar CSV
          </a>
        }
      />
      <CobrosSecciones activa="pagos" />
      <PagosFiltros filtros={filtros} hoy={hoy} />

      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Metrica
          valor={pesos(total)}
          etiqueta="Total cobrado"
          color="#16214F"
          nota={`${fechaDeColumna(filtros.desde)} al ${fechaDeColumna(filtros.hasta)} · ${dias} ${dias === 1 ? "día" : "días"}`}
        />
        <Metrica valor={cantidad} etiqueta={cantidad === 1 ? "Pago registrado" : "Pagos registrados"} color="#0E6577" nota={hayFiltrosExtra ? "Con los filtros elegidos" : "Sin filtros de método ni institución"} />
        <Metrica
          valor={cantidad > 0 ? `${conAdjunto} de ${cantidad}` : "—"}
          etiqueta="Con comprobante de pago adjunto"
          color="#8F3D28"
          nota={cantidad > conAdjunto ? `Faltan ${cantidad - conAdjunto}: filtrá «Sin comprobante» para verlos` : cantidad > 0 ? "Todos tienen su comprobante" : undefined}
        />
      </div>

      <section aria-labelledby="medios-titulo" className="mb-6">
        <EtiquetaSeccion className="mb-3" id="medios-titulo">
          Por método de pago
        </EtiquetaSeccion>
        {porMedio.length === 0 ? (
          <p className="text-[13.5px] text-apagado">No hay pagos en este rango, así que no hay nada que repartir por método.</p>
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Método</th>
                <th className="text-right">Pagos</th>
                <th className="text-right">Monto</th>
                <th className="text-right">% del total</th>
                <th>
                  <span className="sr-only">Ver</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {porMedio.map((m) => (
                <tr key={m.medio}>
                  <td>
                    <Insignia tono={TONO_DE_MEDIO[m.medio] ?? "neutro"}>{m.medio}</Insignia>
                  </td>
                  <td className="text-right tabular-nums">{m.cantidad}</td>
                  <td className="text-right whitespace-nowrap tabular-nums">{pesos(m.monto)}</td>
                  <td className="text-right tabular-nums">{total > 0 ? `${Math.round((m.monto / total) * 100)} %` : "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    {filtros.medio === m.medio ? (
                      <Link href={hrefDePagos(filtros, { medio: "" })} className="text-[13px] font-medium">
                        Ver todos los métodos
                      </Link>
                    ) : (
                      <Link href={hrefDePagos(filtros, { medio: m.medio })} className="text-[13px] font-medium">
                        Ver solo estos →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </section>

      <section aria-labelledby="pagos-titulo">
        <EtiquetaSeccion className="mb-3" id="pagos-titulo">
          Detalle de pagos{cantidad > 0 && ` · ${cantidad}`}
        </EtiquetaSeccion>
        {pagos.length === 0 ? (
          <EstadoVacio
            titulo="No hay pagos con estos filtros"
            texto={
              hayFiltrosExtra
                ? "Probá sacando el método o la institución, o ampliando las fechas."
                : "Probá con otro rango de fechas. Los pagos de instituciones de ejemplo no se cuentan salvo que lo tildes."
            }
          />
        ) : (
          <>
            <Tabla>
              <thead>
                <tr>
                  <th>Fecha de pago</th>
                  <th>Institución</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th className="text-right">Monto</th>
                  <th>N.º (UNIDOAR)</th>
                  <th>Comprobante de pago</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.clave}>
                    <td className="whitespace-nowrap">{fechaDeColumna(p.fecha)}</td>
                    <td>
                      <Link href={`/backoffice/cobros/${p.institucionId}`} className="font-semibold text-tinta hover:text-naranja">
                        {p.institucion}
                      </Link>
                      <span className="block text-xs text-sutil">{P.nombreDePlan(p.plan)}</span>
                    </td>
                    <td>{p.concepto}</td>
                    <td>
                      <Insignia tono={TONO_DE_MEDIO[p.medio] ?? "neutro"}>{p.medio}</Insignia>
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">{pesos(p.monto)}</td>
                    <td className="whitespace-nowrap text-[13px] text-apagado">{p.comprobante ?? <span className="text-sutil">—</span>}</td>
                    <td>
                      <ComprobanteDePago destino={{ tipo: p.tipo, id: p.pagoId }} comprobante={p.adjunto} descripcion={`${p.concepto} de ${p.institucion}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
            {pagos.length > visibles.length && (
              <p className="mt-3 text-[13px] text-apagado">
                Se muestran los {visibles.length} pagos más recientes de {pagos.length}. Los totales de arriba cuentan todos y el CSV los trae completos.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
