import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotonLink } from "@/components/ui/button";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { usuarioActual } from "@/lib/auth";
import { RUTA_INICIO } from "@/lib/catalogo";

export const metadata: Metadata = { title: "Creá tu cuenta" };

/** Selector "Soy institución / Soy docente" a pantalla completa; cada botón abre el paso 1 del alta de ese rol. */
export default async function PaginaRegistro() {
  const usuario = await usuarioActual();
  if (usuario) redirect(RUTA_INICIO[usuario.rol]);

  return (
    <MarcoAcceso>
      <h1 className="m-0 mb-1.5 text-[28px] leading-tight font-semibold tracking-[-0.018em]">Creá tu cuenta</h1>
      <p className="m-0 mb-[30px] text-sm leading-normal text-apagado">Elegí con qué tipo de cuenta querés entrar.</p>
      <div className="flex flex-col gap-3">
        <BotonLink href="/onboarding/institucion/1" variante="cta" tamano="lg" bloque>
          Soy institución
        </BotonLink>
        <BotonLink href="/onboarding/docente/1" variante="primario" tamano="lg" bloque>
          Soy profesional
        </BotonLink>
      </div>
      <p className="mt-6 mb-0 text-[13px] leading-snug text-apagado">
        ¿Ya tenés cuenta?{" "}
        <Link href="/ingresar" className="font-semibold text-navy-700 hover:text-naranja">
          Ingresá
        </Link>
      </p>
    </MarcoAcceso>
  );
}
