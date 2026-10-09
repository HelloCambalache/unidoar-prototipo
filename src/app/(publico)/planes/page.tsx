import type { Metadata } from "next";
import { Icono } from "@/components/icons";
import { PlanesInstituciones } from "@/components/publico/planes-instituciones";
import { BotonLink } from "@/components/ui/button";
import { CUPOS_FUNDADOR, RUTA_REGISTRO_DOCENTE, RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { cuposFundadorRestantes } from "@/lib/queries/publico";
import { origenSitio } from "@/lib/sitio";

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

const BENEFICIOS_FUNDADORA = [
  "Tarifa de fundador congelada mientras sigas suscripto",
  "Insignia de Institución Fundadora en tu perfil público",
  "Tu logo en la portada del sitio",
  "Las dos promociones de lanzamiento, acumulables",
];

export default async function Planes() {
  const [cupos, origen] = await Promise.all([cuposFundadorRestantes(), origenSitio()]);
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

      <section className="mx-auto w-full max-w-[1400px] flex-1 px-12 pb-16 max-[560px]:px-5">
        <div className="flex flex-wrap items-stretch gap-6">
          <article className="relative flex min-w-[300px] flex-1 flex-col overflow-hidden rounded-[14px] border border-rosa/15 bg-[linear-gradient(165deg,#FDF2F8_0%,#FBE0EF_55%,#F7D3E6_100%)] px-8 py-9 max-[560px]:px-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-[70px] -left-[60px] size-[220px] rounded-full bg-[radial-gradient(circle,rgba(151,18,95,.16),transparent_70%)]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -right-[70px] -bottom-[80px] size-[240px] rounded-full bg-[radial-gradient(circle,rgba(130,216,233,.35),transparent_70%)]"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-xs leading-none font-semibold tracking-[.08em] text-rosa uppercase">
                Profesionales
              </h2>
              <span className="rounded-full bg-rosa px-2.5 py-[5px] text-xs leading-none font-semibold text-white">
                Para siempre
              </span>
            </div>
            <div className="relative mt-4 mb-1 font-display text-[40px] leading-none font-bold tracking-[-0.03em] text-rosa">
              100% gratis
            </div>
            <p className="relative mb-5 text-sm leading-normal text-[#7A1B4E]/75">
              Tu talento no tiene costo: creá tu perfil, verificá tus títulos y postulate.
            </p>
            <ul className="relative m-0 flex flex-1 list-none flex-col gap-3 p-0 text-sm leading-normal text-[#5E1340]">
              {BENEFICIOS_DOCENTE.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-rosa/12 text-rosa">
                    <Icono nombre="tilde" tamano={11} trazo={2.6} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <BotonLink
              href={RUTA_REGISTRO_DOCENTE}
              variante="cta"
              tamano="lg"
              bloque
              className="relative mt-[26px] h-[50px] bg-rosa text-white shadow-[0_4px_10px_rgba(151,18,95,.3)] hover:bg-rosa hover:text-white hover:brightness-110"
            >
              Soy profesional
            </BotonLink>
          </article>

          <PlanesInstituciones beneficios={BENEFICIOS_INSTITUCION} url={`${origen}/planes`} />

          {hayCupos && (
            <article className="relative flex min-w-[300px] flex-1 flex-col overflow-hidden rounded-[14px] border border-navy-700/10 bg-celeste px-8 py-9 text-navy-700 max-[560px]:px-6">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-[70px] -right-[60px] size-[230px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.7),transparent_70%)]"
              />
              <div className="relative flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-xs leading-none font-semibold tracking-[.08em] text-navy-700/70 uppercase">
                  Fundadoras
                </h2>
                <span className="rounded-full bg-navy-700 px-2.5 py-[5px] text-xs leading-none font-semibold text-white">
                  Quedan {cupos} de {CUPOS_FUNDADOR}
                </span>
              </div>
              <div className="relative mt-4 mb-1 font-display text-[40px] leading-none font-bold tracking-[-0.03em]">
                Las primeras {CUPOS_FUNDADOR}
              </div>
              <p className="relative mb-5 text-sm leading-normal text-navy-700/75">
                Las que entran ahora quedan como fundadoras: tarifa preferencial y el reconocimiento de haber estado
                desde el día uno.
              </p>
              <ul className="relative m-0 flex flex-1 list-none flex-col gap-3 p-0 text-sm leading-normal text-navy-700">
                {BENEFICIOS_FUNDADORA.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-navy-700/12">
                      <Icono nombre="tilde" tamano={11} trazo={2.6} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <BotonLink
                href={RUTA_REGISTRO_INSTITUCION}
                variante="cta"
                tamano="lg"
                bloque
                className="relative mt-[26px] h-[50px] bg-navy-700 text-white shadow-[0_4px_10px_rgba(22,33,79,.25)] hover:bg-navy-700 hover:text-white hover:brightness-125"
              >
                Quiero ser fundadora
              </BotonLink>
            </article>
          )}
        </div>
      </section>
    </>
  );
}
