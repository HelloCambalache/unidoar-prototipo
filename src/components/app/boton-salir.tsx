"use client";

import { salir } from "@/app/actions/auth";
import { Boton } from "@/components/ui/button";

/**
 * Cierra la sesión y vuelve al inicio. Para pantallas que no tienen el menú de la app. Lo hace el servidor (la acción `salir`): las cookies
 * de sesión no las puede leer ni borrar el navegador.
 */
export function BotonSalir({ children = "Cerrar sesión" }: { children?: React.ReactNode }) {
  return (
    <form action={salir} className="contents">
      <Boton type="submit" variante="secundario">
        {children}
      </Boton>
    </form>
  );
}
