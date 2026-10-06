"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ingresar, ingresarConGoogle } from "@/app/actions/auth";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { BotonGoogle } from "@/components/onboarding/boton-google";
import { ReenviarConfirmacion } from "@/components/onboarding/confirmar-mail";
import { AlertaError, SeparadorConTexto, TituloPaso } from "@/components/onboarding/elementos";
import type { EstadoAuth } from "@/lib/acceso";

/** /ingresar: email + contraseña o Google. `siguiente` ya viene validado como ruta interna. */
export function FormularioIngreso({ siguiente, errorInicial }: { siguiente: string; errorInicial?: string }) {
  const [estado, accion, pendiente] = useActionState(
    async (previo: EstadoAuth, formData: FormData): Promise<EstadoAuth> => {
      if (formData.get("metodo") === "google") return ingresarConGoogle(null, formData);
      return ingresar(previo, formData);
    },
    null,
  );

  const fallo = estado && !estado.ok ? estado : null;
  const campos = fallo?.campos ?? {};
  const valores = fallo?.valores ?? {};
  const errorGeneral = fallo ? (Object.keys(campos).length === 0 ? fallo.error : undefined) : errorInicial;

  return (
    <form action={accion}>
      <input type="hidden" name="metodo" defaultValue="password" />
      <input type="hidden" name="next" value={siguiente} />
      <TituloPaso titulo="Ingresá a tu cuenta" bajada="Con el email y la contraseña con los que te registraste." />
      <div className="flex flex-col gap-3.5">
        <Campo etiqueta="Email" error={campos.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="nombre@mail.com"
            required
            defaultValue={valores.email}
            aria-invalid={Boolean(campos.email)}
          />
        </Campo>
        <Campo etiqueta="Contraseña" error={campos.password}>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(campos.password)}
          />
        </Campo>
        <Link href="/ingresar/recuperar" className="self-end text-[13px] leading-none font-medium text-navy-700 hover:text-naranja">
          ¿Olvidaste tu contraseña?
        </Link>

        <AlertaError>{errorGeneral}</AlertaError>
        {fallo?.codigo === "email_not_confirmed" && valores.email && <ReenviarConfirmacion rol={null} email={valores.email} />}

        <Boton type="submit" bloque disabled={pendiente} className="min-h-12 text-base">
          {pendiente ? "Un segundo…" : "Ingresar"}
        </Boton>
        <SeparadorConTexto>o ingresá con Google</SeparadorConTexto>
        <BotonGoogle deshabilitado={pendiente} />
      </div>

      <p className="mt-[22px] mb-0 text-[13px] leading-snug text-apagado">
        ¿Todavía no tenés cuenta?{" "}
        <Link href="/registro" className="font-semibold text-navy-700 hover:text-naranja">
          Creá una
        </Link>
      </p>
    </form>
  );
}
