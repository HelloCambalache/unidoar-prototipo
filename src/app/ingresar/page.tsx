import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioIngreso } from "@/components/onboarding/formulario-ingreso";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { ERRORES_DE_INGRESO, rutaInternaSegura } from "@/lib/acceso";
import { sesionActual } from "@/lib/auth";
import { googleHabilitado } from "@/lib/supabase/proveedores";

// Los enlaces a pantallas con sesión (/docente/…, /institucion/…) llegan acá cuando WhatsApp o una red arma la vista previa.
// No se redefine `openGraph`/`twitter`: así la vista previa usa la del sitio (título de marca, descripción e imagen).
export const metadata: Metadata = {
  title: { absolute: "UNIDOAR · Ingresá a tu cuenta" },
  description: "Entrá a tu cuenta de UNIDOAR para ver búsquedas, postulaciones y profesionales verificados cerca tuyo.",
};

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
