import type { Metadata } from "next";
import { NodosMarca } from "@/components/app/nodos-marca";
import { Icono } from "@/components/icons";
import { BandaCTA } from "@/components/publico/banda-cta";
import { PlanesInstituciones } from "@/components/publico/planes-instituciones";
import { BotonLink } from "@/components/ui/button";
import { crearPlanes, pesos } from "@/lib/planes";
import { CUPOS_FUNDADOR, RUTA_REGISTRO_DOCENTE, RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { catalogoDePlanes } from "@/lib/queries/planes";
import { cuposFundadorRestantes } from "@/lib/queries/publico";
import { cn } from "@/lib/utils";

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
  "Las promociones de lanzamiento, acumulables",
];

/** Lo que el banner resume de un vistazo: son las mismas promesas de las tarjetas, dichas cortas. */
const PROMESAS = ["Gratis para profesionales", "Sin comisión por contratación", "Sin costo por publicación"];

export default async function Planes() {
  const [cupos, catalogo] = await Promise.all([cuposFundadorRestantes(), catalogoDePlanes()]);
  const hayCupos = cupos > 0;
  const P = crearPlanes(catalogo);

  const colegios = P.planDe("colegio");
  const clubes = P.planDe("deportiva");
  const multisede = P.planDe("multisede");
  const { meses: mesesDelPack, mesesQueSePagan } = P.condiciones.pack;

  // Las respuestas salen del catálogo: si el equipo cambia un precio en Planes, esta página lo dice sola.
  const PREGUNTAS = [
    {
      pregunta: "¿Los profesionales pagan algo?",
      respuesta: "No. Crear el perfil, verificarlo y postularse a las búsquedas es gratis, siempre.",
    },
    {
      pregunta: "¿Hay comisión por contratar o costo por publicar?",
      respuesta:
        "No. Las instituciones pagan solo la suscripción mensual: publican todas las búsquedas que necesitan y no se les cobra nada cuando contratan.",
    },
    {
      pregunta: "¿Cuánto paga mi institución?",
      respuesta: `Depende del tipo. ${colegios.label.replace("Plan ", "")}: ${pesos(colegios.precio)} por mes (${P.tiposPorPlan.colegio.join(", ").toLowerCase()}). ${clubes.label.replace("Plan ", "")}: ${pesos(clubes.precio)} por mes. Desde ${P.condiciones.sedesMultisede} sedes se factura por sede: ${pesos(multisede.precio)} por mes cada una.`,
    },
    {
      pregunta: "¿Y si mi institución tiene más de una sede?",
      respuesta: `Pagás el abono de tu plan por la primera sede y ${
        P.condiciones.descuentoSedeExtra >= 100
          ? "las sedes adicionales no tienen costo"
          : `cada sede adicional ${P.condiciones.descuentoSedeExtra > 0 ? `con ${P.condiciones.descuentoSedeExtra} % de descuento: ${pesos(P.precioDeSedeExtra("colegio"))} por mes en el plan de colegios y ${pesos(P.precioDeSedeExtra("deportiva"))} en el de clubes y academias` : "paga lo mismo que la primera"}`
      }. Desde ${P.condiciones.sedesMultisede} sedes se factura por sede (plan Multisede).`,
    },
    {
      pregunta: "¿Cómo funciona el pago por adelantado?",
      respuesta: `Contratás el pack de ${mesesDelPack} meses y pagás ${mesesQueSePagan}: ${pesos(P.packDe("colegio").anticipado)} en lugar de ${pesos(P.packDe("colegio").lista)} en el plan de colegios, o ${pesos(P.packDe("deportiva").anticipado)} en lugar de ${pesos(P.packDe("deportiva").lista)} en el de clubes y academias.`,
    },
  ];

  const columnas = hayCupos
    ? "grid-cols-3 max-[1179px]:grid-cols-2 max-[700px]:grid-cols-1"
    : "grid-cols-2 max-[800px]:grid-cols-1";

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1296px] flex-col gap-10 px-12 pt-10 pb-4 max-[900px]:px-6 max-[560px]:gap-8 max-[560px]:pt-6">
        <section className="relative overflow-hidden rounded-marco bg-navy-900 px-12 py-14 text-white max-[560px]:px-6 max-[560px]:py-10">
          <NodosMarca className="absolute -top-12 -right-10 w-[300px] opacity-90 max-[760px]:w-[180px] max-[760px]:opacity-60" />
          <span className="relative inline-block rounded-full bg-celeste/18 px-2.5 py-[5px] text-xs leading-none font-semibold text-celeste">
            Disponible en todo el país
          </span>
          <h1 className="font-display relative mt-3.5 mb-4 max-w-[20ch] text-[44px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance max-[560px]:text-[32px]">
            Planes y aranceles
          </h1>
          <p className="relative m-0 max-w-[56ch] text-[17px] leading-[1.65] text-white/75">
            Para los profesionales UNIDOAR es gratis, siempre. Las instituciones pagan una suscripción mensual según su
            tipo.
          </p>
          <ul className="relative m-0 mt-7 flex list-none flex-wrap gap-2.5 p-0">
            {PROMESAS.map((p) => (
              <li
                key={p}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 py-2 pr-3.5 pl-2.5 text-[13px] leading-none font-semibold text-white"
              >
                <Icono nombre="tilde" tamano={14} trazo={2.4} className="text-celeste" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Planes" className={cn("grid items-stretch gap-6", columnas)}>
          <article className="relative flex min-w-0 flex-col overflow-hidden rounded-tarjeta border border-rosa/15 bg-[linear-gradient(165deg,#FDF2F8_0%,#FBE0EF_55%,#F7D3E6_100%)] px-8 py-9 max-[560px]:px-6">
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

          <PlanesInstituciones beneficios={BENEFICIOS_INSTITUCION} catalogo={catalogo} />

          {hayCupos && (
            <article className="relative flex min-w-0 flex-col overflow-hidden rounded-tarjeta border border-navy-700/10 bg-celeste px-8 py-9 text-navy-700 max-[1179px]:col-span-2 max-[700px]:col-span-1 max-[560px]:px-6">
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
              <div className="relative flex flex-1 flex-col min-[701px]:max-[1179px]:grid min-[701px]:max-[1179px]:grid-cols-2 min-[701px]:max-[1179px]:gap-x-10">
                <div>
                  <div className="mt-4 mb-1 font-display text-[40px] leading-none font-bold tracking-[-0.03em] max-[560px]:text-[34px]">
                    Las primeras {CUPOS_FUNDADOR}
                  </div>
                  <p className="mb-5 text-sm leading-normal text-navy-700/75">
                    Las que entran ahora quedan como fundadoras: tarifa preferencial y el reconocimiento de haber estado
                    desde el día uno.
                  </p>
                </div>
                <ul className="m-0 flex flex-1 list-none flex-col gap-3 p-0 text-sm leading-normal text-navy-700 min-[701px]:max-[1179px]:mt-4">
                  {BENEFICIOS_FUNDADORA.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-navy-700/12">
                        <Icono nombre="tilde" tamano={11} trazo={2.6} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
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
        </section>

        <section
          aria-labelledby="preguntas"
          className="rounded-tarjeta bg-white p-10 shadow-tarjeta max-[560px]:p-6"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-12 gap-y-6 max-[860px]:grid-cols-1">
            <div>
              <h2
                id="preguntas"
                className="font-display m-0 mb-2.5 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta"
              >
                Preguntas frecuentes
              </h2>
              <p className="m-0 text-[15px] leading-[1.6] text-apagado">
                Lo que más nos preguntan antes de empezar.
              </p>
            </div>
            <div className="min-w-0">
              {PREGUNTAS.map((p) => (
                <details key={p.pregunta} className="group border-b border-linea first:pt-0 last:border-b-0">
                  <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-4 rounded-caja py-4 text-[17px] leading-snug font-semibold text-tinta marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 [&::-webkit-details-marker]:hidden">
                    {p.pregunta}
                    <span
                      aria-hidden
                      className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-navy-50 text-navy-700 transition-transform group-open:rotate-180"
                    >
                      <Icono nombre="chevron" tamano={16} trazo={2.2} />
                    </span>
                  </summary>
                  <p className="m-0 pb-5 text-[15px] leading-[1.7] text-tinta-2">{p.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>

      <BandaCTA
        etiqueta={
          <span className="inline-flex rounded-full bg-celeste/18 px-2.5 py-[5px] text-xs leading-none font-semibold text-celeste">
            ¿Todavía tenés dudas?
          </span>
        }
        titulo="Contanos qué necesita tu institución"
        texto="Escribinos y te respondemos en el día."
        acciones={
          <BotonLink href="/contacto" variante="cta" tamano="lg">
            Escribinos
          </BotonLink>
        }
      />
    </>
  );
}
