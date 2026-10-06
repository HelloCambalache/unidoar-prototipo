"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition } from "react";

/**
 * Filtros que viven en la URL (searchParams): la página es un Server Component que lee la
 * URL, así el listado se puede compartir. Esto solo cambia la URL; el servidor vuelve a renderizar.
 * Lee `window.location` al aplicar, así dos cambios seguidos no pisan el anterior.
 */
export function useFiltrosUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, empezar] = useTransition();
  const demora = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Un valor vacío quita el parámetro. */
  const aplicar = (cambios: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    const qs = params.toString();
    empezar(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  /** Para el texto libre: espera a que se deje de tipear. */
  const aplicarConDemora = (clave: string, valor: string) => {
    clearTimeout(demora.current);
    demora.current = setTimeout(() => aplicar({ [clave]: valor.trim() }), 300);
  };

  return { aplicar, aplicarConDemora, pendiente };
}
