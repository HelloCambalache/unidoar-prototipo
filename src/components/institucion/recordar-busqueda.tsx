"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { decidirMemoriaDeBusqueda } from "@/lib/filtros-docentes";

type Guardada = { search: string; en: number };

/**
 * Buscar profesionales se acuerda de la última búsqueda (2026-11-05, pedido del cliente: al invitar a alguien, mirar la publicación y volver al
 * buscador, perdía los filtros y la búsqueda para la que estaba invitando, y había que cargarlo todo de nuevo). Los filtros viven en la dirección
 * de la página, así que alcanza con guardar esa dirección en el navegador: al entrar a la ruta pelada —desde el menú, por ejemplo— se retoma. «Limpiar»
 * lleva `?nuevo=1` para empezar de cero. Se guarda por institución (una computadora compartida no mezcla cuentas) y dura un día. No dibuja nada.
 */
export function RecordarBusqueda({ clave }: { clave: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const search = parametros.toString() ? `?${parametros.toString()}` : "";

  useEffect(() => {
    try {
      const cruda = window.localStorage.getItem(clave);
      const guardada = cruda ? (JSON.parse(cruda) as Guardada) : null;
      const decision = decidirMemoriaDeBusqueda(search, guardada && typeof guardada.search === "string" ? guardada : null, Date.now());
      if (decision.accion === "retomar") router.replace(`${ruta}${decision.search}`);
      else if (decision.accion === "guardar") window.localStorage.setItem(clave, JSON.stringify({ search: decision.search, en: Date.now() } satisfies Guardada));
      else if (decision.accion === "olvidar") window.localStorage.removeItem(clave);
    } catch {
      // Sin almacenamiento (ventana privada, bloqueado): el buscador anda igual, solo que no se acuerda.
    }
  }, [clave, ruta, router, search]);

  return null;
}
