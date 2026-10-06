import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { hrefBuscador, type FiltrosDocentes } from "@/lib/filtros-docentes";

/**
 * Cambia filtros llevándolos a la URL (la página se vuelve a consultar en el servidor). Solo para Client Components.
 * `filtros` es el estado "en vivo": refleja el cambio al instante mientras la página nueva llega, y vuelve a
 * lo que diga el servidor cuando termina; así los controles no parpadean ni se desfasan de la URL.
 */
export function useFiltrosEnUrl(ruta: string, delServidor: FiltrosDocentes) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [filtros, setFiltros] = useOptimistic(delServidor);
  const aplicar = (cambios: Partial<FiltrosDocentes>) =>
    empezar(() => {
      setFiltros({ ...filtros, ...cambios });
      router.push(hrefBuscador(ruta, filtros, cambios), { scroll: false });
    });
  return { filtros, aplicar, pendiente, router, empezar };
}
