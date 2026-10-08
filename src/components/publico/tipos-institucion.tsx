import Link from "next/link";
import { cn } from "@/lib/utils";

type Estilo = "claro" | "naranja" | "ambar" | "celeste";

/* Cada estilo: tarjeta, caja del ícono, círculo de la flecha, título y texto. */
const ESTILOS: Record<Estilo, { tarjeta: string; icono: string; flecha: string; trazoFlecha: string; titulo: string; texto: string }> = {
  claro: {
    tarjeta: "border-borde bg-white",
    icono: "bg-[#F0EFEA] text-tinta",
    flecha: "bg-[#F0EFEA]",
    trazoFlecha: "#3D423E",
    titulo: "text-tinta",
    texto: "text-apagado",
  },
  naranja: {
    tarjeta: "border-transparent bg-naranja",
    icono: "bg-white/18 text-white",
    flecha: "bg-white/20",
    trazoFlecha: "#FFFFFF",
    titulo: "text-white",
    texto: "text-white/82",
  },
  ambar: {
    tarjeta: "border-transparent bg-ambar",
    icono: "bg-white/35 text-tinta",
    flecha: "bg-white/45",
    trazoFlecha: "#1F2421",
    titulo: "text-tinta",
    texto: "text-tinta/72",
  },
  celeste: {
    tarjeta: "border-transparent bg-celeste",
    icono: "bg-white/45 text-navy-700",
    flecha: "bg-white/55",
    trazoFlecha: "#16214F",
    titulo: "text-navy-700",
    texto: "text-navy-700/72",
  },
};

const TIPOS: {
  titulo: string;
  texto: string;
  href: string;
  estilo: Estilo;
  etiqueta?: string;
  icono: React.ReactNode;
}[] = [
  {
    titulo: "Colegios privados",
    texto: "Titulares, suplencias y reemplazos por licencia, de Inicial a Secundario.",
    href: "/educadores",
    estilo: "claro",
    icono: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
  },
  {
    titulo: "Gimnasios y clubes deportivos",
    texto: "Entrenadores e instructores por disciplina, profes de sala y funcional, con recambio por temporada.",
    href: "/entrenadores",
    estilo: "naranja",
    etiqueta: "nadie más los cubre",
    icono: (
      <>
        <path d="M4 9v6" />
        <path d="M20 9v6" />
        <path d="M7 6v12" />
        <path d="M17 6v12" />
        <path d="M7 12h10" />
      </>
    ),
  },
  {
    titulo: "Jardines de infantes",
    texto: "Maestras de sala, auxiliares y profes de música o expresión corporal.",
    href: "/educadores",
    estilo: "claro",
    icono: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 21c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
      </>
    ),
  },
  {
    titulo: "Escuelas de danza y arte",
    texto: "Profes por estilo y por franja horaria, muchas veces contratados por hora.",
    href: "/educadores",
    estilo: "ambar",
    icono: (
      <>
        <path d="M12 3.2c-4.9 0-8.8 3.6-8.8 8.1 0 4.5 3.9 8.1 8.8 8.1 1 0 1.7-.7 1.7-1.6 0-.42-.16-.8-.43-1.08a1.55 1.55 0 0 1 1.13-2.6h1.72c2.6 0 4.68-1.95 4.68-4.36 0-3.7-3.6-6.57-8.8-6.57z" />
        <circle cx="7.6" cy="11.4" r="1.05" fill="currentColor" stroke="none" />
        <circle cx="10.4" cy="7.8" r="1.05" fill="currentColor" stroke="none" />
        <circle cx="14.6" cy="8.2" r="1.05" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    titulo: "Universidades",
    texto: "Profesionales de cátedra y ayudantías, por cuatrimestre o por materia.",
    href: "/educadores",
    estilo: "claro",
    icono: (
      <>
        <path d="M22 10L12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </>
    ),
  },
  {
    titulo: "Natatorios y colonias",
    texto: "Profes de natación y guardavidas habilitados, para temporadas cortas.",
    href: "/guardavidas",
    estilo: "celeste",
    icono: (
      <>
        <circle cx="12" cy="5.5" r="1.8" />
        <path d="M3 14c2 0 2 1.6 4 1.6S11 14 13 14s2 1.6 4 1.6S19 14 21 14" />
        <path d="M3 19c2 0 2 1.6 4 1.6S11 19 13 19s2 1.6 4 1.6S19 19 21 19" />
      </>
    ),
  },
  {
    titulo: "Escuelas de tecnología",
    texto: "Talleres de programación y robótica, por módulo o por cuatrimestre.",
    href: "/educadores",
    estilo: "claro",
    icono: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="2.5" />
        <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.2" />
        <path d="M9 2.6v2.4M15 2.6v2.4M9 19v2.4M15 19v2.4M2.6 9H5M2.6 15H5M19 9h2.4M19 15h2.4" />
      </>
    ),
  },
  {
    titulo: "Institutos de idiomas",
    texto: "Profes de inglés, portugués y más, por nivel y por grupo reducido.",
    href: "/educadores",
    estilo: "ambar",
    icono: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z" />
      </>
    ),
  },
];

