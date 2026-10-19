import { Insignia } from "@/components/ui/insignia";
import { focoDeFoto } from "@/lib/fotos";
import { cn } from "@/lib/utils";
import { Icono, type IconoClave } from "@/components/icons";

/*
 * Banners editoriales de UNIDOAR en el tablero del docente. Es contenido fijo de marca (no sale
 * de la base ni hay anunciantes cargados): el día que haya publicidad real, esto se reemplaza.
 */

export function PublicidadAncha({ fondo = "azul", className }: { fondo?: "azul" | "noche"; className?: string }) {
  const color = fondo === "noche" ? "#040B35" : "#16214F";
  return (
    <div
      style={{ backgroundColor: color }}
      className={cn("relative flex items-stretch overflow-hidden rounded-panel max-[860px]:flex-col", className)}
    >
      <div className="relative z-[1] flex min-w-0 flex-1 flex-wrap items-center justify-between gap-5 px-7 py-[26px]">
        <div className="min-w-0 flex-[1_1_300px]">
          <Insignia className="mb-2.5 bg-white/[.14] text-navy-100">Publicidad</Insignia>
          <div className="font-display mb-1.5 text-[22px] leading-[1.25] font-bold text-white">
            Mutual Profesional · préstamos y descuentos
          </div>
          <div className="max-w-[52ch] text-sm leading-[1.55] text-white/75">
            Créditos a sola firma, turismo y farmacia con descuento para profesionales y personal de instituciones educativas.
            Asociarse es gratis.
          </div>
        </div>
      </div>
      <div
        aria-hidden
        style={{ backgroundImage: "url(/assets/hero-docente.jpg)", backgroundPosition: focoDeFoto("/assets/hero-docente.jpg") }}
        className="relative w-[30%] flex-none bg-cover bg-no-repeat max-[860px]:order-first max-[860px]:h-32 max-[860px]:w-full"
      >
        <span
          style={{ backgroundImage: `linear-gradient(90deg,${color},transparent)` }}
          className="pointer-events-none absolute inset-y-0 left-0 w-24 max-[860px]:hidden"
        />
      </div>
    </div>
  );
}

/** El mismo aviso que `PublicidadAncha`, como tarjeta con foto para ir al lado del banner de bienvenida. */
export function PublicidadLateral({ className }: { className?: string }) {
  const foto = "/assets/hero-docente.jpg";
  return (
    <aside
      aria-label="Publicidad"
      className={cn("relative flex min-h-[240px] flex-col justify-end overflow-hidden rounded-marco bg-navy-700", className)}
    >
      <div
        aria-hidden
        style={{ backgroundImage: `url(${foto})`, backgroundPosition: focoDeFoto(foto) }}
        className="absolute inset-0 bg-cover bg-no-repeat"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,33,79,0)_15%,rgba(22,33,79,.94)_75%)]"
      />
      <div className="relative flex flex-col gap-2 px-6 pt-10 pb-6">
        <Insignia className="self-start bg-white/[.18] text-white">Publicidad</Insignia>
        <div className="font-display text-[19px] leading-[1.25] font-semibold text-white">
          Mutual Profesional · préstamos y descuentos
        </div>
        <div className="text-[13.5px] leading-normal text-white/80">
          Créditos a sola firma, turismo y farmacia con descuento. Asociarse es gratis.
        </div>
      </div>
    </aside>
  );
}

type Aviso = { icono: IconoClave; titulo: string; texto: string; fondo: string; foto: string };

const AVISOS: Aviso[] = [
  {
    fondo: "#16214F",
    foto: "/assets/hero-aula.jpg",
    titulo: "Librería El Aula · 25% para profesionales",
    texto:
      "Manuales, material didáctico y literatura infantil. Mostrás tu perfil verificado de UNIDOAR en la caja y tenés el descuento todo el año.",
    icono: "cursos",
  },
  {
    fondo: "#97125F",
    foto: "/assets/cat-guardavidas-pileta.jpg",
    titulo: "Seguro de responsabilidad civil profesional",
    texto:
      "Cobertura para quienes trabajan con grupos: educación física, natación, colonias y salidas. Desde $4.900 por mes, sin trámite presencial.",
    icono: "escudo",
  },
];

export function PublicidadesPareja({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 max-[700px]:grid-cols-1", className)}>
      {AVISOS.map((a) => (
        <div
          key={a.titulo}
          style={{ backgroundColor: a.fondo }}
          className="relative flex overflow-hidden rounded-panel max-[980px]:flex-col"
        >
          <div className="relative z-[1] flex min-w-0 flex-1 flex-col px-6 py-[22px]">
            <div className="mb-3 flex items-center gap-[9px]">
              <span className="inline-flex size-8 flex-none items-center justify-center rounded-[9px] bg-white/[.16] text-white">
                <Icono nombre={a.icono} tamano={18} trazo={1.7} />
              </span>
              <Insignia className="bg-white/[.16] text-white/[.88]">Publicidad</Insignia>
            </div>
            <div className="font-display mb-[5px] text-[18px] leading-[1.3] font-bold text-white">{a.titulo}</div>
            <div className="text-[13.5px] leading-normal text-white/80">{a.texto}</div>
          </div>
          <div
            aria-hidden
            style={{ backgroundImage: `url(${a.foto})`, backgroundPosition: focoDeFoto(a.foto) }}
            className="relative w-[38%] flex-none bg-cover bg-no-repeat max-[980px]:order-first max-[980px]:h-[132px] max-[980px]:w-full"
          >
            <span
              style={{ backgroundImage: `linear-gradient(90deg,${a.fondo},transparent)` }}
              className="pointer-events-none absolute inset-y-0 left-0 w-[72px] max-[980px]:hidden"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
