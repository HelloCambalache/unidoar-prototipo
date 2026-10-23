import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { ReferidoBeneficio } from "@/components/backoffice/referido-beneficio";
import { ReferidoDevolucion } from "@/components/backoffice/referido-devolucion";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/auth";
import { mesesBonificadosTexto, puedeBonificarMeses } from "@/lib/bonificacion";
import { etiquetaPeriodo } from "@/lib/cobros";
import { fechaCorta } from "@/lib/fechas";
import { pesos } from "@/lib/planes";
import { listarDevoluciones } from "@/lib/queries/bonificaciones";
import { planes } from "@/lib/queries/planes";
import { listarReferidosBackoffice, type ReferidoBackoffice } from "@/lib/queries/referidos";
import { INFO_ESTADO_REFERIDO, puedeAplicarBeneficio, puedeDeshacerBeneficio, resumenDeReferidos, type EstadoReferido } from "@/lib/referidos";

export const metadata: Metadata = { title: "Referidos · Backoffice" };
export const dynamic = "force-dynamic";

const FILTROS = [
  { clave: "para-aplicar", etiqueta: "Para aplicar", estados: ["pago"] },
  { clave: "en-curso", etiqueta: "En curso", estados: ["registrada", "verificada"] },
  { clave: "aplicados", etiqueta: "Aplicados", estados: ["beneficio"] },
  { clave: "todos", etiqueta: "Todos", estados: ["registrada", "verificada", "pago", "beneficio"] },
] as const satisfies readonly { clave: string; etiqueta: string; estados: readonly EstadoReferido[] }[];
type ClaveFiltro = (typeof FILTROS)[number]["clave"];
const DEVOLUCIONES = "devoluciones";

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Cómo se aplicó el beneficio de una recomendación, para la línea de abajo del nombre. */
function textoDeAplicado(r: ReferidoBackoffice) {
  if (!r.beneficioEn) return "";
  const cuando = `Beneficio aplicado el ${fechaCorta(r.beneficioEn)}`;
  if (r.beneficioTipo === "meses" && r.meses) return ` · ${cuando}: ${mesesBonificadosTexto(r.meses.total)} (${r.meses.usados} ${r.meses.usados === 1 ? "usado" : "usados"})`;
  return ` · ${cuando}: pack por adelantado`;
}

