import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CompartirReferido } from "@/components/institucion/compartir-referido";
import { MesesBonificados } from "@/components/institucion/meses-bonificados";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirInstitucion } from "@/lib/auth";
import { mesesBonificadosTexto, mesesTexto, TEXTO_DEL_TOPE } from "@/lib/bonificacion";
import { fechaCorta } from "@/lib/fechas";
import { mesesDe } from "@/lib/queries/bonificaciones";
import { codigoDeInstitucion, referidosDe } from "@/lib/queries/referidos";
import { planes } from "@/lib/queries/planes";
import { beneficioDeReferido, INFO_ESTADO_REFERIDO, resumenDeReferidos, rutaDeReferido } from "@/lib/referidos";
import { origenSitio } from "@/lib/sitio";

export const metadata: Metadata = { title: "Referidos" };
export const dynamic = "force-dynamic";

const PASOS = [
  "Le mandás tu enlace a una institución que todavía no usa UNIDOAR.",
  "Crea su cuenta de institución con ese enlace: queda anotada como recomendada por la tuya.",
  "El equipo la verifica y, cuando paga su primera factura, tu beneficio queda listo.",
  "Lo aplicamos nosotros: te suma meses bonificados, que se descuentan de tus facturas (de a uno por semestre).",
];

export default async function Referidos() {
  const { institucion } = await requerirInstitucion();
  const [codigo, referidos, P, origen, mesesGanados] = await Promise.all([
    codigoDeInstitucion(institucion.id),
    referidosDe(institucion.id),
    planes(),
    origenSitio(),
    mesesDe(institucion.id),
  ]);
  const url = `${origen}${rutaDeReferido(codigo)}`;
  const b = beneficioDeReferido(P.condiciones.pack);
  const resumen = resumenDeReferidos(referidos.map((r) => r.estado));
  // Los meses bonificados por cada recomendación (0: el equipo no los ofrece por ahora).
  const mesesPorRecomendacion = P.condiciones.referidoMesesMensual;
  const ofreceMeses = mesesPorRecomendacion > 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Referidos"
        bajada="Recomendá UNIDOAR a otra institución y, cuando se suma a la red, tenés un beneficio en tu plan."
      />

      <div className="flex max-w-[980px] flex-col gap-4">
        <Tarjeta como="section" className="p-[22px]">
          <h2 className="m-0 mb-1 text-base leading-tight font-semibold">Tu enlace para recomendar</h2>
          <p className="m-0 mb-4 text-sm leading-normal text-apagado">
            Mandáselo a un colega de otra institución. No hace falta que le pidas nada más: con crear su cuenta por este enlace alcanza.
          </p>
          <CompartirReferido url={url} codigo={codigo} />
        </Tarjeta>

        <Tarjeta como="section" className="p-[22px]">
          <h2 className="m-0 mb-1 text-base leading-tight font-semibold">Qué ganás</h2>
          {ofreceMeses ? (
            <>
              <p className="m-0 mb-2 text-sm leading-normal text-tinta-2">
                Por cada institución que recomendás y se suma a la red, ganás{" "}
                <b className="font-semibold text-tinta">{mesesBonificadosTexto(mesesPorRecomendacion)}</b>:
              </p>
              <ul className="m-0 mb-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-normal text-tinta-2">
                <li>Si pagás mes a mes, ese mes no se te factura (con débito automático, te devolvemos lo cobrado).</li>
                <li>
                  Si pagás el semestre de contado, te sale un mes menos: pagás <b className="font-semibold text-tinta">{b.pagaConReferido}</b> meses en lugar de{" "}
                  {b.pagaSinReferido}.
                </li>
              </ul>
              <p className="m-0 mb-4 text-sm leading-normal text-tinta-2">{TEXTO_DEL_TOPE}</p>
            </>
          ) : (
            <p className="m-0 mb-4 text-sm leading-normal text-tinta-2">
              Por cada institución que recomendás y se suma a la red, en el pack de {b.mesesDelPack} meses por adelantado pagás{" "}
              <b className="font-semibold text-tinta">{b.pagaConReferido}</b> en lugar de {b.pagaSinReferido}
              {b.mesesDeMenos > 0 ? `: ${mesesTexto(b.mesesDeMenos)} menos` : ""}.
            </p>
          )}
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {PASOS.map((paso, i) => (
              <li key={paso} className="flex items-start gap-3 text-sm leading-normal text-tinta-2">
                <span
                  aria-hidden
                  className="mt-px inline-flex size-6 flex-none items-center justify-center rounded-full bg-navy-50 text-xs font-semibold text-navy-700"
                >
                  {i + 1}
                </span>
                {paso}
              </li>
            ))}
          </ol>
          <p className="m-0 mt-4 text-xs leading-normal text-apagado">
            El beneficio se aplica una vez que la institución recomendada pagó su primera factura y lo carga el equipo. Una cuenta no puede
            recomendarse a sí misma ni a otra institución de la misma persona.
          </p>
        </Tarjeta>

        <MesesBonificados meses={mesesGanados} />


        <Tarjeta como="section" className="p-[22px]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="m-0 text-base leading-tight font-semibold">Tus recomendaciones</h2>
            {resumen.total > 0 && (
              <span className="text-[13px] text-apagado">
                {resumen.total} {resumen.total === 1 ? "recomendada" : "recomendadas"} · {resumen.enLaRed} en la red
              </span>
            )}
          </div>

          {referidos.length === 0 ? (
            <EstadoVacio
              titulo="Todavía no recomendaste a nadie"
              texto="Cuando una institución cree su cuenta con tu enlace, la vas a ver acá con el paso en el que está."
            />
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {referidos.map((r) => {
                const info = INFO_ESTADO_REFERIDO[r.estado];
                return (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t border-linea py-3.5 first:border-t-0 first:pt-0">
                    <div className="min-w-0">
                      <div className="text-[15px] leading-tight font-semibold text-tinta">
                        <Link href={`/instituciones/${r.institucion.slug}`} className="text-tinta hover:text-navy-700 hover:underline">
                          {r.institucion.nombre}
                        </Link>
                      </div>
                      <p className="m-0 mt-1 text-[13px] leading-snug text-apagado">
                        {info.significado} · Se registró el {fechaCorta(r.creadoEn)}
                        {r.beneficioTipo === "meses" && r.meses
                          ? ` · ${mesesBonificadosTexto(r.meses.total)} (${r.meses.usados} ${r.meses.usados === 1 ? "usado" : "usados"})`
                          : r.beneficioTipo === "pack"
                            ? " · aplicado en tu pack por adelantado"
                            : ""}
                      </p>
                    </div>
                    <Insignia tono={info.tono} className="flex-none">
                      {info.etiqueta}
                    </Insignia>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
