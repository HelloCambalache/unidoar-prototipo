import type { Metadata } from "next";
import { BotonSalir } from "@/components/app/boton-salir";
import { BotonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cuenta suspendida" };

// Dinámica a propósito: una página generada en el build no puede llevar el nonce de la política de contenido (ver src/lib/csp.ts).
export const dynamic = "force-dynamic";

export default function PaginaCuentaSuspendida() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-6 py-16">
      <h1 className="m-0 font-display text-[28px] leading-[1.2] font-bold tracking-[-0.02em] text-navy-900">
        Tu cuenta está suspendida
      </h1>
      <p className="mt-3 mb-0 text-[15px] leading-relaxed text-apagado">
        El equipo de UNIDOAR suspendió el acceso a esta cuenta. Si creés que es un error o querés regularizarla,
        escribinos y lo revisamos.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <BotonLink href="/contacto" variante="cta">
          Contactar al equipo
        </BotonLink>
        <BotonSalir />
      </div>
    </main>
  );
}
