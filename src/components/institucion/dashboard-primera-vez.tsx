import Link from "next/link";
import { BannerPasos } from "@/components/institucion/banner-pasos";
import { GrillaCercanos } from "@/components/institucion/docentes-sugeridos";
import { BotonLink } from "@/components/ui/button";
import type { Institucion } from "@/db/schema";
import { focoDeFoto } from "@/lib/fotos";
import { pasosDePerfilInstitucion } from "@/lib/perfil-institucion";
import type { DocenteRecomendado } from "@/lib/queries/coincidencias";
import { cn, haceCuanto } from "@/lib/utils";
import { Icono } from "@/components/icons";

type PasoPendiente = {
  n: number;
  titulo: string;
  texto: string;
  href: string;
  imagen: string;
  fondo: string;
  tinta: string;
  boton: string;
};

/**
 * Dashboard de una institución que todavía no publicó ninguna búsqueda: bienvenida, tres pasos
 * para arrancar (con lo que ya está hecho tildado) y profesionales de la zona para ir invitando.
 */
export function DashboardPrimeraVez({
  institucion,
  nombre,
  equipo,
  cercanos,
  planLabel,
  conBuscador = true,
}: {
  institucion: Institucion;
  nombre: string;
  /** Nombre del plan de la institución ("Plan Colegios"), del catálogo vigente. */
  planLabel: string;
  /** Integrantes del equipo además de quien creó la cuenta. */
  equipo: number;
  cercanos: DocenteRecomendado[];
  /** Su plan incluye el buscador de profesionales: sin él (una búsqueda puntual que no lo incluye) no se ofrece mirar quién hay cerca. */
  conBuscador?: boolean;
}) {
  const perfil = pasosDePerfilInstitucion(institucion);
  const perfilListo = perfil.porcentaje === 100;

  const pasos: (PasoPendiente & { listo: boolean })[] = [
    {
      n: 2,
      titulo: "Completá el perfil",
      texto: "Logo, foto de portada y descripción. Es lo que miran los profesionales antes de decidir si se postulan.",
      href: "/institucion/vitrina",
      imagen: institucion.portadaUrl ?? "/assets/cat-profesores.jpg",
      fondo: "bg-[#FDF0CF]",
      tinta: "text-[#7A4A00]",
      boton: "bg-[#7A4A00]",
      listo: perfilListo,
    },
    {
      n: 3,
      titulo: "Publicá tu búsqueda",
      texto: "Puesto, horas y turno. Es lo único que hace que empiecen a llegar postulantes.",
      href: "/institucion/publicar",
      imagen: "/assets/hero-aula.jpg",
      fondo: "bg-[#FBE0DB]",
      tinta: "text-[#7A1F11]",
      boton: "bg-[#7A1F11]",
      listo: false,
    },
    {
      n: 4,
      titulo: "Invitá a tu equipo",
      texto: "Sumá a quien decide las contrataciones para que vea los mismos postulantes que vos.",
      href: "/institucion/equipo",
      imagen: "/assets/cat-docentes.jpg",
      fondo: "bg-[#DFF1F7]",
      tinta: "text-[#04203A]",
      boton: "bg-[#04203A]",
      listo: equipo > 0,
    },
  ];
  const pendientes = pasos.filter((p) => !p.listo);
  const hechos = 4 - pendientes.length; // el paso 1 (crear la cuenta) ya está
  const creada = haceCuanto(institucion.creadoEn);

  return (
    <>
      <section className="relative mb-[26px] flex items-stretch overflow-hidden rounded-interno bg-navy-700 max-[900px]:flex-col">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-[120px] -left-[60px] size-[380px] rounded-full bg-[radial-gradient(circle,rgba(221,85,63,.42),transparent_70%)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-[34%] -bottom-[150px] size-[320px] rounded-full bg-[radial-gradient(circle,rgba(130,216,233,.26),transparent_70%)]"
        />
        <div className="relative z-[1] min-w-0 flex-1 px-9 py-[34px] max-[900px]:px-[22px] max-[900px]:py-[26px]">
          <span className="mb-3.5 inline-block rounded-full bg-white/[.14] px-2.5 py-[5px] text-xs leading-none font-semibold text-navy-100">
            Cuenta creada {creada === "ahora" ? "recién" : creada} · {planLabel}
          </span>
          <h1 className="m-0 mb-2.5 max-w-[20ch] font-display text-[30px] leading-[1.15] font-bold tracking-[-0.025em] text-white max-[560px]:text-[26px]">
            {nombre}, publicá tu primera búsqueda
          </h1>
          <p className="m-0 mb-[22px] max-w-[52ch] text-[15px] leading-[1.6] text-white/75">
            Cargá el puesto, las horas y el turno. En dos minutos queda publicada y te empiezan a llegar postulantes de tu zona,
            con identidad y título ya verificados.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <BotonLink href="/institucion/publicar" variante="cta" tamano="lg">
              Publicar una búsqueda
            </BotonLink>
            <BotonLink
              href="/institucion/buscar-docentes"
              variante="fantasma"
              tamano="lg"
              className="border-white/35 text-white hover:bg-white/10 hover:text-white"
            >
              Ver el catálogo
            </BotonLink>
          </div>
        </div>
        <div
          style={{ backgroundPosition: focoDeFoto("/assets/hero-aula.jpg") }}
          className="relative w-[34%] flex-none bg-[url(/assets/hero-aula.jpg)] bg-cover max-[900px]:order-first max-[900px]:h-[180px] max-[900px]:w-full">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-[120px] bg-linear-to-r from-navy-700 to-transparent max-[900px]:hidden"
          />
        </div>
      </section>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <h2 className="m-0 text-[17px] leading-tight font-semibold">Para arrancar</h2>
        <div className="flex items-center gap-2.5">
          <div className="h-[7px] w-[120px] overflow-hidden rounded-full bg-[#F0EFEA]" role="presentation">
            <div className="h-full bg-navy-700" style={{ width: `${(hechos / 4) * 100}%` }} />
          </div>
          <span className="text-[13px] leading-none font-semibold text-apagado">{hechos} de 4 listos</span>
        </div>
      </div>
      <p className="m-0 mb-4 text-[13.5px] leading-normal text-apagado">
        La cuenta ya quedó creada. {pendientes.length === 1 ? "Te falta este paso." : `Te faltan estos ${pendientes.length}.`}
      </p>
      <ul className="mb-7 grid list-none grid-cols-3 gap-4 p-0 max-[1100px]:grid-cols-2 max-[680px]:grid-cols-1">
        {pendientes.map((p) => (
          <li key={p.n} className="flex">
            <Link
              href={p.href}
              className={cn(
                "flex w-full flex-col rounded-interno p-[22px] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(31,36,33,.16)] focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
                p.fondo,
                p.tinta,
              )}
            >
              <div className="mb-[18px] flex items-start justify-between gap-3">
                <span className="rounded-full bg-white/70 px-[13px] py-1.5 text-[11.5px] leading-none font-semibold tracking-[.05em] uppercase">
                  Paso {p.n}
                </span>
                <span className={cn("inline-flex size-[34px] flex-none items-center justify-center rounded-full text-white", p.boton)}>
                  <Icono nombre="flechaDiagonal" tamano={15} trazo={2.3} />
                </span>
              </div>
              <span className="mb-2 font-display text-[21px] leading-tight font-bold tracking-[-0.02em]">{p.titulo}</span>
              <span className="mb-[18px] flex-1 text-[13.5px] leading-[1.55]">{p.texto}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen decorativa a ancho completo */}
              <img src={p.imagen} alt="" style={{ objectPosition: focoDeFoto(p.imagen) }} className="h-[104px] w-full rounded-caja object-cover" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mb-7">
        <BannerPasos titulo="Cubrir un cargo son tres pasos" acentuado="celeste" />
      </div>

      {conBuscador && (
        <>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <h2 className="m-0 text-[17px] leading-tight font-semibold">Mientras tanto, mirá quién hay cerca</h2>
            <Link href="/institucion/buscar-docentes" className="text-[13px] font-medium">
              Ver todo el catálogo
            </Link>
          </div>
          <p className="m-0 mb-4 text-[13.5px] leading-normal text-apagado">
            Ya están en UNIDOAR, cerca de tu institución. Podés invitarlos a postularse incluso antes de publicar.
          </p>
          {cercanos.length > 0 ? (
            <GrillaCercanos docentes={cercanos} />
          ) : (
            <p className="m-0 rounded-tarjeta border border-dashed border-borde-fuerte bg-white/60 px-6 py-8 text-center text-[13.5px] text-apagado">
              Todavía no hay profesionales verificados en tu zona. Publicá tu búsqueda y los avisamos apenas aparezcan.
            </p>
          )}
        </>
      )}
    </>
  );
}
