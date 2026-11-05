import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BuscadorLista } from "@/components/backoffice/buscador-lista";
import { CobroMarcarVencidas } from "@/components/backoffice/cobro-marcar-vencidas";
import { CobroPedidos } from "@/components/backoffice/cobro-pedidos";
import { InsigniaCobro } from "@/components/backoffice/inst-insignias";
import { FilaClicable } from "@/components/docente/fila-clicable";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tabla } from "@/components/ui/tabla";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { filtrarPorNombre } from "@/lib/buscar-por-nombre";
import { etiquetaPeriodo, fechaDeColumna, type EstadoCobro } from "@/lib/cobros";
import { haceTiempo } from "@/lib/fechas";
import { pesos } from "@/lib/planes";
import { pedidosDePlanPendientes, tablaDeCobros } from "@/lib/queries/backoffice-cobros";
import { planes } from "@/lib/queries/planes";

export const metadata: Metadata = { title: "Planes y cobros · Backoffice" };
export const dynamic = "force-dynamic";

const FILTROS: { clave: EstadoCobro | "todas"; etiqueta: string }[] = [
  { clave: "todas", etiqueta: "Todas" },
  { clave: "vencida", etiqueta: "Vencidas" },
  { clave: "pendiente", etiqueta: "Pendientes" },
  { clave: "aldia", etiqueta: "Al día" },
];

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

export default async function CobrosBackoffice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // El layout ya lo exige, pero acá se leen datos sensibles: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const sp = await searchParams;
  const pedido = Array.isArray(sp.estado) ? sp.estado[0] : sp.estado;
  const filtro = FILTROS.find((f) => f.clave === pedido)?.clave ?? "todas";
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80) ?? "";

  const [{ resumen, filas: todasLasFilas }, pedidos, P] = await Promise.all([tablaDeCobros(), pedidosDePlanPendientes(), planes()]);
  const ahora = new Date();
  // La lupa busca por el nombre de la institución; las pestañas cuentan lo que se encontró (el resumen de arriba sigue siendo de todas).
  const filas = filtrarPorNombre(todasLasFilas, q);
  const cantidades: Record<EstadoCobro | "todas", number> = {
    todas: filas.length,
    vencida: filas.filter((f) => f.estado === "vencida").length,
    pendiente: filas.filter((f) => f.estado === "pendiente").length,
    aldia: filas.filter((f) => f.estado === "aldia").length,
  };
  const visibles = filtro === "todas" ? filas : filas.filter((f) => f.estado === filtro);
  const hrefDe = (estado: string) => {
    const p = new URLSearchParams();
    if (estado !== "todas") p.set("estado", estado);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/backoffice/cobros?${qs}` : "/backoffice/cobros";
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Planes y cobros"
        bajada="Los pagos se registran a mano: todavía no hay una pasarela conectada. Las facturas de cada mes se crean solas para las cuentas que ya tienen una cargada."
        acciones={<CobroMarcarVencidas cantidad={resumen.sinMarcar} />}
      />

      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Metrica valor={pesos(resumen.mrr)} etiqueta="MRR" color="#16214F" nota="Suma mensual de los planes activos" />
        <Metrica valor={resumen.suscripcionesActivas} etiqueta="Suscripciones activas" color="#0E6577" nota="Instituciones no suspendidas" />
        <Metrica
          valor={resumen.vencidos.cantidad}
          etiqueta="Pagos vencidos"
          color="#8F3D28"
          nota={resumen.vencidos.cantidad > 0 ? `${pesos(resumen.vencidos.monto)} sin cobrar` : "Nada vencido"}
        />
      </div>

      <section id="pedidos" aria-labelledby="pedidos-titulo" className="mb-6 scroll-mt-4">
        <EtiquetaSeccion className="mb-3" id="pedidos-titulo">
          Pedidos de cambio de plan{pedidos.length > 0 && ` · ${pedidos.length}`}
        </EtiquetaSeccion>
        <CobroPedidos
          catalogo={P.catalogo}
          pedidos={pedidos.map((p) => ({
            id: p.id,
            institucionId: p.institucionId,
            institucion: p.institucion,
            planActual: p.planActual,
            planSolicitado: p.planSolicitado,
            planVigente: p.planVigente,
            cuando: haceTiempo(p.creadoEn, ahora),
          }))}
        />
      </section>

      <section aria-labelledby="cobros-titulo">
        <EtiquetaSeccion className="mb-3" id="cobros-titulo">
          Cobros por institución
        </EtiquetaSeccion>
        <BuscadorLista
          accion="/backoffice/cobros"
          q={q}
          conservar={{ estado: filtro === "todas" ? "" : filtro }}
          etiqueta="Buscar institución por nombre"
          placeholder="Buscar institución por nombre"
        />
        <Pestanas
          className="mb-3.5"
          activa={filtro}
          items={FILTROS.map((f) => ({
            clave: f.clave,
            etiqueta: f.etiqueta,
            cantidad: cantidades[f.clave],
            href: hrefDe(f.clave),
          }))}
        />
        {visibles.length === 0 ? (
          <EstadoVacio
            titulo={
              q && filas.length === 0
                ? "No encontramos ninguna institución con ese nombre"
                : todasLasFilas.length === 0
                  ? "Todavía no hay instituciones"
                  : "No hay instituciones en este estado"
            }
            texto={q && filas.length === 0 ? "Revisá cómo está escrito o probá con una sola palabra del nombre." : todasLasFilas.length === 0 ? undefined : "Probá con otra pestaña."}
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Institución</th>
                <th>Monto</th>
                <th>Próximo cobro</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <FilaClicable key={f.institucionId} href={`/backoffice/cobros/${f.institucionId}`}>
                  <td>
                    <Link href={`/backoffice/cobros/${f.institucionId}`} className="font-semibold text-tinta hover:text-naranja">
                      {f.nombre}
                    </Link>
                    {f.suspendida && (
                      <Insignia tono="naranja" className="ml-2">
                        Suspendida
                      </Insignia>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{P.precioDePlan(f.plan)}</td>
                  <td>
                    {f.proximo ? (
                      <>
                        {fechaDeColumna(f.proximo.fechaCobro)}
                        <span className="block text-xs text-sutil">
                          {etiquetaPeriodo(f.proximo.periodo)} · {pesos(f.proximo.monto)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sutil">—</span>
                    )}
                  </td>
                  <td>
                    <InsigniaCobro estado={f.estado} />
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Link href={`/backoffice/cobros/${f.institucionId}`} className="text-[13px] font-medium">
                      Ver historial →
                    </Link>
                  </td>
                </FilaClicable>
              ))}
            </tbody>
          </Tabla>
        )}
      </section>
    </>
  );
}
