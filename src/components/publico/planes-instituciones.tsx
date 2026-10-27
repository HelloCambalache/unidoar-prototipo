"use client";

import { Icono } from "@/components/icons";
import { usePlanElegido } from "@/components/publico/elegir-plan";
import { BotonLink } from "@/components/ui/button";
import { crearPlanes, pesos, type CatalogoDePlanes, type Planes, type PlanClave } from "@/lib/planes";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { cn } from "@/lib/utils";

/** Cómo se llama cada arancel en los botones: corto, para que entren en una línea. */
const etiquetaDe = (P: Planes, clave: PlanClave) =>
  clave === "colegio"
    ? "Colegios"
    : clave === "deportiva"
      ? "Clubes y gimnasios"
      : clave === "multisede"
        ? `${P.condiciones.sedesMultisede} sedes o más`
        : clave === "puntual"
          ? "Una sola búsqueda"
          : P.planDe(clave).label;

/** Lo que incluye (y lo que no) la búsqueda puntual, con lo que fijó el equipo en Planes. */
function beneficiosPuntual(P: Planes) {
  const { vigenciaDias, incluyeCursos, incluyeBuscador } = P.condiciones.puntual;
  const noIncluye = [!incluyeBuscador && "el buscador de profesionales", !incluyeCursos && "la difusión de cursos"].filter(Boolean) as string[];
  return {
    incluye: [
      `Tu búsqueda publicada ${vigenciaDias} días`,
      "Avisamos a los profesionales que encajan con el puesto",
      "Recibís las postulaciones y las movés por etapas hasta contratar",
      "Sin abono mensual y sin comisión por contratación",
    ],
    noIncluye: noIncluye.length > 0 ? `No incluye ${noIncluye.join(" ni ")}.` : null,
  };
}

/** "1 mes" · "2 meses" */
const meses = (n: number) => `${n} ${n === 1 ? "mes" : "meses"}`;

/** Los tipos que entran en cada arancel, para que quien elige sepa si es el suyo. */
function detalleDe(P: Planes, clave: PlanClave) {
  if (clave === "multisede" || clave === "puntual") return P.planDe(clave).detalle;
  const tipos = P.tiposPorPlan[clave as keyof typeof P.tiposPorPlan];
  return tipos ? `Incluye ${tipos.join(", ").toLowerCase()}.` : P.planDe(clave).detalle;
}

/**
 * Tarjeta de precio de las instituciones. El arancel depende del tipo, así que en vez de una tarjeta
 * por precio hay una sola con un desplegable: la institución se elige a sí misma y ve lo que paga.
 */
