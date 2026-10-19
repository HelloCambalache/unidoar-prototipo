import Link from "next/link";
import { Icono } from "@/components/icons";

/** Flecha redonda + nombre de la lista a la que se vuelve ("Instituciones", "Cobros"). */
export function VolverBo({ href, etiqueta }: { href: string; etiqueta: string }) {
  return (
    <nav aria-label="Ruta" className="mb-[18px] flex items-center gap-2">
      <Link
        href={href}
        aria-label={`Volver a ${etiqueta}`}
        className="inline-flex size-7 flex-none items-center justify-center rounded-full text-tinta-2 transition-colors hover:bg-borde focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
      >
        <Icono nombre="volver" tamano={16} trazo={2} />
      </Link>
      <Link href={href} className="text-[13px] leading-none text-apagado hover:text-tinta">
        {etiqueta}
      </Link>
    </nav>
  );
}
