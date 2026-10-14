"use client";

import { useState, useTransition } from "react";
import { reenviarConfirmacion } from "@/app/actions/auth";
import { Boton } from "@/components/ui/button";
import { AlertaAviso, AlertaError, TituloPaso } from "@/components/onboarding/elementos";
import type { RolAlta } from "@/lib/onboarding";

/** Botón "Reenviar el mail de confirmación" con su resultado (Supabase limita la frecuencia de envío). */
export function ReenviarConfirmacion({ rol, email }: { rol: RolAlta | null; email: string }) {
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  const reenviar = () =>
    empezar(async () => {
      const r = await reenviarConfirmacion(rol, email);
      setResultado(r.ok ? { ok: true, texto: "Listo: te lo mandamos de nuevo." } : { ok: false, texto: r.error });
    });

  return (
    <div className="flex flex-col gap-2.5">
      <Boton variante="secundario" onClick={reenviar} disabled={pendiente || !email}>
        {pendiente ? "Enviando…" : "Reenviar el mail de confirmación"}
      </Boton>
      {resultado &&
        (resultado.ok ? <AlertaAviso>{resultado.texto}</AlertaAviso> : <AlertaError>{resultado.texto}</AlertaError>)}
    </div>
  );
}

/** Pantalla intermedia después de registrarse cuando Supabase pide confirmar el mail antes de abrir sesión. */
export function ConfirmarMail({ email, rol, onOtroEmail }: { email: string; rol: RolAlta; onOtroEmail: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <TituloPaso
        titulo="Revisá tu mail para confirmar tu cuenta"
        bajada={
          <>
            Te mandamos un enlace a <b className="font-semibold text-tinta">{email}</b>. Tocá el botón del mail (desde la compu o desde
            el celular) y seguimos con el alta. Si no lo ves, fijate en spam.
          </>
        }
        className="mb-0"
      />
      <ReenviarConfirmacion rol={rol} email={email} />
      <button
        type="button"
        onClick={onOtroEmail}
        className="self-start text-[13px] leading-none font-medium text-sutil hover:text-tinta"
      >
        Usar otro email
      </button>
    </div>
  );
}