function Tarjeta({ tipo, oculta }: { tipo: (typeof TIPOS)[number]; oculta?: boolean }) {
  const e = ESTILOS[tipo.estilo];
  return (
    <li className="flex-none">
      <Link
        href={tipo.href}
        tabIndex={oculta ? -1 : undefined}
        className={cn(
          "flex h-full w-[358px] flex-col rounded-[18px] border p-6 transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(31,36,33,.14)] focus-visible:ring-[3px] focus-visible:ring-white/70 focus-visible:outline-none max-[560px]:w-[270px]",
          e.tarjeta,
        )}
      >
        <span className="mb-4 flex items-start justify-between gap-3">
          <span className={cn("inline-flex size-[38px] flex-none items-center justify-center rounded-[11px]", e.icono)}>
            <svg
              aria-hidden
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tipo.icono}
            </svg>
          </span>
          <span className={cn("inline-flex size-[30px] flex-none items-center justify-center rounded-full", e.flecha)}>
            <svg
              aria-hidden
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={e.trazoFlecha}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17L17 7" />
              <path d="M9 7h8v8" />
            </svg>
          </span>
        </span>
        {tipo.etiqueta && (
          <span className="mb-2 inline-flex self-start rounded-full bg-white/18 px-2.5 py-[5px] text-[11px] leading-none font-semibold text-white">
            {tipo.etiqueta}
          </span>
        )}
        <span className={cn("mb-1.5 font-display text-lg leading-tight font-bold tracking-[-0.015em]", e.titulo)}>
          {tipo.titulo}
        </span>
        <span className={cn("text-[13.5px] leading-[1.55]", e.texto)}>{tipo.texto}</span>
      </Link>
    </li>
  );
}

/** Sección oscura "Para quién es": a quién le sirve UNIDOAR, con las tarjetas en marquee. */
export function TiposInstitucion({ tiposEnUso }: { tiposEnUso: number }) {
  return (
    <section className="relative overflow-hidden bg-navy-700 px-12 py-[72px] max-[900px]:px-6 max-[900px]:py-[52px]">
      <div aria-hidden className="pub-grid-oscuro pointer-events-none absolute inset-0 opacity-50" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[110px] -right-[70px] size-[300px] rounded-full bg-[radial-gradient(circle,rgba(221,85,63,.4),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1160px]">
        <div className="mb-[34px] flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-[820px]">
            <div className="mb-3.5 flex items-center gap-[9px]">
              <span aria-hidden className="size-2 rounded-full bg-naranja" />
              <span className="text-xs leading-none font-semibold tracking-[.09em] text-ambar uppercase">Para quién es</span>
            </div>
            <h2 className="mb-3 font-display text-[33px] leading-[1.15] font-bold tracking-[-0.025em] text-balance text-white max-[900px]:text-[30px]">
              Si contratás educadores, entrenadores, instructores, guardavidas. Sumate a nuestra red.
            </h2>
            <p className="text-base leading-[1.6] text-white/75">
              Colegios, institutos de idiomas, clubes, gimnasios, natatorios y escuelas deportivas comparten el mismo
              desafío: conseguir profesionales validados y confiables.
            </p>
          </div>
          {tiposEnUso > 0 && (
            <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 py-2.5 pr-5 pl-3">
              <span className="inline-flex size-10 flex-none items-center justify-center rounded-full bg-ambar font-display text-[17px] leading-none font-bold text-tinta">
                {tiposEnUso}
              </span>
              <span className="text-[13px] leading-[1.35] font-medium text-white">
                {tiposEnUso === 1 ? "tipo" : "tipos"} de institución
                <br />
                ya {tiposEnUso === 1 ? "usa" : "usan"} UNIDOAR
              </span>
            </div>
          )}
        </div>
        <p className="mb-[26px] rounded-xl border-l-[3px] border-ambar bg-white/[.07] px-[22px] py-[18px] text-base leading-[1.55] font-semibold text-white">
          Potenciá tu staff con UNIDOAR: agilizá tu gestión y encontrá perfiles listos para cubrir tus vacantes sin
          perder tiempo.
        </p>

        <div className="pub-marquee-borde pub-marquee-pausa -mx-2 overflow-hidden p-2">
          <div className="pub-marquee-tipos flex w-max">
            {[0, 1].map((n) => (
              <ul key={n} aria-hidden={n === 1 || undefined} className="m-0 flex list-none gap-4 p-0 pr-4">
                {TIPOS.map((t) => (
                  <Tarjeta key={t.titulo} tipo={t} oculta={n === 1} />
                ))}
              </ul>
            ))}
          </div>
        </div>

        <div className="mt-[26px] max-w-[820px]">
          <h3 className="mb-2 text-[17px] leading-[1.45] font-semibold text-white">
            ¿Tenés un taller, una academia de música o un centro de apoyo escolar?
          </h3>
          <p className="text-[15px] leading-[1.6] text-white/75">
            Si contratás profesionales por asignatura, materia o disciplina, UNIDOAR también es para vos. Encontrá el
            talento ideal sin importar el tamaño de tu institución.
          </p>
        </div>
      </div>
    </section>
  );
}
