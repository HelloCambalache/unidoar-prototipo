import Link from "next/link";
import { Icono } from "@/components/icons";
import { RUTA_REGISTRO_DOCENTE } from "@/lib/publico";
import { RUTA_PUBLICAR_BUSQUEDA } from "@/lib/publicar-busqueda";

type Columna = {
  etiqueta: string;
  intro: string;
  acento: string;
  /** Color del texto sobre el acento (números, etiqueta y botón). */
  sobreAcento: string;
  pasos: { titulo: string; texto: string }[];
  cta: { href: string; texto: string };
};

const COLUMNAS: Columna[] = [
  {
    etiqueta: "Si sos institución",
    intro: "Una vez registrada tu institución en la plataforma:",
    acento: "#82D8E9",
    sobreAcento: "#04203A",
    pasos: [
      {
        titulo: "Publicá la búsqueda en dos minutos",
        texto: "Indicá el puesto, el nivel, la carga horaria y el turno requerido, de forma simple y directa.",
      },
      {
        titulo: "Recibí postulantes de la zona",
        texto: "Visualizá a los candidatos ordenados por afinidad y con sus validaciones profesionales a la vista.",
      },
      {
        titulo: "Seguí el proceso hasta contratar",
        texto: "Gestioná todo desde un tablero claro: quién respondió a la búsqueda y a quién le ofreciste el puesto.",
      },
    ],
    cta: { href: RUTA_PUBLICAR_BUSQUEDA, texto: "Publicar una búsqueda" },
  },
  {
    etiqueta: "Si sos profesional",
    intro: "Una vez que creás tu perfil gratis:",
    acento: "#DD553F",
    sobreAcento: "#FFFFFF",
    pasos: [
      {
        titulo: "Cargá tus datos y listo",
        texto: "Sumá tu información, título y credenciales. Nosotros te ayudamos a estructurar tu perfil profesional.",
      },
      {
        titulo: "Marcá tus zonas de trabajo",
        texto:
          "Seleccioná las localidades donde te interesa trabajar para ver únicamente las búsquedas a las que podés llegar.",
      },
      {
        titulo: "Postulate u ofrecete",
        texto:
          "Aplicá a las vacantes disponibles o hacé visible tu perfil aunque la institución todavía no haya publicado una búsqueda.",
      },
    ],
    cta: { href: RUTA_REGISTRO_DOCENTE, texto: "Crear mi perfil gratis" },
  },
];

/** "Cómo funciona": un recorrido de tres pasos para instituciones y otro para profesionales. */
export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      className="relative scroll-mt-4 overflow-hidden border-b border-borde bg-superficie px-12 py-[76px] max-[900px]:px-6 max-[900px]:py-[52px]"
    >
      <div aria-hidden className="pub-grid-claro pointer-events-none absolute inset-0 opacity-55" />
      <div className="relative mx-auto max-w-[1120px]">
        <div className="mb-11 text-center">
          <span className="mb-4 inline-block rounded-full bg-[#F0EFEA] px-2.5 py-[5px] text-xs leading-none font-semibold text-tinta-2">
            Cómo funciona
          </span>
          <h2 className="mb-2.5 font-display text-[38px] leading-[1.15] font-bold tracking-[-0.025em] text-tinta max-[900px]:text-[30px]">
            Nada de formularios eternos
          </h2>
          <p className="mx-auto max-w-[56ch] text-base leading-[1.6] text-apagado">
            Publicá tu búsqueda o postulate al puesto que querés el mismo día que te registrás. Simple, ágil y sin vueltas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-[22px] max-[700px]:grid-cols-1">
          {COLUMNAS.map((col) => (
            <article
              key={col.etiqueta}
              className="flex flex-col rounded-[20px] bg-navy-700 px-8 py-[34px] shadow-[0_12px_30px_rgba(22,33,79,.18)] max-[560px]:px-6"
            >
              <span
                style={{ background: col.acento, color: col.sobreAcento }}
                className="mb-[26px] inline-block self-start rounded-full px-[15px] py-[7px] text-[11.5px] leading-none font-bold tracking-[.08em] uppercase"
              >
                {col.etiqueta}
              </span>
              <p className="-mt-3.5 mb-6 text-[13.5px] leading-[1.55] text-white/60">{col.intro}</p>
              <ol className="m-0 flex list-none flex-col gap-[26px] p-0">
                {col.pasos.map((paso, i) => (
                  <li key={paso.titulo} className="relative flex gap-4">
                    {i < col.pasos.length - 1 && (
                      <span
                        aria-hidden
                        style={{ background: `linear-gradient(180deg, ${col.acento}, rgba(255,255,255,.06))` }}
                        className="pointer-events-none absolute top-11 -bottom-[26px] left-[21px] w-px"
                      />
                    )}
                    <span
                      aria-hidden
                      style={{ background: col.acento, color: col.sobreAcento }}
                      className="inline-flex size-[42px] flex-none items-center justify-center rounded-full font-display text-base leading-none font-bold shadow-[0_0_0_6px_rgba(255,255,255,.05)]"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h3 className="mb-1 text-[16.5px] leading-[1.35] font-semibold text-white">{paso.titulo}</h3>
                      <p className="text-sm leading-[1.55] text-white/62">{paso.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href={col.cta.href}
                style={{ background: col.acento, color: col.sobreAcento }}
                className="mt-7 flex h-[46px] items-center justify-center gap-2 rounded-full text-[14.5px] leading-none font-semibold transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-white/60 focus-visible:outline-none"
              >
                {col.cta.texto}
                <Icono nombre="flecha" tamano={14} trazo={2.4} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
