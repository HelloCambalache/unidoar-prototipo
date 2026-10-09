import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { PublicidadAncha } from "@/components/docente/dashboard-publicidad";
import {
  CuadriculaTarjetas,
  SeccionTablero,
  TarjetaOfertaRecomendada,
} from "@/components/docente/dashboard-secciones";
import { EstadoVacio } from "@/components/app/estado-vacio";
import type { Docente } from "@/db/schema";
import { hoyArgentina } from "@/lib/fechas-curso";
import { focoDeFoto } from "@/lib/fotos";
import type { Tablero } from "@/lib/queries/docente";

type Paso = {
  clave: "documentacion" | "foto" | "postular";
  numero: number;
  titulo: string;
  texto: string;
  href: string;
  foto: string;
  /** Colores propios de cada tarjeta: fondo, texto y círculo de la flecha. */
  fondo: string;
  tinta: string;
};

const PASOS: Paso[] = [
  {
    clave: "documentacion",
    numero: 2,
    titulo: "Subí tu documentación",
    texto: "Hasta que la revisemos tu perfil figura como Sin verificar, y es lo primero que mira una institución.",
    // Paso 4 del alta de docente: la carga de documentación.
    href: "/onboarding/docente/4",
    foto: "/assets/hero-profesor.jpg",
    fondo: "#FBE3F0",
    tinta: "#7A1B4E",
  },
  {
    clave: "foto",
    numero: 3,
    titulo: "Sumá tu foto",
    texto: "Los perfiles con foto reciben el doble de invitaciones a postularse.",
    href: "/docente/perfil",
    foto: "/assets/cat-docentes.jpg",
    fondo: "#FDF0CF",
    tinta: "#7A4A00",
  },
  {
    clave: "postular",
    numero: 4,
    titulo: "Postulate por primera vez",
    texto: "Ya hay búsquedas que coinciden con tus asignaturas, tus zonas y tu disponibilidad.",
    href: "/docente/oportunidades",
    foto: "/assets/urgente-docentes.jpg",
    fondo: "#DFF1F7",
    tinta: "#04203A",
  },
];

const TRES_PASOS = [
  { titulo: "Encontrá la búsqueda", texto: "Filtradas por tu zona y tus asignaturas." },
  { titulo: "Postulate en dos toques", texto: "Sin volver a cargar el CV cada vez." },
  { titulo: "Te contactan directo", texto: "Por WhatsApp, sin intermediarios." },
];

