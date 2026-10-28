import type { Metadata } from "next";
import { NodosMarca } from "@/components/app/nodos-marca";
import { Icono, type IconoClave } from "@/components/icons";
import { BandaCTA } from "@/components/publico/banda-cta";
import { Imagen } from "@/components/publico/imagen";
import { BotonLink } from "@/components/ui/button";
import { focoDeFoto } from "@/lib/fotos";

export const metadata: Metadata = {
  title: "Quiénes somos",
  description:
    "Un equipo con más de 35 años en la educación y el deporte que une experiencia y tecnología para que instituciones y profesionales se conecten de forma simple, directa y transparente.",
};

const FOTO_DEL_EQUIPO = "/assets/quienes-somos-equipo.webp";

/* El texto de propósito, misión, visión y valores lo escribió el equipo: se carga tal cual, no se reescribe. */
const PROPOSITO = [
  {
    titulo: "El propósito central",
    texto:
      "Conectar de forma directa, ágil y transparente a los profesionales de la educación, el deporte y la natación con las instituciones (colegios, clubes y gimnasios) que necesitan cubrir suplencias y vacantes sin fricciones.",
  },
  {
    titulo: "El alcance",
    texto:
      "Resolver la ineficiencia histórica del reclutamiento y la cobertura de cargos en el sector educativo y deportivo mediante una solución móvil, accesible al instante desde el celular tanto para la institución como para el profesional.",
  },
];

const MISION =
  "Transformar y agilizar la vinculación laboral en el ámbito educativo y deportivo, conectando de manera directa a las instituciones con profesionales verificados a través de una herramienta ágil, moderna y accesible desde el celular.";

const VISION =
  "Ser la aplicación de referencia indiscutida en la región para la gestión de talento, suplencias y cobertura de cargos en colegios, clubes y centros deportivos, destacándonos por la transparencia, la inmediatez y el valor agregado para toda la comunidad.";

const VALORES: { icono: IconoClave; titulo: string; texto: string }[] = [
  {
    icono: "rayo",
    titulo: "Inmediatez y Dinamismo",
    texto: "Resolver las necesidades urgentes y planificadas del sector sin demoras innecesarias.",
  },
  {
    icono: "escudo",
    titulo: "Transparencia y Confianza",
    texto: "Validaciones rigurosas (perfiles, antecedentes, títulos y CVs) para dar absoluta tranquilidad a las instituciones.",
  },
  {
    icono: "apreton",
    titulo: "Comunidad y Cercanía",
    texto: "Valorar el rol del docente, el entrenador y el guardavidas, ofreciéndoles un canal gratuito, profesional y directo.",
  },
  {
    icono: "chispas",
    titulo: "Innovación Práctica",
    texto: "Llevar la gestión institucional a la palma de la mano a través de una app intuitiva y moderna.",
  },
];

type Fundador = {
  nombre: string;
  /** Foto de la persona (en `public/assets`, con su encuadre en `FOCOS`). Sin foto se muestran las iniciales. */
  foto?: string;
  /** Desde dónde mira el proyecto cada uno. */
  enfoque: string;
  /** Un párrafo por elemento. Primera persona, tal como lo escribió cada fundador. */
  presentacion: string[];
};

