import Link from "next/link";

/** Flecha redonda + nombre de la lista a la que se vuelve ("Instituciones", "Cobros"). */
export function VolverBo({ href, etiqueta }: { href: string; etiqueta: string }) {
  return (
    <nav aria-label="Ruta" className="mb-[18px] flex items-center gap-2">
      <Link
        href={href}
        aria-label={`Volver a ${etiqueta}`}
        className="inline-flex size-7 flex-none items-center justify-center rounded-full text-tinta-2 transition-colors hover:bg-borde focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </Link>
      <Link href={href} className="text-[13px] leading-none text-apagado hover:text-tinta">
        {etiqueta}
      </Link>
    </nav>
  );
}
