"use client";

import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/button";
import { crearClienteNavegador } from "@/lib/supabase/client";

/** Cierra la sesión de Supabase y vuelve al inicio. Para pantallas que no tienen el menú de la app. */
export function BotonSalir({ children = "Cerrar sesión" }: { children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <Boton
      variante="secundario"
      onClick={async () => {
        await crearClienteNavegador().auth.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {children}
    </Boton>
  );
}
