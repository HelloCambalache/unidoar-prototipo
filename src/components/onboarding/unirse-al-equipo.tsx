"use client";

import Link from "next/link";
import { useActionState } from "react";
import { rechazarInvitacionAlEquipo, unirseAlEquipo } from "@/app/actions/onboarding";
import { Boton } from "@/components/ui/button";
import { Casilla } from "@/components/ui/campos";
import { AlertaError, TituloPaso } from "@/components/onboarding/elementos";

/**
 * Pantalla de quien tiene una invitación al equipo de una institución (paso 2 del alta): la acepta con un toque o la rechaza y sigue
 * con su propia institución. Una invitación nunca se activa sola. Los términos solo se piden si la cuenta no tiene constancia.
 */
export function UnirseAlEquipo({ institucion, rol, pedirTerminos }: { institucion: string; rol: string; pedirTerminos: boolean }) {
  const [estado, accion, pendiente] = useActionState(unirseAlEquipo, null);
  const [estadoRechazo, rechazar, rechazando] = useActionState(rechazarInvitacionAlEquipo, null);
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};
  const error =
    (estado && !estado.ok && Object.keys(campos).length === 0 ? estado.error : undefined) ??
    (estadoRechazo && !estadoRechazo.ok ? estadoRechazo.error : undefined);

  return (
    <div className="flex flex-col gap-3.5">
      <TituloPaso
        titulo={`Te invitaron al equipo de ${institucion}`}
        bajada={
          <>
            Te invitaron como <b className="font-semibold text-tinta">{rol}</b>. Si lo aceptás, entrás al equipo y ves lo que ve todo el equipo:
            búsquedas, postulantes y sus datos de contacto. Si no es para vos, rechazala y seguís con tu propia institución.
          </>
        }
      />
      <form action={accion} className="flex flex-col gap-3.5">
        {pedirTerminos && (
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
        )}
        <p className="m-0 text-xs leading-normal text-sutil">
          Así cuidamos tus datos:{" "}
          <Link href="/privacidad" target="_blank" className="font-semibold text-navy-700">
            política de privacidad
          </Link>
          .
        </p>
        <AlertaError>{error}</AlertaError>
        <Boton type="submit" bloque disabled={pendiente || rechazando} className="mt-1 min-h-12 text-base">
          {pendiente ? "Entrando…" : "Aceptar y entrar al equipo"}
        </Boton>
      </form>
      <form action={rechazar}>
        <Boton type="submit" variante="secundario" bloque disabled={pendiente || rechazando} className="min-h-12 text-base">
          {rechazando ? "Rechazando…" : "No es para mí: rechazar la invitación"}
        </Boton>
      </form>
    </div>
  );
}
