import Link from "next/link";
import { Icono } from "@/components/icons";

/** "‹ Mis cursos / Título": flecha redonda de volver al listado y la ruta hasta la pantalla actual. */
export function CursoMigas({ actual }: { actual: string }) {
  return (
    <nav aria-label="Ruta" className="mb-[18px] flex items-center gap-2">
      <Link
        href="/institucion/cursos"
        aria-label="Volver a Mis cursos"
        className="inline-flex size-[30px] flex-none items-center justify-center rounded-full border border-borde bg-white text-tinta-2 shadow-[0_1px_2px_rgba(31,36,33,.06)] transition-colors hover:border-borde-fuerte hover:bg-[#F0EFEA] focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
      >
        <Icono nombre="flecha" tamano={16} trazo={2} className="rotate-180" />
      </Link>
      <span className="min-w-0 truncate text-[13px] leading-none text-apagado">
        <Link href="/institucion/cursos" className="text-apagado hover:text-tinta">
          Mis cursos
        </Link>
        <span className="px-[7px] text-borde-fuerte">/</span>
        <span className="font-medium text-tinta">{actual}</span>
      </span>
    </nav>
  );
}
