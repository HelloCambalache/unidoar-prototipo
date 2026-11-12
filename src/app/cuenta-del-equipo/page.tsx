import type { Metadata } from "next";
import { BotonSalir } from "@/components/app/boton-salir";
import { BotonLink } from "@/components/ui/button";
import { RUTA_INICIO } from "@/lib/catalogo";

export const metadata: Metadata = { title: "Cuenta del equipo" };

// Dinámica a propósito: una página generada en el build no puede llevar el nonce de la política de contenido (ver src/lib/csp.ts).
export const dynamic = "force-dynamic";

/**
 * Adonde va una cuenta del equipo de UNIDOAR (admin) que intenta crear un perfil de profesional (`usuarioParaAlta`): ese perfil
 * saldría en el catálogo que ven las instituciones y su baja no se podría procesar, porque la cuenta del equipo no se borra.
 */
export default function PaginaCuentaDelEquipo() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-6 py-16">
      <h1 className="m-0 font-display text-[28px] leading-[1.2] font-bold tracking-[-0.02em] text-navy-900">
        Esta cuenta es del equipo de UNIDOAR
      </h1>
      <p className="mt-3 mb-0 text-[15px] leading-relaxed text-apagado">
        Un perfil de profesional es el de una persona que busca trabajo: aparece en el catálogo que ven las instituciones y se verifica
        como cualquier otro. Por eso no se crea desde una cuenta del equipo.
      </p>
      <p className="mt-3 mb-0 text-[15px] leading-relaxed text-apagado">
        Para probar la app como profesional, registrá otra cuenta con otro email (por ejemplo, un alias de Gmail como
        nombre+prueba@gmail.com).
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <BotonLink href={RUTA_INICIO.admin} variante="primario">
          Ir al panel del equipo
        </BotonLink>
        <BotonSalir />
      </div>
    </main>
  );
}
