import Link from "next/link";
import { NodosMarca } from "@/components/app/nodos-marca";
import { cn } from "@/lib/utils";

/** Banner oscuro de bienvenida del tablero del profesional: saludo, el resumen del día y los dos accesos principales. */
export function BannerBienvenida({
  titulo,
  bajada,
  mostrarPerfil,
  className,
}: {
  titulo: string;
  bajada: string;
  /** Muestra "Completar perfil" mientras le falte algo al perfil. */
  mostrarPerfil: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative flex min-h-[240px] flex-col justify-center gap-3 overflow-hidden rounded-[30px] bg-navy-900 px-7 py-8 text-white min-[700px]:px-10",
        className,
      )}
    >
      <NodosMarca className="absolute -top-3 -right-8 w-[300px] max-[700px]:w-[190px] max-[700px]:opacity-60" />
      <h1 className="font-display relative m-0 max-w-[540px] text-[34px] leading-[1.1] font-semibold tracking-[-0.025em] text-white max-[700px]:text-[26px]">
        {titulo}
      </h1>
      <p className="relative m-0 max-w-[480px] text-[15px] leading-[1.55] text-[#C9CCE0]">{bajada}</p>
      <div className="relative mt-1.5 flex flex-wrap gap-2.5">
        <Link
          href="/docente/oportunidades"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-[22px] text-[15px] font-semibold text-navy-900 transition-colors hover:bg-navy-50 hover:text-navy-900"
        >
          Ver búsquedas
        </Link>
        {mostrarPerfil && (
          <Link
            href="/docente/perfil"
            className="inline-flex min-h-[48px] items-center rounded-full border border-white/35 px-[22px] text-[15px] font-semibold text-white transition-colors hover:bg-white/10 hover:text-white"
          >
            Completar perfil
          </Link>
        )}
      </div>
    </section>
  );
}