const FUNDADORES: Fundador[] = [
  {
    nombre: "Ariel Gómez",
    foto: "/assets/fundador-ariel.webp",
    enfoque:
      "Mirada territorial: el valor del equipo y el conocimiento profundo de los clubes y natatorios de la región.",
    presentacion: [
      "Tengo más de 35 años de trayectoria en la educación física, el entrenamiento de alto rendimiento y la gestión pública. Mi recorrido va desde las aulas y la formación de deportistas hasta la dirección técnica de disciplinas de equipo y la gestión como Director de Deportes de la Municipalidad de Escobar.",
      "Como docente, entrenador y funcionario municipal viví en primera persona lo difícil que es para una institución armar equipos de trabajo sólidos y cubrir sus necesidades con agilidad.",
      "Cofundé UNIDOAR con la convicción de que la tecnología y la experiencia tenían que unirse para cambiar esa realidad. Mi propósito es volcar todo ese recorrido territorial y de gestión para que la plataforma sea un puente directo, transparente y confiable entre las organizaciones y los profesionales.",
    ],
  },
  {
    nombre: "Esteban Alejandro Castagnone",
    foto: "/assets/fundador-esteban.webp",
    enfoque: "Mirada puesta en el encuentro, el desarrollo de capacidades y la apertura de nuevas oportunidades laborales.",
    presentacion: [
      "Soy licenciado en gestión deportiva, profesor nacional de educación física y entrenador de voleibol, con 35 años de experiencia en docencia, educación formal y educación no formal.",
      "Cofundé UNIDOAR con un objetivo concreto: facilitar el encuentro entre quienes buscan una oportunidad de trabajo y las instituciones que necesitan talento. El deporte me enseñó los dos desafíos de cerca: encontrar personas con las capacidades adecuadas y, a la vez, hallar los espacios donde esas capacidades puedan desarrollarse y aportar valor.",
      "Esta app nace para que ese encuentro sea más simple, directo y eficiente. Son tres décadas y media de trayectoria al servicio de una nueva forma de entender el vínculo institucional.",
    ],
  },
  {
    nombre: "Ricardo Castagnone",
    foto: "/assets/fundador-ricardo.webp",
    enfoque:
      "Visión integral de UNIDOAR: conectando la estrategia del negocio con la realidad cotidiana de las instituciones y articulando alianzas estratégicas con actores clave del sector.",
    presentacion: [
      "Con más de 35 años de experiencia en el ámbito educativo y deportivo, mi recorrido abarca desde la docencia y el entrenamiento de alto rendimiento hasta la gestión directiva, la coordinación de campos deportivos y la dirección pedagógica en la formación de futuros docentes de Educación Física.",
      "A lo largo de mi trayectoria en la conducción de instituciones públicas y privadas, viví en primera persona lo complejo que resulta conformar equipos sólidos y resolver coberturas urgentes sin interrumpir las actividades.",
      "Cofundé UNIDOAR con la convicción de que la innovación tecnológica, a través de una app, puede transformar esa realidad. Mi foco está en aportar el conocimiento operativo y pedagógico para que esta herramienta responda de forma genuina a los requerimientos del sector, buscando que las instituciones y los profesionales hagan el match justo, conectando las necesidades de cada staff con las mejores oportunidades laborales.",
    ],
  },
];

/** Las iniciales de un nombre completo: la primera letra de la primera y de la última palabra ("Ariel Gómez" → "AG"). */
function iniciales(nombre: string) {
  const palabras = nombre.trim().split(/\s+/);
  const primera = palabras[0]?.[0] ?? "";
  const ultima = palabras.length > 1 ? (palabras[palabras.length - 1]?.[0] ?? "") : "";
  return `${primera}${ultima}`.toUpperCase();
}