function unir(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

const EN_LETRAS = ["ninguna", "esta", "estas dos", "estas tres"];

/** Dashboard del docente recién registrado: todavía no se postuló a nada. */
export function DashboardPrimeraVez({ docente, tablero }: { docente: Docente; tablero: Tablero }) {
  const { paraVos, metricas } = tablero;
  const hecho: Record<Paso["clave"], boolean> = {
    documentacion: tablero.documentacionCargada,
    foto: !!docente.fotoUrl,
    postular: tablero.totalPostulaciones > 0,
  };
  const faltan = PASOS.filter((p) => !hecho[p.clave]);
  // El paso 1 (crear la cuenta) ya está hecho si se llegó hasta acá.
  const listos = 1 + PASOS.length - faltan.length;
  const total = PASOS.length + 1;
  const creadoHoy = hoyArgentina(docente.creadoEn) === hoyArgentina();
  const donde = docente.zonas.length ? `En ${unir(docente.zonas.slice(0, 3))}, en tus asignaturas.` : "En tus asignaturas.";

  return (
    <>
      <div className="relative mb-[26px] flex items-stretch overflow-hidden rounded-[18px] bg-navy-700 max-[900px]:flex-col">
        <span
          aria-hidden
          style={{ backgroundImage: "radial-gradient(circle,rgba(151,18,95,.52),transparent 70%)" }}
          className="pointer-events-none absolute -top-[120px] -left-[60px] size-[380px] rounded-full"
        />
        <span
          aria-hidden
          style={{ backgroundImage: "radial-gradient(circle,rgba(245,147,50,.26),transparent 70%)" }}
          className="pointer-events-none absolute -bottom-[150px] right-[34%] size-80 rounded-full"
        />
        <div className="relative z-[1] min-w-0 flex-1 px-9 py-[34px] max-[900px]:px-[22px] max-[900px]:py-[26px]">
          <Insignia className="mb-3.5 bg-white/[.14] text-[#FBD9EC]">
            {creadoHoy ? "Perfil creado hoy · gratis siempre" : "Perfil publicado · gratis siempre"}
          </Insignia>
          <h1 className="font-display m-0 mb-2.5 max-w-[20ch] text-[30px] leading-[1.15] font-bold tracking-[-0.025em] text-white">
            {paraVos > 0
              ? `${docente.nombre}, ya ${paraVos === 1 ? "hay 1 búsqueda" : `hay ${paraVos} búsquedas`} para vos`
              : `${docente.nombre}, tu perfil ya está publicado`}
          </h1>
          <p className="m-0 mb-[22px] max-w-[52ch] text-[15px] leading-[1.6] text-white/75">
            {paraVos > 0
              ? `${donde} Postulate en dos toques: las instituciones ya ven tu perfil en el catálogo.`
              : "Todavía no hay búsquedas abiertas en tus zonas: apenas aparezca una te avisamos. Mientras tanto, las instituciones ya ven tu perfil en el catálogo."}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <BotonLink href="/docente/oportunidades" tamano="lg" className="bg-rosa px-6 text-[15px] hover:bg-[#7A0F4D]">
              Ver búsquedas abiertas
            </BotonLink>
            <BotonLink
              href="/docente/busquedas-rapidas"
              tamano="lg"
              className="border-white/35 bg-transparent px-6 text-[15px] text-white shadow-none hover:border-white/60 hover:bg-white/10"
            >
              Suplencias de esta semana
            </BotonLink>
          </div>
        </div>
        <div
          aria-hidden
          style={{ backgroundImage: "url(/assets/hero-docente.jpg)", backgroundPosition: focoDeFoto("/assets/hero-docente.jpg") }}
          className="relative w-[34%] flex-none bg-cover bg-no-repeat max-[900px]:order-first max-[900px]:h-[180px] max-[900px]:w-full"
        >
          <span
            style={{ backgroundImage: "linear-gradient(90deg,#16214F,transparent)" }}
            className="pointer-events-none absolute inset-y-0 left-0 w-[120px] max-[900px]:hidden"
          />
        </div>
      </div>

      {faltan.length > 0 && (
        <section>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-4">
            <h2 className="m-0 text-[17px] leading-[1.2] font-semibold">Para arrancar</h2>
            <div className="flex items-center gap-2.5">
              <div
                role="progressbar"
                aria-label="Pasos para arrancar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={listos}
                className="h-[7px] w-[120px] overflow-hidden rounded-full bg-[#F0EFEA]"
              >
                <div className="h-full bg-rosa" style={{ width: `${(listos / total) * 100}%` }} />
              </div>
              <span className="text-[13px] leading-none font-semibold text-apagado">
                {listos} de {total} listos
              </span>
            </div>
          </div>
          <p className="m-0 mb-4 text-[13.5px] leading-normal text-apagado">
            El perfil ya está publicado. {faltan.length === 1 ? "Te falta" : "Te faltan"} {EN_LETRAS[faltan.length]}.
          </p>
          <div className="mb-7 grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-[680px]:grid-cols-1">
            {faltan.map((p) => (
              <Link
                key={p.clave}
                href={p.href}
                style={{ backgroundColor: p.fondo, color: p.tinta }}
                className="flex flex-col rounded-[22px] p-[22px] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(31,36,33,.16)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30"
              >
                <div className="mb-[18px] flex items-start justify-between gap-3">
                  <span className="rounded-full bg-white/[.72] px-[13px] py-1.5 text-[11.5px] leading-none font-semibold tracking-[.05em] uppercase">
                    Paso {p.numero}
                  </span>
                  <span
                    aria-hidden
                    style={{ backgroundColor: p.tinta }}
                    className="inline-flex size-[34px] flex-none items-center justify-center rounded-full text-white"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7" />
                      <path d="M9 7h8v8" />
                    </svg>
                  </span>
                </div>
                <div className="font-display mb-2 text-[21px] leading-[1.2] font-bold tracking-[-0.02em]">{p.titulo}</div>
                <div className="mb-[18px] flex-auto text-[13.5px] leading-[1.55]">{p.texto}</div>
                <span
                  aria-hidden
                  style={{ backgroundImage: `url(${p.foto})`, backgroundPosition: focoDeFoto(p.foto) }}
                  className="h-[104px] rounded-[14px] bg-cover bg-no-repeat"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-7 flex flex-wrap items-stretch gap-[18px] max-[860px]:flex-col max-[860px]:gap-4">
        <div className="relative flex min-w-[280px] flex-[1_1_340px] flex-col justify-center overflow-hidden rounded-[14px] bg-navy-700 px-[26px] py-6 max-[860px]:min-w-0">
          <span
            aria-hidden
            style={{ backgroundImage: "radial-gradient(circle,rgba(151,18,95,.42),transparent 70%)" }}
            className="pointer-events-none absolute -top-20 -right-[50px] size-[230px] rounded-full"
          />
          <div className="relative z-[1]">
            <div className="font-display mb-3.5 text-[19px] leading-[1.25] font-bold tracking-[-0.02em] text-white">
              Conseguir trabajo son tres pasos
            </div>
            <ol className="m-0 grid list-none grid-cols-3 gap-4 p-0 max-[1180px]:grid-cols-1 max-[1180px]:gap-3">
              {TRES_PASOS.map((p, i) => (
                <li key={p.titulo} className="flex flex-col gap-2 max-[1180px]:flex-row max-[1180px]:items-start max-[1180px]:gap-[11px]">
                  <span className="inline-flex size-5 flex-none items-center justify-center rounded-full bg-ambar text-[11px] leading-none font-bold text-navy-700">
                    {i + 1}
                  </span>
                  <span className="text-[13.5px] leading-normal text-white/[.78]">
                    <b className="font-semibold text-white">{p.titulo}</b>
                    <br />
                    {p.texto}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <Link
          href="/docente/busquedas-rapidas"
          style={{ backgroundImage: "url(/assets/urgente-pizarron.jpg)", backgroundPosition: focoDeFoto("/assets/urgente-pizarron.jpg") }}
          className="relative flex min-h-[200px] max-w-[440px] min-w-[280px] flex-[1_1_380px] items-end self-stretch overflow-hidden rounded-[14px] bg-cover bg-no-repeat max-[860px]:aspect-video max-[860px]:min-h-0 max-[860px]:w-full max-[860px]:max-w-none max-[860px]:min-w-0 max-[860px]:flex-none"
        >
          <span
            aria-hidden
            style={{ backgroundImage: "linear-gradient(180deg,rgba(4,11,53,.1),rgba(4,11,53,.88))" }}
            className="pointer-events-none absolute inset-0"
          />
          <div className="relative z-[1] px-[22px] py-5">
            <Insignia className="mb-2 bg-naranja text-white">
              {metricas.suplencias === 0
                ? "Suplencias rápidas"
                : metricas.suplencias === 1
                  ? "1 suplencia abierta"
                  : `${metricas.suplencias} suplencias abiertas`}
            </Insignia>
            <div className="font-display text-[17px] leading-[1.3] font-bold text-white">
              {metricas.suplenciaVence
                ? metricas.suplenciaVence.charAt(0).toUpperCase() + metricas.suplenciaVence.slice(1)
                : "Hoy no hay ninguna abierta"}
            </div>
            <div className="mt-[3px] text-[13px] leading-[1.45] text-white/75">Las rápidas se cubren el mismo día.</div>
          </div>
        </Link>
      </div>

      <SeccionTablero
        titulo="Recomendadas para vos"
        bajada="Ordenadas por cuánto coinciden con tus asignaturas, tus zonas y tu disponibilidad."
        enlace={{ href: "/docente/oportunidades", texto: "Ver todas" }}
      >
        {tablero.recomendadas.length > 0 ? (
          <CuadriculaTarjetas>
            {tablero.recomendadas.map((o) => (
              <TarjetaOfertaRecomendada key={o.id} o={o} />
            ))}
          </CuadriculaTarjetas>
        ) : (
          <EstadoVacio
            titulo="Todavía no hay búsquedas para recomendarte"
            texto="Cuando una institución publique una búsqueda que coincida con tu perfil, la vas a ver acá."
            accion={<BotonLink href="/docente/oportunidades">Ver todas las búsquedas</BotonLink>}
          />
        )}
      </SeccionTablero>
      <div className="mt-3.5 mb-7 rounded-[10px] bg-[#FBE3F0] px-4 py-3.5 text-[13px] leading-normal text-[#7A1B4E]">
        A medida que completés el perfil y marques tu disponibilidad, estas recomendaciones se van afinando.
      </div>

      <PublicidadAncha fondo="noche" className="rounded-[14px]" />
    </>
  );
}