export function PlanesInstituciones({ beneficios, catalogo }: { beneficios: readonly string[]; catalogo: CatalogoDePlanes }) {
  const P = crearPlanes(catalogo);
  // El tipo de institución y cómo se paga el abono (mes a mes o el semestre de una vez: pagás 5 y usás 6) los comparte con el interruptor de
  // arriba de las tarjetas (`InterruptorDePago`), que está fuera de esta tarjeta. El semestre solo aplica a los aranceles con abono.
  const { clave, elegirClave, semestral } = usePlanElegido();
  const plan = P.planDe(clave);
  const pack = P.packDe(clave);
  const { meses: mesesDelPack, mesesQueSePagan } = P.condiciones.pack;
  const puntual = P.esPuntual(clave);
  // Multisede (redes y cadenas) no tiene un precio de lista a la vista: el valor se acuerda según el volumen (convenio corporativo).
  const convenio = plan.porSede;
  const delPuntual = beneficiosPuntual(P);
  const conPack = !puntual && !convenio;
  const verSemestral = conPack && semestral;
  // Una sede adicional por todo el semestre (con su descuento): lo que se suma al pack de la primera sede al sumar una segunda.
  const sedeExtraDelSemestre = P.packDe(clave, 2).anticipado - pack.anticipado;

  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-tarjeta bg-navy-700 px-8 py-9 text-white max-[560px]:px-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[60px] -right-[50px] size-[200px] rounded-full bg-[radial-gradient(circle,rgba(245,147,50,.3),transparent_70%)]"
      />
      <h2 className="relative m-0 text-xs leading-none font-semibold tracking-[.08em] text-celeste uppercase">
        Instituciones
      </h2>

      <div className="relative mt-4">
        <span id="tipo-institucion" className="mb-2 block text-[13px] leading-none text-white/60">
          ¿Qué tipo de institución sos?
        </span>
        <div role="group" aria-labelledby="tipo-institucion" className="flex flex-wrap gap-2">
          {P.vigentes.map((c) => {
            const elegido = c === clave;
            return (
              <button
                key={c}
                type="button"
                onClick={() => elegirClave(c)}
                aria-pressed={elegido}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-2 text-[13px] leading-none font-semibold whitespace-nowrap transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-celeste",
                  elegido ? "bg-white text-navy-700" : "border border-white/25 text-white/75 hover:bg-white/10",
                )}
              >
                {etiquetaDe(P, c)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-5 mb-1">
        {convenio ? (
          <>
            <span className="font-display text-[38px] leading-none font-bold tracking-[-0.03em]">A convenir</span>
            <span className="text-[15px] leading-none text-white/60">&nbsp;según el volumen</span>
          </>
        ) : (
          <>
            <span className="font-display text-[38px] leading-none font-bold tracking-[-0.03em]">{pesos(verSemestral ? pack.anticipado : plan.precio)}</span>
            <span className="text-[15px] leading-none text-white/60">
              &nbsp;{puntual ? "por búsqueda" : verSemestral ? `por ${mesesDelPack} meses` : "/ mes"}
            </span>
          </>
        )}
      </div>
      {verSemestral && (
        <p className="relative m-0 mb-1 text-[13px] leading-normal text-white/80">
          Pagás {mesesQueSePagan} meses y usás {mesesDelPack}: equivale a {pesos(Math.round(pack.anticipado / mesesDelPack))} por mes. Te ahorrás{" "}
          {pesos(pack.lista - pack.anticipado)}.
        </p>
      )}
      <p className="relative mb-5 text-sm leading-normal text-white/65">
        {detalleDe(P, clave)}
        {!puntual && !plan.porSede && P.condiciones.descuentoSedeExtra > 0 && P.condiciones.descuentoSedeExtra < 100 && (
          <>
            {" "}
            <span className="text-white/85">
              {verSemestral
                ? `Cada sede adicional: ${pesos(sedeExtraDelSemestre)} por ${mesesDelPack} meses`
                : `Cada sede adicional: ${pesos(P.precioDeSedeExtra(clave))} por mes`}{" "}
              ({P.condiciones.descuentoSedeExtra} % menos).
            </span>
          </>
        )}
      </p>

      <ul className="relative m-0 flex flex-1 list-none flex-col gap-3 p-0 text-sm leading-normal text-white/85">
        {(puntual ? delPuntual.incluye : beneficios).map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 shrink-0 text-celeste" />
            {b}
          </li>
        ))}
        {puntual && delPuntual.noIncluye && (
          <li className="flex items-start gap-2.5 text-white/60">
            <Icono nombre="cerrar" tamano={16} trazo={2} className="mt-0.5 shrink-0" />
            {delPuntual.noIncluye}
          </li>
        )}
      </ul>

      {puntual ? (
        <div className="relative mt-5 rounded-interno bg-white/8 px-4 py-3.5">
          <div className="text-sm leading-tight font-semibold text-white">Sin abono mensual</div>
          <p className="m-0 mt-1 text-[13px] leading-[1.5] text-white/70">
            Pagás solo cuando necesitás cubrir un puesto. Si después querés buscar de forma continua, pasás a un plan con abono y tenés el buscador de
            profesionales y la difusión de cursos.
          </p>
        </div>
      ) : convenio ? (
        <div className="relative mt-5 rounded-interno bg-white/8 px-4 py-3.5">
          <div className="text-sm leading-tight font-semibold text-white">Convenio corporativo</div>
          <p className="m-0 mt-1 text-[13px] leading-[1.5] text-white/70">
            El valor depende de la cantidad de sedes y de búsquedas. Escribinos y te armamos una propuesta a medida para tu red.
          </p>
        </div>
      ) : (
        <div className="relative mt-5 rounded-interno bg-white/8 px-4 py-3.5">
          <span className="inline-block rounded-full bg-verde-tint px-2.5 py-[5px] text-xs leading-none font-semibold text-verde">
            {meses(mesesDelPack - mesesQueSePagan)} {mesesDelPack - mesesQueSePagan === 1 ? "bonificado" : "bonificados"}
          </span>
          <div className="mt-2.5 text-sm leading-tight font-semibold text-white">{verSemestral ? "Semestre pagado de contado" : "Pago por adelantado"}</div>
          <p className="m-0 mt-1 text-[13px] leading-[1.5] text-white/70">
            {verSemestral ? (
              <>
                Pagás el semestre de una vez, por transferencia o en efectivo, y usás {mesesDelPack} meses:{" "}
                <b className="font-semibold text-white">{pesos(pack.anticipado)}</b> en lugar de {pesos(pack.lista)}. Para pagar mes a mes, elegí «Mensual».
              </>
            ) : (
              <>
                Contratás el pack de {mesesDelPack} meses y pagás {mesesQueSePagan}:{" "}
                <b className="font-semibold text-white">{pesos(pack.anticipado)}</b> en lugar de {pesos(pack.lista)}. Elegí «Semestral» arriba para verlo.
              </>
            )}
          </p>
        </div>
      )}

      <BotonLink
        href={convenio ? "/contacto" : RUTA_REGISTRO_INSTITUCION}
        variante="cta"
        tamano="lg"
        bloque
        className="relative mt-[22px] h-[50px] bg-ambar text-tinta shadow-[0_4px_10px_rgba(245,147,50,.35)] hover:bg-ambar hover:text-tinta hover:brightness-95"
      >
        {convenio ? "Escribinos para armar tu propuesta" : "Crear cuenta de institución"}
      </BotonLink>
    </article>
  );
}
