import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioIngreso } from "@/components/onboarding/formulario-ingreso";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { ERRORES_DE_INGRESO, rutaInternaSegura } from "@/lib/acceso";
import { sesionActual } from "@/lib/auth";
import { googleHabilitado } from "@/lib/supabase/proveedores";

export const metadata: Metadata = { title: "Ingresá" };

export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const siguiente = rutaInternaSegura(next, "/inicio");
  // Con sesión no hay nada que hacer acá: /inicio decide a dónde va según el rol.
  if (await sesionActual()) redirect(siguiente);

  return (
    <MarcoAcceso>
      <FormularioIngreso
        siguiente={siguiente}
        errorInicial={error ? ERRORES_DE_INGRESO[error] : undefined}
        conGoogle={await googleHabilitado()}
      />
    </MarcoAcceso>
  );
}
