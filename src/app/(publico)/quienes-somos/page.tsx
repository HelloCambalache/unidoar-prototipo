import type { Metadata } from "next";
import { BandaCTA } from "@/components/publico/banda-cta";
import { BotonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Quiénes somos",
  description:
    "Un equipo con más de 35 años en la educación y el deporte que une experiencia y tecnología para que instituciones y profesionales se conecten de forma simple, directa y transparente.",
};

type Fundador = {
  nombre: string;
  /** Desde dónde mira el proyecto cada uno. */
  enfoque: string;
  /** Un párrafo por elemento. Primera persona, tal como lo escribió cada fundador. */
  presentacion: string[];
};

const FUNDADORES: Fundador[] = [
  {
    nombre: "Ariel Gómez",
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
    enfoque: "Mirada puesta en el encuentro, el desarrollo de capacidades y la apertura de nuevas oportunidades laborales.",
    presentacion: [
      "Soy licenciado en gestión deportiva, profesor nacional de educación física y entrenador de voleibol, con 35 años de experiencia en docencia, educación formal y educación no formal.",
      "Cofundé UNIDOAR con un objetivo concreto: facilitar el encuentro entre quienes buscan una oportunidad de trabajo y las instituciones que necesitan talento. El deporte me enseñó los dos desafíos de cerca: encontrar personas con las capacidades adecuadas y, a la vez, hallar los espacios donde esas capacidades puedan desarrollarse y aportar valor.",
      "Esta app nace para que ese encuentro sea más simple, directo y eficiente. Son tres décadas y media de trayectoria al servicio de una nueva forma de entender el vínculo institucional.",
    ],
  },
  {
    nombre: "Ricardo Castagnone",
    enfoque: "Mirada operativa: eficiencia y soluciones prácticas para el día a día.",
    presentacion: [
      "Tengo más de 35 años de experiencia en el ámbito educativo y deportivo. Mi recorrido abarca la docencia y el entrenamiento de alto rendimiento, la gestión directiva, la coordinación de campos deportivos y la dirección pedagógica en la formación de futuros docentes de educación física.",
      "Como docente, entrenador, coordinador y regente de campos deportivos, y director de instituciones educativas y municipales, viví en primera persona lo complejo que es para una institución armar equipos sólidos y resolver una cobertura urgente sin interrumpir las actividades.",
      "Cofundé UNIDOAR con la convicción de que una app puede cambiar esa realidad. Mi foco está en aportar el conocimiento operativo y pedagógico para que la herramienta responda de verdad a las necesidades del sector, y para que cada institución encuentre el match justo con el talento que busca.",
    ],
  },
];

export default function QuienesSomos() {
  return (
    <>
      <section className="bg-[linear-gradient(180deg,#16214F_0%,#1B2A5E_100%)] px-12 pt-[72px] pb-[64px] text-center text-white max-[560px]:px-6 max-[560px]:pt-12 max-[560px]:pb-12">
        <span className="inline-block rounded-full bg-celeste/18 px-2.5 py-[5px] text-xs leading-none font-semibold text-celeste">
          Nosotros · Equipo UNIDOAR
        </span>
        <h1 className="mx-auto mt-3.5 mb-4 max-w-[24ch] text-[40px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance max-[560px]:text-[30px]">
          Quiénes impulsan UNIDOAR
        </h1>
        <p className="mx-auto max-w-[680px] text-[17px] leading-[1.65] text-white/75">
          Somos un equipo con una trayectoria de vida dedicada a la educación y el deporte. Unimos esa experiencia con la
          tecnología para que las instituciones y los profesionales se conecten de forma simple, directa y transparente.
        </p>
      </section>

      <section className="mx-auto w-full max-w-[1000px] px-12 py-16 max-[560px]:px-6 max-[560px]:py-12">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-12 gap-y-4 max-[860px]:grid-cols-1">
          <h2 className="m-0 text-[26px] leading-[1.25] font-semibold tracking-[-0.02em] text-tinta">Cómo trabajamos</h2>
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

      <section aria-labelledby="fundadores" className="bg-app px-12 py-16 max-[560px]:px-6 max-[560px]:py-12">
        <div className="mx-auto w-full max-w-[1160px]">
          <div className="mx-auto mb-10 max-w-[640px] text-center">
            <h2 id="fundadores" className="m-0 mb-2.5 text-[28px] leading-[1.25] font-semibold tracking-[-0.02em] text-tinta">
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
                className="flex flex-col rounded-ud border border-borde border-t-4 border-t-navy-700 bg-white p-7 max-[560px]:p-5 min-[1001px]:row-span-3 min-[1001px]:grid min-[1001px]:grid-rows-subgrid"
              >
                <div className="mb-4">
                  <span className="mb-2 block text-xs leading-none font-semibold tracking-[.09em] text-naranja uppercase">Cofundador</span>
                  <h3 className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-0.015em] text-tinta">{f.nombre}</h3>
                </div>
                <p className="m-0 mb-5 rounded-lg bg-superficie px-4 py-3 text-[13.5px] leading-[1.55] text-tinta-2">
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
        </div>
      </section>

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
