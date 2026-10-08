"use client";

import { useActionState, useState } from "react";
import { cambiarContrasenaCuenta } from "@/app/actions/cuenta";
import { Boton } from "@/components/ui/button";
import { Campo } from "@/components/ui/campos";
import { InputContrasena } from "@/components/ui/input-contrasena";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import type { Resultado } from "@/lib/acciones";

/**
 * Cambio de contraseña con la sesión abierta. Una cuenta creada solo con Google no tiene contraseña:
 * ahí se muestra "Crear una contraseña" y no se pide la actual.
 */
export function CuentaContrasena({ tieneContrasena }: { tieneContrasena: boolean }) {
  const toast = useToast();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const [estado, accion, pendiente] = useActionState<Resultado | null, FormData>(async (previo, formData) => {
    const r = await cambiarContrasenaCuenta(previo, formData);
    if (r.ok) {
      toast(tieneContrasena ? "Contraseña actualizada" : "Contraseña creada");
      setActual("");
      setNueva("");
      setConfirmacion("");
    }
    return r;
  }, null);
  const errores = estado && !estado.ok ? (estado.campos ?? {}) : {};

  return (
    <Tarjeta como="section" className="p-[22px]">
      <h2 className="m-0 mb-1.5 text-base leading-none font-semibold">{tieneContrasena ? "Cambiar contraseña" : "Crear una contraseña"}</h2>
      <p className="m-0 mb-4 text-sm leading-normal text-apagado">
        {tieneContrasena
          ? "Usá al menos 8 caracteres. Tu sesión sigue abierta después de cambiarla."
          : "Ingresás con Google. Si querés poder entrar también con tu email, creá una contraseña (al menos 8 caracteres)."}
      </p>
      <form action={accion} className="flex max-w-[420px] flex-col gap-3.5">
        {tieneContrasena && (
          <Campo etiqueta="Contraseña actual" error={errores.actual}>
            <InputContrasena
              aria-label="Contraseña actual"
              name="actual"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={Boolean(errores.actual)}
            />
          </Campo>
        )}
        <Campo etiqueta="Contraseña nueva" error={errores.nueva}>
          <InputContrasena
            aria-label="Contraseña nueva"
            name="nueva"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            aria-invalid={Boolean(errores.nueva)}
          />
        </Campo>
        <Campo etiqueta="Repetí la contraseña nueva" error={errores.confirmacion}>
          <InputContrasena
            aria-label="Repetí la contraseña nueva"
            name="confirmacion"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={Boolean(errores.confirmacion)}
          />
        </Campo>
        {estado && !estado.ok && Object.keys(errores).length === 0 && (
          <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
            {estado.error}
          </p>
        )}
        <Boton type="submit" variante="primario" disabled={pendiente} aria-busy={pendiente} className="self-start max-[560px]:w-full">
          {pendiente ? "Guardando…" : tieneContrasena ? "Cambiar contraseña" : "Crear contraseña"}
        </Boton>
      </form>
    </Tarjeta>
  );
}