export default function QuienesSomos() {
  return (
    <>
      <div className="mx-auto flex w-full max-w-[1296px] flex-col gap-10 px-12 pt-10 max-[900px]:px-6 max-[560px]:gap-8 max-[560px]:pt-6">
        <section className="relative overflow-hidden rounded-marco bg-navy-900 px-12 py-14 text-white max-[560px]:px-6 max-[560px]:py-10">
          <NodosMarca className="absolute -top-12 -right-10 w-[300px] opacity-90 max-[760px]:w-[180px] max-[760px]:opacity-60" />
          <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,380px)] items-center gap-x-14 gap-y-9 max-[900px]:grid-cols-1">
            <div>
              <span className="inline-block rounded-full bg-celeste/18 px-2.5 py-[5px] text-xs leading-none font-semibold text-celeste">
                Nosotros · Equipo UNIDOAR
              </span>
              <h1 className="font-display mt-3.5 mb-4 max-w-[20ch] text-[44px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance max-[560px]:text-[32px]">
                Quiénes impulsan UNIDOAR
              </h1>
              <p className="m-0 max-w-[60ch] text-[17px] leading-[1.65] text-white/75">
                Somos un equipo con una trayectoria de vida dedicada a la educación y el deporte. Unimos esa experiencia con la
                tecnología para que las instituciones y los profesionales se conecten de forma simple, directa y transparente.
              </p>
            </div>
            <figure className="m-0 max-[900px]:mx-auto max-[900px]:w-full max-[900px]:max-w-[380px]">
              <Imagen
                src={FOTO_DEL_EQUIPO}
                alt="El equipo de UNIDOAR frente al logo de la marca"
                width={928}
                height={1152}
                loading="eager"
                fetchPriority="high"
                style={{ objectPosition: focoDeFoto(FOTO_DEL_EQUIPO) }}
                className="block aspect-[928/1152] w-full rounded-panel object-cover shadow-[0_18px_44px_rgba(0,0,0,.35)] ring-1 ring-white/15"
              />
            </figure>
          </div>
        </section>

        <section aria-labelledby="proposito" className="rounded-tarjeta bg-white p-10 shadow-tarjeta max-[560px]:p-6">
          <div className="mb-8 max-w-[640px]">
            <span className="mb-2 block text-xs leading-none font-semibold tracking-[.09em] text-naranja uppercase">
              El corazón de UNIDOAR
            </span>
            <h2
              id="proposito"
              className="font-display m-0 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta max-[560px]:text-[26px]"
            >
              Propósito y alcance
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-6 max-[860px]:grid-cols-1">
            {PROPOSITO.map((p) => (
              <div key={p.titulo} className="rounded-interno bg-lienzo p-6 max-[560px]:p-5">
                <h3 className="font-display m-0 mb-2.5 text-[19px] leading-[1.25] font-semibold tracking-[-0.01em] text-tinta">{p.titulo}</h3>
                <p className="m-0 text-[15.5px] leading-[1.7] text-tinta-2">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Misión y visión" className="grid grid-cols-2 gap-6 max-[860px]:grid-cols-1">
          {[
            { etiqueta: "Misión", texto: MISION },
            { etiqueta: "Visión", texto: VISION },
          ].map((m) => (
            <figure key={m.etiqueta} className="m-0 flex flex-col rounded-tarjeta bg-white p-10 shadow-tarjeta max-[560px]:p-6">
              <span className="mb-4 inline-flex w-fit rounded-full bg-navy-50 px-3 py-1.5 text-xs leading-none font-semibold tracking-[.09em] text-navy-700 uppercase">
                {m.etiqueta}
              </span>
              <blockquote className="font-display m-0 text-[21px] leading-[1.5] font-medium tracking-[-0.01em] text-balance text-tinta max-[560px]:text-[18px]">
                “{m.texto}”
              </blockquote>
            </figure>
          ))}
        </section>

        <section aria-labelledby="valores">
          <div className="mx-auto mb-8 max-w-[640px] text-center">
            <h2
              id="valores"
              className="font-display m-0 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta max-[560px]:text-[26px]"
            >
              Valores fundamentales
            </h2>
          </div>
          <ul className="m-0 grid list-none grid-cols-4 gap-6 p-0 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1">
            {VALORES.map((v) => (
              <li key={v.titulo} className="flex flex-col rounded-tarjeta bg-white p-7 shadow-tarjeta max-[560px]:p-6">
                <span
                  aria-hidden
                  className="mb-4 inline-flex size-12 flex-none items-center justify-center rounded-full bg-navy-50 text-navy-700"
                >
                  <Icono nombre={v.icono} tamano={22} trazo={1.8} />
                </span>
                <h3 className="font-display m-0 mb-2 text-[18px] leading-[1.25] font-semibold tracking-[-0.01em] text-tinta min-[1101px]:min-h-[2.5em]">
                  {v.titulo}
                </h3>
                <p className="m-0 text-[14.5px] leading-[1.65] text-tinta-2">{v.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-tarjeta bg-white p-10 shadow-tarjeta max-[560px]:p-6">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-12 gap-y-4 max-[860px]:grid-cols-1">
            <h2 className="font-display m-0 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta">Cómo trabajamos</h2>
            <div className="flex flex-col gap-[18px] text-[16px] leading-[1.75] text-tinta-2">
              <p className="m-0">
                Combinamos el conocimiento profundo del campo institucional con una app pensada por profesionales que
                vienen del sector.{" "}
                <strong className="font-semibold text-tinta">
                  No nos limitamos a publicar avisos: diseñamos una herramienta ágil
                </strong>{" "}
                para lograr el match exacto entre lo que necesita una institución y el talento que un profesional puede
                aportar.
              </p>
              <p className="m-0">
                Creemos en un modelo verdaderamente federal y abierto, donde colegios, clubes, gimnasios, natatorios y
                profesionales de cada rincón del país se conectan de forma simple y transparente, al alcance de la mano.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="fundadores">
          <div className="mx-auto mb-8 max-w-[640px] text-center">
            <h2
              id="fundadores"
              className="font-display m-0 mb-2.5 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta"
            >
              Nuestros fundadores
            </h2>
            <p className="m-0 text-base leading-[1.6] text-apagado">
              Experiencia real, gestión y tecnología unidas por quienes crearon el proyecto.
            </p>
          </div>

          {/* En escritorio cada tarjeta usa las mismas tres filas (nombre, enfoque, texto): aunque un nombre ocupe dos líneas, todo queda a la misma altura. */}
          <ul className="m-0 grid list-none grid-cols-3 gap-6 p-0 min-[1001px]:grid-rows-[auto_auto_1fr] min-[1001px]:gap-y-0 max-[1000px]:grid-cols-1">
            {FUNDADORES.map((f) => (
              <li
                key={f.nombre}
                className="flex flex-col rounded-tarjeta bg-white p-8 shadow-tarjeta max-[560px]:p-6 min-[1001px]:row-span-3 min-[1001px]:grid min-[1001px]:grid-rows-subgrid"
              >
                <div className="mb-5 flex items-start gap-3.5">
                  {f.foto ? (
                    <Imagen
                      src={f.foto}
                      alt={`Foto de ${f.nombre}`}
                      style={{ objectPosition: focoDeFoto(f.foto) }}
                      className="block size-14 flex-none rounded-full object-cover ring-1 ring-borde"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="font-display inline-flex size-14 flex-none items-center justify-center rounded-full bg-navy-50 text-[18px] font-semibold text-navy-700"
                    >
                      {iniciales(f.nombre)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="mb-1.5 block text-xs leading-none font-semibold tracking-[.09em] text-naranja uppercase">
                      Cofundador
                    </span>
                    <h3 className="font-display m-0 text-[21px] leading-[1.2] font-semibold tracking-[-0.015em] text-tinta">
                      {f.nombre}
                    </h3>
                  </div>
                </div>
                <p className="m-0 mb-5 rounded-interno bg-lienzo px-4 py-3.5 text-[13.5px] leading-[1.55] text-tinta-2">
                  <span className="mb-1 block text-[11px] leading-none font-semibold tracking-[.09em] text-apagado uppercase">Enfoque</span>
                  {f.enfoque}
                </p>
                <div className="flex flex-col gap-3.5 text-[14.5px] leading-[1.7] text-tinta-2">
                  {f.presentacion.map((p) => (
                    <p key={p.slice(0, 32)} className="m-0">
                      {p}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <BandaCTA
        etiqueta={
          <span className="inline-flex rounded-full bg-celeste/18 px-2.5 py-[5px] text-xs leading-none font-semibold text-celeste">
            ¿Te sumás?
          </span>
        }
        titulo="Sumate como institución o como profesional"
        texto="Es gratis para profesionales y toma dos minutos empezar."
        acciones={
          <BotonLink href="/registro" variante="cta" tamano="lg">
            Empezar ahora
          </BotonLink>
        }
      />
    </>
  );
}