export default async function ReferidosBackoffice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // El layout ya lo exige, pero acá se leen datos de las cuentas: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const sp = await searchParams;
  const enDevoluciones = uno(sp.estado) === DEVOLUCIONES;
  const filtro: ClaveFiltro = FILTROS.find((f) => f.clave === uno(sp.estado))?.clave ?? "para-aplicar";
  const [todos, devoluciones, P] = await Promise.all([listarReferidosBackoffice(), listarDevoluciones(), planes()]);
  const resumen = resumenDeReferidos(todos.map((r) => r.estado));
  const pendientesDeDevolver = devoluciones.filter((d) => !d.devueltoEn).length;
  const cantidades: Record<ClaveFiltro, number> = {
    "para-aplicar": resumen.paraAplicar,
    "en-curso": resumen.registradas + resumen.verificadas,
    aplicados: resumen.conBeneficio,
    todos: resumen.total,
  };
  const estados: readonly EstadoReferido[] = FILTROS.find((f) => f.clave === filtro)!.estados;
  const lista = todos.filter((r) => estados.includes(r.estado));
  const mesesPorRecomendacion = P.condiciones.referidoMesesMensual;

  return (
    <>
      <EncabezadoPagina
        titulo="Referidos"
        bajada="Instituciones que recomendaron a otras con su enlace. Cuando la recomendada paga su primera factura, la que recomendó tiene su beneficio: lo aplicás desde acá, como meses bonificados (si paga mes a mes) o como pack por adelantado."
      />
      <Pestanas
        className="mb-4"
        activa={enDevoluciones ? DEVOLUCIONES : filtro}
        items={[
          ...FILTROS.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, cantidad: cantidades[f.clave], href: `/backoffice/referidos?estado=${f.clave}` })),
          { clave: DEVOLUCIONES, etiqueta: "Devoluciones", cantidad: pendientesDeDevolver, href: `/backoffice/referidos?estado=${DEVOLUCIONES}` },
        ]}
      />

      {enDevoluciones ? (
        devoluciones.length === 0 ? (
          <EstadoVacio
            titulo="No hay devoluciones"
            texto="Cuando una institución con débito automático tiene un mes bonificado, Mercado Pago igual cobra: acá aparece el cobro para devolverlo desde Mercado Pago."
          />
        ) : (
          <>
            <p className="m-0 mb-3 max-w-[760px] text-[13px] leading-normal text-apagado">
              Mercado Pago cobró estos meses aunque estaban bonificados por recomendar. Devolvé cada cobro desde tu cuenta de Mercado Pago (buscalo por el número de
              pago) y marcalo acá: la institución recibe el aviso.
            </p>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {devoluciones.map((d) => (
                <Tarjeta como="li" key={d.id} className="p-[18px]">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0">
                      <div className="text-[15px] leading-snug text-tinta-2">
                        <Link href={`/backoffice/cobros/${d.institucion.id}`} className="font-semibold text-tinta hover:text-navy-700 hover:underline">
                          {d.institucion.nombre}
                        </Link>{" "}
                        · {etiquetaPeriodo(d.periodo)}
                      </div>
                      <p className="m-0 mt-1 text-[13px] leading-snug text-apagado">
                        {d.monto ? `Mercado Pago cobró ${pesos(d.monto)}` : "Cobro sin monto registrado"}
                        {d.pagoId ? ` · pago ${d.pagoId}` : ""}
                        {d.recomendada ? ` · mes bonificado por recomendar a ${d.recomendada}` : ""}
                        {d.devueltoEn ? ` · devuelto el ${fechaCorta(d.devueltoEn)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-none flex-wrap items-center gap-2.5">
                      <Insignia tono={d.devueltoEn ? "azul" : "neutro"}>{d.devueltoEn ? "Devuelto" : "A devolver"}</Insignia>
                      <ReferidoDevolucion mesId={d.id} devuelto={!!d.devueltoEn} />
                    </div>
                  </div>
                </Tarjeta>
              ))}
            </ul>
          </>
        )
      ) : lista.length === 0 ? (
        <EstadoVacio
          titulo={
            filtro === "para-aplicar"
              ? resumen.total === 0
                ? "Todavía no hay recomendaciones"
                : "No hay beneficios para aplicar"
              : "No hay recomendaciones en esta lista"
          }
          texto={
            filtro === "para-aplicar" && resumen.total > 0
              ? "Todo lo que ya pagó tiene su beneficio aplicado."
              : "Cuando una institución cree su cuenta con el enlace de otra, aparece acá."
          }
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {lista.map((r) => {
            const info = INFO_ESTADO_REFERIDO[r.estado];
            const motivoSinMeses = puedeBonificarMeses(P.esPuntual(r.referidor.plan))
              ? null
              : "Esta institución no paga mes a mes (búsqueda puntual): el beneficio se aplica como pack por adelantado.";
            return (
              <Tarjeta como="li" key={r.id} className="p-[18px]">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <div className="text-[15px] leading-snug text-tinta-2">
                      <Link href={`/backoffice/instituciones/${r.referidor.id}`} className="font-semibold text-tinta hover:text-navy-700 hover:underline">
                        {r.referidor.nombre}
                      </Link>{" "}
                      recomendó a{" "}
                      <Link href={`/backoffice/instituciones/${r.referido.id}`} className="font-semibold text-tinta hover:text-navy-700 hover:underline">
                        {r.referido.nombre}
                      </Link>
                    </div>
                    <p className="m-0 mt-1 text-[13px] leading-snug text-apagado">
                      Se registró el {fechaCorta(r.creadoEn)}
                      {textoDeAplicado(r)}
                    </p>
                    {puedeAplicarBeneficio(r.estado) && (
                      <p className="m-0 mt-1 text-[13px] leading-snug text-apagado">
                        {r.referidor.nombre}: {motivoSinMeses ?? (r.referidor.conDebito ? "paga con débito automático (cada mes bonificado se devuelve a mano)." : "paga mes a mes sin débito automático (los meses bonificados no se facturan).")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-none flex-wrap items-center gap-2.5">
                    <Insignia tono={info.tono}>{info.etiqueta}</Insignia>
                    {(puedeAplicarBeneficio(r.estado) || puedeDeshacerBeneficio(r.estado)) && (
                      <ReferidoBeneficio
                        referidoId={r.id}
                        aplicado={r.estado === "beneficio"}
                        mesesPorRecomendacion={mesesPorRecomendacion}
                        motivoSinMeses={motivoSinMeses}
                        conDebito={r.referidor.conDebito}
                        referidor={r.referidor.nombre}
                      />
                    )}
                  </div>
                </div>
              </Tarjeta>
            );
          })}
        </ul>
      )}
    </>
  );
}
