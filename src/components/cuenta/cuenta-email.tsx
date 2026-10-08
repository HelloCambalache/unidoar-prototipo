"use client";

import { useActionState, useState } from "react";
import { cambiarEmail } from "@/app/actions/cuenta";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { InputContrasena } from "@/components/ui/input-contrasena";
import { Tarjeta } from "@/components/ui/tarjeta";
import type { Resultado } from "@/lib/acciones";

/**
 * Cambio del email de acceso. Pide el email nuevo y la contraseña actual; no cambia nada hasta que la persona abre el
 * enlace de confirmación que manda Supabase. Quien ingresa solo con Google no puede cambiarlo (su email es el de Google).
 */
export function CuentaEmail({ email, tieneContrasena }: { email: string; tieneContrasena: boolean }) {
  const [nuevo, setNuevo] = useState("");
  const [actual, setActual] = useState("");
  const [estado, accion, pendiente] = useActionState<Resultado<{ nuevo: string }> | null, FormData>(async (previo, formData) => {
    const r = await cambiarEmail(previo, formData);
    if (r.ok) {
      setNuevo("");
      setActual("");
    }
    return r;
  }, null);
  const errores = estado && !estado.ok ? (estado.campos ?? {}) : {};

  return (
    <Tarjeta como="section" className="p-[22px]">
      <h2 className="m-0 mb-1.5 text-base leading-none font-semibold">Email de acceso</h2>
      <p className="m-0 mb-4 text-sm leading-normal text-apagado">
        Ingresás con <strong className="text-tinta">{email}</strong>.{" "}
        {tieneContrasena
          ? "Para cambiarlo, escribí el email nuevo y tu contraseña: te mandamos un enlace de confirmación y el email no cambia hasta que lo abras."
          : "Tu cuenta ingresa con Google, así que su email es el de tu cuenta de Google y no se puede cambiar desde acá."}
      </p>
      {tieneContrasena && (
        <form action={accion} noValidate className="flex max-w-[420px] flex-col gap-3.5">
          <Campo etiqueta="Email nuevo" error={errores.email}>
            <Input
              type="email"
              name="email"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              autoComplete="email"
              placeholder="nombre@mail.com"
              required
              aria-invalid={Boolean(errores.email)}
            />
          </Campo>
          <Campo etiqueta="Tu contraseña actual" error={errores.actual}>
            <InputContrasena
              name="actual"
              aria-label="Tu contraseña actual"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={Boolean(errores.actual)}
            />
          </Campo>
          {estado && !estado.ok && Object.keys(errores).length === 0 && (
            <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
              {estado.error}
            </p>
          )}
          {estado?.ok && (
            <p role="status" className="m-0 rounded-lg bg-verde-tint px-3.5 py-2.5 text-[13px] leading-snug text-verde">
              Te mandamos un enlace a <b className="font-semibold">{estado.data.nuevo}</b>. Abrilo para confirmar el cambio; hasta
              entonces seguís ingresando con {email}. Si no lo ves, fijate en spam.
            </p>
          )}
          <Boton type="submit" variante="primario" disabled={pendiente} aria-busy={pendiente} className="self-start max-[560px]:w-full">
            {pendiente ? "Enviando…" : "Cambiar email"}
          </Boton>
        </form>
      )}
    </Tarjeta>
  );
}
