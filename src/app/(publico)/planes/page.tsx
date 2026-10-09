import type { Metadata } from "next";
import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import {
  PACK_LANZAMIENTO,
  packDe,
  pesos,
  PLANES,
  SEDES_MULTISEDE,
  TIPOS_POR_PLAN,
  type PlanClave,
} from "@/lib/planes";
import { CUPOS_FUNDADOR, RUTA_REGISTRO_DOCENTE, RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { cuposFundadorRestantes } from "@/lib/queries/publico";

export const metadata: Metadata = {
  title: "Planes y aranceles",
  description:
    "Para los profesionales UNIDOAR es gratis, siempre. Las instituciones pagan una suscripción mensual según su tipo, sin comisión por contratación.",
};

// Los cupos de institución fundadora salen de la base: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

const BENEFICIOS_DOCENTE = [
  "Perfil con identidad y título verificados",
  "Postulate en dos toques a búsquedas de tu zona",
  "CV leído automáticamente, sin formularios eternos",
  "Sin comisiones, sin intermediarios y sin letra chica",
];

const BENEFICIOS_INSTITUCION = [
  "Búsquedas ilimitadas, sin comisión por contratación",
  "Búsquedas urgentes para cubrir una suplencia el mismo día",
  "Catálogo completo de profesionales de tu zona",
  "Pipeline de contratación: quién contestó, a quién le ofreciste el puesto",
  "Perfil vitrina para que los profesionales te encuentren",
  "Cupos de equipo para invitar a quien contrata con vos",
];

/** Las dos tarjetas de arancel: el precio sale del tipo de institución, no de lo que elija. */
const ARANCELES: { clave: Extract<PlanClave, "colegio" | "deportiva">; titulo: string }[] = [
  { clave: "colegio", titulo: "Colegios" },
  { clave: "deportiva", titulo: "Clubes y academias" },
];

export default async function Planes() {
  const cupos = await cuposFundadorRestantes();
  const hayCupos = cupos > 0;

  return (
    <>
      <section className="bg-[linear-gradient(180deg,#F4F3EF_0%,#FAFAF8_100%)] px-12 pt-16 pb-14 text-center max-[560px]:px-6">
        <span className="inline-block rounded-full bg-rosa-tint px-2.5 py-[5px] text-xs leading-none font-semibold text-rosa">
          Disponible en todo el país
        </span>
        <h1 className="mx-auto mt-3.5 mb-3.5 max-w-[22ch] text-[42px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance text-tinta max-[560px]:text-[30px]">
          Planes y aranceles
        </h1>
        <p className="mx-auto max-w-[660px] text-[17px] leading-[1.6] text-apagado">
          Para los profesionales UNIDOAR es gratis, siempre. Las instituciones pagan una suscripción mensual según su
          tipo: sin comisión por contratación y sin costo por publicación.
        </p>
      </section>

      <section className="mx-auto w-full max-w-[1200px] flex-1 px-12 pb-16 max-[560px]:px-5">
        {/* ── Profesionales ───────────────────────────────────────────── */}
        <article className="flex flex-wrap items-center gap-8 rounded-[14px] border border-borde bg-white px-8 py-9 max-[560px]:px-6">
          <div className="min-w-[260px] flex-1">
            <h2 className="m-0 text-xs leading-none font-semibold tracking-[.08em] text-navy-300 uppercase">
              Profesionales
            </h2>
            <div className="mt-3.5 mb-1 text-[38px] leading-none font-bold tracking-[-0.02em] text-tinta">
              100% gratis
            </div>
            <p className="mb-0 max-w-[46ch] text-sm leading-normal text-apagado">
              Para siempre. Creá tu perfil, verificá tus títulos y postulate a las búsquedas de tu zona. Tu talento no
              tiene costo.
            </p>
            <BotonLink href={RUTA_REGISTRO_DOCENTE} variante="secundario" tamano="lg" className="mt-[26px]">
              Soy profesional
            </BotonLink>
          </div>
          <ul className="m-0 grid min-w-[280px] flex-1 list-none grid-cols-2 gap-x-6 gap-y-3 p-0 text-sm leading-normal text-tinta-2 max-[760px]:grid-cols-1">
            {BENEFICIOS_DOCENTE.map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 shrink-0 text-navy-700" />
                {b}
              </li>
            ))}
          </ul>
        </article>

        {/* ── Instituciones ───────────────────────────────────────────── */}
        <h2 className="mt-14 mb-1.5 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-tinta">
          Para instituciones
        </h2>
        <p className="m-0 mb-7 max-w-[70ch] text-[15px] leading-[1.6] text-apagado">
          Un modelo simple y sin comisiones por contratación. El arancel depende del tipo de institución; lo que incluye
          es lo mismo para todas.
        </p>

        <div className="flex flex-wrap items-stretch gap-6">
          {ARANCELES.map(({ clave, titulo }) => {
            const plan = PLANES[clave];
            const pack = packDe(clave);
            return (
              <article
                key={clave}
                className="relative flex min-w-[300px] flex-1 flex-col overflow-hidden rounded-[14px] bg-navy-700 px-8 py-9 text-white max-[560px]:px-6"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-[60px] -right-[50px] size-[200px] rounded-full bg-[radial-gradient(circle,rgba(245,147,50,.3),transparent_70%)]"
                />
                <h3 className="relative m-0 text-xs leading-none font-semibold tracking-[.08em] text-celeste uppercase">
                  {titulo}
                </h3>
                <div className="relative mt-4 mb-1">
                  <span className="text-[38px] leading-none font-bold tracking-[-0.02em]">{pesos(plan.precio)}</span>
                  <span className="text-[15px] leading-none text-white/60">&nbsp;/ mes</span>
                </div>
                <p className="relative mb-5 text-sm leading-normal text-white/65">{plan.detalle}</p>
                <ul className="relative m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-normal text-white/80">
                  {TIPOS_POR_PLAN[clave].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Icono nombre="tilde" tamano={15} trazo={2} className="mt-px shrink-0 text-celeste" />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="relative mt-auto mb-0 pt-6 text-[13px] leading-[1.5] text-white/55">
                  Pack de {PACK_LANZAMIENTO.meses} meses por adelantado: {pesos(pack.anticipado)} en lugar de{" "}
                  {pesos(pack.lista)}.
                </p>
              </article>
            );
          })}
        </div>

        <p className="mt-6 mb-0 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-borde bg-white px-6 py-5 text-sm leading-normal text-tinta-2">
          <span>
            <b className="font-semibold text-tinta">{PLANES.multisede.label}</b> · Redes de más de {SEDES_MULTISEDE}{" "}
            sedes: {pesos(PLANES.multisede.precio)} por mes <b className="font-semibold text-tinta">por sede</b>.
          </span>
          <BotonLink href={RUTA_REGISTRO_INSTITUCION} variante="secundario">
            Crear cuenta de institución
          </BotonLink>
        </p>

        {/* ── Qué incluye ─────────────────────────────────────────────── */}
        <div className="mt-6 rounded-[14px] border border-borde bg-superficie px-8 py-7 max-[560px]:px-6">
          <h3 className="m-0 mb-4 text-xs leading-none font-semibold tracking-[.08em] text-navy-300 uppercase">
            Incluido en todos los planes
          </h3>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-8 gap-y-3 p-0 text-sm leading-normal text-tinta-2 max-[760px]:grid-cols-1">
            {BENEFICIOS_INSTITUCION.map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 shrink-0 text-navy-700" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Promociones de lanzamiento ──────────────────────────────── */}
        <h2 className="mt-14 mb-1.5 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-tinta">
          Promociones de lanzamiento
        </h2>
        <p className="m-0 mb-7 max-w-[70ch] text-[15px] leading-[1.6] text-apagado">
          Sobre el pack de {PACK_LANZAMIENTO.meses} meses, y se acumulan: pagando por adelantado y recomendando,
          terminás pagando {PACK_LANZAMIENTO.mesesConReferido} de {PACK_LANZAMIENTO.meses}.
        </p>
        <div className="flex flex-wrap gap-6">
          <article className="min-w-[280px] flex-1 rounded-[14px] border border-borde bg-white px-7 py-6">
            <span className="inline-block rounded-full bg-verde-tint px-2.5 py-[5px] text-xs leading-none font-semibold text-verde">
              1 mes bonificado
            </span>
            <h3 className="mt-3.5 mb-1.5 text-[17px] leading-tight font-semibold text-tinta">Pago por adelantado</h3>
            <p className="m-0 text-sm leading-[1.55] text-apagado">
              Contratás el pack de {PACK_LANZAMIENTO.meses} meses y pagás {PACK_LANZAMIENTO.mesesQueSePagan}.
            </p>
          </article>
          <article className="min-w-[280px] flex-1 rounded-[14px] border border-borde bg-white px-7 py-6">
            <span className="inline-block rounded-full bg-verde-tint px-2.5 py-[5px] text-xs leading-none font-semibold text-verde">
              1 mes más
            </span>
            <h3 className="mt-3.5 mb-1.5 text-[17px] leading-tight font-semibold text-tinta">Plan Referidos</h3>
            <p className="m-0 text-sm leading-[1.55] text-apagado">
              Recomendás a otra institución y se suma a la red: pagás {PACK_LANZAMIENTO.mesesConReferido} de los{" "}
              {PACK_LANZAMIENTO.meses}.
            </p>
          </article>
        </div>

        {/* ── Instituciones fundadoras ────────────────────────────────── */}
        {hayCupos && (
          <div className="relative mt-14 overflow-hidden rounded-[14px] bg-navy-900 px-8 py-9 text-white max-[560px]:px-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-[90px] -right-[60px] size-[260px] rounded-full bg-[radial-gradient(circle,rgba(245,147,50,.34),transparent_70%)]"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <h2 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.02em]">
                Instituciones Fundadoras
              </h2>
              <span className="rounded-full bg-ambar/22 px-3 py-1.5 text-xs leading-none font-semibold text-[#FDD9AE]">
                Quedan {cupos} de {CUPOS_FUNDADOR} cupos
              </span>
            </div>
            <p className="relative mt-3 mb-6 max-w-[70ch] text-[15px] leading-[1.6] text-white/70">
              Las primeras {CUPOS_FUNDADOR} instituciones que se suman entran como fundadoras: tarifa preferencial
              mientras sigan suscriptas y el reconocimiento de haber estado desde el día uno.
            </p>
            <ul className="relative m-0 grid list-none grid-cols-2 gap-x-8 gap-y-3 p-0 text-sm leading-normal text-white/85 max-[760px]:grid-cols-1">
              <li className="flex items-start gap-2.5">
                <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 shrink-0 text-celeste" />
                Tarifa de fundador congelada mientras sigas suscripto
              </li>
              <li className="flex items-start gap-2.5">
                <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 shrink-0 text-celeste" />
                Insignia de Institución Fundadora en tu perfil público
              </li>
              <li className="flex items-start gap-2.5">
                <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 shrink-0 text-celeste" />
                Tu logo en la portada del sitio, entre las que confiaron primero
              </li>
              <li className="flex items-start gap-2.5">
                <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 shrink-0 text-celeste" />
                Las dos promociones de lanzamiento, acumulables
              </li>
            </ul>
            <BotonLink
              href={RUTA_REGISTRO_INSTITUCION}
              variante="cta"
              tamano="lg"
              className="relative mt-7 h-[50px] bg-ambar text-tinta shadow-[0_4px_10px_rgba(245,147,50,.35)] hover:bg-ambar hover:text-tinta hover:brightness-95"
            >
              Quiero ser institución fundadora
            </BotonLink>
          </div>
        )}
      </section>
    </>
  );
}
