import { BotonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PASOS = [
  { titulo: "Publicá la búsqueda", texto: "Cargo, horas y turno. Tarda dos minutos." },
  { titulo: "Mirá quién se postula", texto: "Ya vienen con identidad y título verificados." },
  { titulo: "Entrevistá y contratá", texto: "Hablan por WhatsApp. Sin comisión." },
];

/** Banner azul "Cubrir un cargo son tres pasos" del dashboard (con o sin botones de acción). */
export function BannerPasos({
  titulo,
  acentuado = "ambar",
  conAcciones = false,
}: {
  titulo: string;
  /** Color de los números y del resplandor: ámbar (dashboard) o celeste (primera vez). */
  acentuado?: "ambar" | "celeste";
  conAcciones?: boolean;
}) {
  return (
    <section
      aria-label="Cómo cubrir un cargo"
      className="relative flex flex-col justify-center overflow-hidden rounded-xl bg-navy-700 px-6 py-[22px] max-[560px]:px-5"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-20 -right-12 size-[240px] rounded-full",
          acentuado === "ambar"
            ? "bg-[radial-gradient(circle,rgba(221,85,63,.38),transparent_70%)]"
            : "bg-[radial-gradient(circle,rgba(130,216,233,.22),transparent_70%)]",
        )}
      />
      <div className="relative z-[1]">
        <h2 className="m-0 mb-3 font-display text-[19px] leading-tight font-bold tracking-[-0.02em] text-white">{titulo}</h2>
        <ol className="m-0 mb-5 grid list-none grid-cols-3 gap-4 p-0 max-[1180px]:grid-cols-1 max-[1180px]:gap-3">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex flex-col gap-2 max-[1180px]:flex-row max-[1180px]:items-start max-[1180px]:gap-[11px]">
              <span
                className={cn(
                  "inline-flex size-5 flex-none items-center justify-center rounded-full text-[11px] leading-none font-bold text-navy-700",
                  acentuado === "ambar" ? "bg-ambar" : "bg-celeste",
                )}
              >
                {i + 1}
              </span>
              <span className="text-[13.5px] leading-normal text-white/80">
                <b className="font-semibold text-white">{p.titulo}</b>
                <br />
                {p.texto}
              </span>
            </li>
          ))}
        </ol>
        {conAcciones && (
          <div className="flex flex-wrap gap-2.5">
            <BotonLink href="/institucion/publicar" variante="cta">
              Publicar una búsqueda
            </BotonLink>
            <BotonLink
              href="/institucion/buscar-docentes"
              variante="fantasma"
              className="border-white/35 text-white hover:bg-white/10 hover:text-white"
            >
              Buscar en el catálogo
            </BotonLink>
          </div>
        )}
      </div>
    </section>
  );
}
