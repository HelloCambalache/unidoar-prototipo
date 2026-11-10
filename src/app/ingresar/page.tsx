import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioIngreso } from "@/components/onboarding/formulario-ingreso";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { ERRORES_DE_INGRESO, rutaInternaSegura } from "@/lib/acceso";
import { sesionActual } from "@/lib/auth";
import { metadatosDePagina, paginaDeIngreso } from "@/lib/seo";
import { googleHabilitado } from "@/lib/supabase/proveedores";

// Los enlaces a pantallas con sesión (/docente/…, /institucion/…) llegan acá cuando WhatsApp o una red arma la vista previa: según el
// área a la que apuntaba el enlace (`?next=`) el título y la descripción hablan de buscar trabajo (docentes) o de buscar profesionales
// (instituciones). Ver `paginaDeIngreso` en src/lib/seo.ts.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ next?: string }> }): Promise<Metadata> {
  const { next } = await searchParams;
  return metadatosDePagina(paginaDeIngreso(rutaInternaSegura(next, "/inicio")));
}

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
