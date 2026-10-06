"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ingresarConGoogle, registrarse } from "@/app/actions/auth";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input } from "@/components/ui/campos";
import { BotonGoogle } from "@/components/onboarding/boton-google";
import { ConfirmarMail } from "@/components/onboarding/confirmar-mail";
import { AlertaError, EnlaceVolver, SeparadorConTexto, TituloPaso } from "@/components/onboarding/elementos";
import { PRIMER_PASO_PROTEGIDO, type EstadoAuth } from "@/lib/acceso";
import type { RolAlta } from "@/lib/onboarding";

/**
 * Paso 1 del alta ("Creá tu acceso" / "Creá tu cuenta"): email + contraseña o Google.
 * El docente además deja su nombre y acepta los términos (la institución los acepta en el paso 2).
 */
export function FormularioRegistro({ rol }: { rol: RolAlta }) {
  const esDocente = rol === "docente";
  const [otroEmail, setOtroEmail] = useState(false);
  const [estado, accion, pendiente] = useActionState(
    async (previo: EstadoAuth, formData: FormData): Promise<EstadoAuth> => {
      setOtroEmail(false);
      if (formData.get("metodo") === "google") return ingresarConGoogle(rol, formData);
      return registrarse(rol, previo, formData);
    },
    null,
  );

  if (estado?.ok && estado.confirmarEmail && !otroEmail) {
    return <ConfirmarMail email={estado.confirmarEmail} rol={rol} onOtroEmail={() => setOtroEmail(true)} />;
  }

  const fallo = estado && !estado.ok ? estado : null;
  const campos = fallo?.campos ?? {};
  const valores = fallo?.valores ?? {};
  const errorGeneral = fallo && Object.keys(campos).length === 0 ? fallo.error : undefined;

  return (
    <form action={accion}>
      <input type="hidden" name="metodo" defaultValue="password" />
      <TituloPaso
        titulo={esDocente ? "Creá tu cuenta" : "Creá tu acceso"}
        bajada={esDocente ? "Es gratis y tardás dos minutos." : "Con esto vas a ingresar la próxima vez."}
      />
      <div className="mb-[22px] flex flex-col gap-3.5">
        {esDocente && (
          <Campo etiqueta="Nombre completo" error={campos.nombre}>
            <Input
              name="nombre"
              autoComplete="name"
              placeholder="Ej. Luciana Prieto"
              required
              minLength={2}
              defaultValue={valores.nombre}
              aria-invalid={Boolean(campos.nombre)}
            />
          </Campo>
        )}
        <Campo etiqueta="Email" error={campos.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder={esDocente ? "nombre@mail.com" : "nombre@colegio.edu.ar"}
            required
            defaultValue={valores.email}
            aria-invalid={Boolean(campos.email)}
          />
        </Campo>
        <Campo etiqueta="Contraseña" error={campos.password}>
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
      </div>

      <div className="flex flex-col gap-3.5">
        <SeparadorConTexto>o registrate con Google</SeparadorConTexto>
        <BotonGoogle deshabilitado={pendiente} />

        {esDocente && (
          <div>
            <Casilla name="aceptaTerminos" required className="mt-1.5">
              Acepto los{" "}
              <Link href="/terminos" target="_blank" className="font-semibold text-naranja">
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

        <AlertaError>{errorGeneral}</AlertaError>
        <Boton
          type="submit"
          variante={esDocente ? "cta" : "primario"}
          bloque
          disabled={pendiente}
          className="min-h-12 text-base"
        >
          {pendiente ? "Un segundo…" : "Continuar"}
        </Boton>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <EnlaceVolver href="/registro" />
        <span className="text-[13px] text-apagado">
          ¿Ya tenés cuenta?{" "}
          <Link href={`/ingresar?next=${encodeURIComponent(PRIMER_PASO_PROTEGIDO[rol])}`} className="font-semibold text-navy-700">
            Ingresá
          </Link>
        </span>
      </div>
    </form>
  );
}
