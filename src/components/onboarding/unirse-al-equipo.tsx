"use client";

import Link from "next/link";
import { useActionState } from "react";
import { unirseAlEquipo } from "@/app/actions/onboarding";
import { Boton } from "@/components/ui/button";
import { Casilla } from "@/components/ui/campos";
import { AlertaError, TituloPaso } from "@/components/onboarding/elementos";

/**
 * Pantalla de quien llega invitado al equipo de una institución y todavía no aceptó los términos: los acepta y entra directo al
 * equipo (no crea una institución propia).
 */
export function UnirseAlEquipo({ institucion, rol }: { institucion: string; rol: string }) {
  const [estado, accion, pendiente] = useActionState(unirseAlEquipo, null);
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};

  return (
    <form action={accion} className="flex flex-col gap-3.5">
      <TituloPaso
        titulo={`Sumate al equipo de ${institucion}`}
        bajada={
          <>
            Te invitaron como <b className="font-semibold text-tinta">{rol}</b>. Aceptá los términos y entrás directo al equipo.
          </>
        }
      />
      <div>
        <Casilla name="aceptaTerminos" required>
          Acepto los{" "}
          <Link href="/terminos" target="_blank" className="font-semibold text-navy-700">
            términos y condiciones
          </Link>{" "}
          de UNIDOAR.
        </Casilla>
        {campos.aceptaTerminos && (
          <p role="alert" className="mt-1 text-xs text-[#b91c1c]">
            {campos.aceptaTerminos}
          </p>
        )}
      </div>
      <p className="m-0 text-xs leading-normal text-sutil">
        Así cuidamos tus datos:{" "}
        <Link href="/privacidad" target="_blank" className="font-semibold text-navy-700">
          política de privacidad
        </Link>
        .
      </p>
      <AlertaError>{estado && !estado.ok && Object.keys(campos).length === 0 ? estado.error : undefined}</AlertaError>
      <Boton type="submit" bloque disabled={pendiente} className="mt-1 min-h-12 text-base">
        {pendiente ? "Entrando…" : "Entrar al equipo"}
      </Boton>
    </form>
  );
}
