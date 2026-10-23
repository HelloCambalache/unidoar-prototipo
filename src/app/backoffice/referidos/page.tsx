import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { ReferidoBeneficio } from "@/components/backoffice/referido-beneficio";
import { Insignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/auth";
import { fechaCorta } from "@/lib/fechas";
import { listarReferidosBackoffice } from "@/lib/queries/referidos";
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

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ReferidosBackoffice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // El layout ya lo exige, pero acá se leen datos de las cuentas: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const sp = await searchParams;
  const filtro: ClaveFiltro = FILTROS.find((f) => f.clave === uno(sp.estado))?.clave ?? "para-aplicar";
  const todos = await listarReferidosBackoffice();
  const resumen = resumenDeReferidos(todos.map((r) => r.estado));
  const cantidades: Record<ClaveFiltro, number> = {
    "para-aplicar": resumen.paraAplicar,
    "en-curso": resumen.registradas + resumen.verificadas,
    aplicados: resumen.conBeneficio,
    todos: resumen.total,
  };
  const estados: readonly EstadoReferido[] = FILTROS.find((f) => f.clave === filtro)!.estados;
  const lista = todos.filter((r) => estados.includes(r.estado));

  return (
    <>
      <EncabezadoPagina
        titulo="Referidos"
        bajada="Instituciones que recomendaron a otras con su enlace. Cuando la recomendada paga su primera factura, la que recomendó tiene su beneficio: lo aplicás al facturar y lo marcás acá."
      />
      <Pestanas
        className="mb-4"
        activa={filtro}
        items={FILTROS.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, cantidad: cantidades[f.clave], href: `/backoffice/referidos?estado=${f.clave}` }))}
      />

      {lista.length === 0 ? (
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
                      {r.beneficioEn ? ` · Beneficio aplicado el ${fechaCorta(r.beneficioEn)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-none flex-wrap items-center gap-2.5">
                    <Insignia tono={info.tono}>{info.etiqueta}</Insignia>
                    {(puedeAplicarBeneficio(r.estado) || puedeDeshacerBeneficio(r.estado)) && (
                      <ReferidoBeneficio referidoId={r.id} aplicado={r.estado === "beneficio"} />
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
