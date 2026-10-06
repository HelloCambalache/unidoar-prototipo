import type { Metadata } from "next";
import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import { PLANES, pesos } from "@/lib/planes";
import { CUPOS_FUNDADOR, RUTA_REGISTRO_DOCENTE, RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { cuposFundadorRestantes } from "@/lib/queries/publico";

export const metadata: Metadata = {
  title: "Planes",
  description: "Un solo plan para instituciones, sin comisión por contratación. Para docentes, UNIDOAR es siempre gratis.",
};

// Los cupos del plan Fundador salen de la base: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

const BENEFICIOS_DOCENTE = [
  "Perfil con identidad y título verificados",
  "Postulate en dos toques a búsquedas de tu zona",
  "CV leído automáticamente, sin formularios eternos",
];

const BENEFICIOS_INSTITUCION = [
  "Búsquedas ilimitadas, sin comisión por contratación",
  "Catálogo completo de docentes de tu zona",
  "Pipeline de contratación: quién contestó, a quién le ofreciste el puesto",
  "Perfil vitrina para que los docentes te encuentren",
  "Cupos de equipo para invitar a quien contrata con vos",
];

export default async function Planes() {
  const cupos = await cuposFundadorRestantes();
  const hayCupos = cupos > 0;
  const plan = hayCupos ? PLANES.fundador : PLANES.estandar;

  return (
    <>
      <section className="bg-[linear-gradient(180deg,#F4F3EF_0%,#FAFAF8_100%)] px-12 pt-16 pb-14 text-center max-[560px]:px-6">
        <span className="inline-block rounded-full bg-rosa-tint px-2.5 py-[5px] text-xs leading-none font-semibold text-rosa">
          Disponible en todo el país
        </span>
        <h1 className="mx-auto mt-3.5 mb-3.5 max-w-[24ch] text-[42px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance text-tinta max-[560px]:text-[30px]">
          Un solo plan para instituciones. Docentes, siempre gratis.
        </h1>
        <p className="mx-auto max-w-[640px] text-[17px] leading-[1.6] text-apagado">
          Sin comisión por contratación y sin costo por publicación. Pagás una suscripción mensual y usás el catálogo
          todo lo que necesites.
        </p>
      </section>

      <section className="mx-auto w-full max-w-[1200px] flex-1 px-12 pb-16 max-[560px]:px-5">
        <div className="flex flex-wrap items-stretch gap-6">
          <article className="flex min-w-[300px] flex-1 flex-col rounded-[14px] border border-borde bg-white px-8 py-9 max-[560px]:px-6">
            <h2 className="m-0 text-xs leading-none font-semibold tracking-[.08em] text-navy-300 uppercase">Docentes</h2>
            <div className="mt-3.5 mb-1 text-[38px] leading-none font-bold tracking-[-0.02em] text-tinta">Gratis</div>
            <p className="mb-[22px] text-sm leading-normal text-apagado">Para siempre, sin letra chica.</p>
            <ul className="m-0 flex flex-1 list-none flex-col gap-3 p-0 text-sm leading-normal text-tinta-2">
              {BENEFICIOS_DOCENTE.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 text-navy-700" />
                  {b}
                </li>
              ))}
            </ul>
            <BotonLink href={RUTA_REGISTRO_DOCENTE} variante="secundario" tamano="lg" bloque className="mt-[26px]">
              Soy docente
            </BotonLink>
          </article>

          <article className="relative flex min-w-[320px] flex-[1.15] flex-col overflow-hidden rounded-[14px] bg-navy-700 px-8 py-9 text-white max-[560px]:px-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-[60px] -right-[50px] size-[200px] rounded-full bg-[radial-gradient(circle,rgba(245,147,50,.3),transparent_70%)]"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-xs leading-none font-semibold tracking-[.08em] text-celeste uppercase">
                Instituciones
              </h2>
              <span className="rounded-full bg-ambar/22 px-2.5 py-[5px] text-xs leading-none font-semibold text-[#FDD9AE]">
                {hayCupos ? `Plan Fundador · quedan ${cupos} de ${CUPOS_FUNDADOR} cupos` : plan.label}
              </span>
            </div>
            <div className="relative mt-4 mb-1">
              <span className="text-[38px] leading-none font-bold tracking-[-0.02em]">{pesos(plan.precio)}</span>
              <span className="text-[15px] leading-none text-white/60">&nbsp;/ {plan.periodo}</span>
            </div>
            <p className="relative mb-[22px] text-sm leading-normal text-white/65">
              {hayCupos
                ? `En lugar de ${pesos(PLANES.estandar.precio)}. Precio fijo mientras sigas suscripto.`
                : plan.resumen}
            </p>
            <ul className="relative m-0 flex flex-1 list-none flex-col gap-3 p-0 text-sm leading-normal text-white/85">
              {BENEFICIOS_INSTITUCION.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <Icono nombre="tilde" tamano={16} trazo={2} className="mt-0.5 text-celeste" />
                  {b}
                </li>
              ))}
            </ul>
            <BotonLink
              href={RUTA_REGISTRO_INSTITUCION}
              variante="cta"
              tamano="lg"
              bloque
              className="relative mt-[26px] h-[50px] bg-ambar text-tinta shadow-[0_4px_10px_rgba(245,147,50,.35)] hover:bg-ambar hover:text-tinta hover:brightness-95"
            >
              {hayCupos ? "Quiero el plan Fundador" : "Crear cuenta de institución"}
            </BotonLink>
          </article>
        </div>

        {hayCupos && (
          <p className="mt-[22px] text-center text-[13px] leading-normal text-sutil">
            Pasadas las primeras {CUPOS_FUNDADOR} instituciones, el plan queda en {pesos(PLANES.estandar.precio)} por mes.
          </p>
        )}
      </section>
    </>
  );
}
