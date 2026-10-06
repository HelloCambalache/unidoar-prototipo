"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cambiarContrasena, recuperarContrasena } from "@/app/actions/auth";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { AlertaAviso, AlertaError, TituloPaso } from "@/components/onboarding/elementos";

/** /ingresar/recuperar: pide el email y manda el enlace para elegir una contraseña nueva. */
export function FormularioRecuperar() {
  const [estado, accion, pendiente] = useActionState(recuperarContrasena, null);
  const fallo = estado && !estado.ok ? estado : null;
  const campos = fallo?.campos ?? {};
  const enviado = estado?.ok ? estado.mensaje : undefined;

  return (
    <form action={accion}>
      <TituloPaso
        titulo="Recuperá tu contraseña"
        bajada="Escribí el email de tu cuenta y te mandamos un enlace para elegir una contraseña nueva."
      />
      <div className="flex flex-col gap-3.5">
        <Campo etiqueta="Email" error={campos.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="nombre@mail.com"
            required
            defaultValue={fallo?.valores?.email}
            aria-invalid={Boolean(campos.email)}
          />
        </Campo>
        <AlertaError>{fallo && Object.keys(campos).length === 0 ? fallo.error : undefined}</AlertaError>
        <AlertaAviso>{enviado}</AlertaAviso>
        <Boton type="submit" bloque disabled={pendiente} className="min-h-12 text-base">
          {pendiente ? "Enviando…" : "Enviar el enlace"}
        </Boton>
      </div>
      <p className="mt-[22px] mb-0 text-[13px] leading-snug text-apagado">
        <Link href="/ingresar" className="font-semibold text-navy-700 hover:text-naranja">
          ← Volver a ingresar
        </Link>
      </p>
    </form>
  );
}

/** /ingresar/nueva-contrasena: la sesión la dejó el enlace del mail; elige la contraseña nueva. */
export function FormularioNuevaContrasena() {
  const [estado, accion, pendiente] = useActionState(cambiarContrasena, null);
  const fallo = estado && !estado.ok ? estado : null;
  const campos = fallo?.campos ?? {};

  return (
    <form action={accion}>
      <TituloPaso titulo="Elegí tu contraseña nueva" bajada="Mínimo 8 caracteres. Después ingresás directo a tu cuenta." />
      <div className="flex flex-col gap-3.5">
        <Campo etiqueta="Contraseña nueva" error={campos.password}>
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            maxLength={72}
            aria-invalid={Boolean(campos.password)}
          />
        </Campo>
        <Campo etiqueta="Repetí la contraseña" error={campos.confirmacion}>
          <Input
            type="password"
            name="confirmacion"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-invalid={Boolean(campos.confirmacion)}
          />
        </Campo>
        <AlertaError>{fallo && Object.keys(campos).length === 0 ? fallo.error : undefined}</AlertaError>
        <Boton type="submit" bloque disabled={pendiente} className="min-h-12 text-base">
          {pendiente ? "Guardando…" : "Guardar contraseña"}
        </Boton>
      </div>
    </form>
  );
}
