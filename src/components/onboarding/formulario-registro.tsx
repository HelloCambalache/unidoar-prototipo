"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ingresarConGoogle, registrarse } from "@/app/actions/auth";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input } from "@/components/ui/campos";
import { InputContrasena } from "@/components/ui/input-contrasena";
import { BotonGoogle } from "@/components/onboarding/boton-google";
import { AYUDA_DEL_CODIGO_AL_REGISTRARSE, CampoCodigoDeReferido } from "@/components/onboarding/campo-codigo-referido";
import { ConfirmarMail } from "@/components/onboarding/confirmar-mail";
import { AlertaError, SeparadorConTexto, TituloPaso } from "@/components/onboarding/elementos";
import { PRIMER_PASO_PROTEGIDO, type EstadoAuth } from "@/lib/acceso";
import type { RolAlta } from "@/lib/onboarding";

/**
 * Paso 1 del alta ("Creá tu acceso" / "Creá tu cuenta"): email + contraseña o Google.
 * El profesional además deja su nombre y su apellido, por separado. Todos aceptan los términos acá, antes de crear la cuenta
 * (la constancia viaja en los datos de la sesión, o en una cookie con Google, hasta que existe la fila `usuarios`).
 * Google se ofrece solo si está activado en Supabase (`conGoogle`).
 *
 * Con `invitacion` (el enlace del mail de una invitación al equipo) el email viene puesto y no se puede cambiar: quien
 * se registra con ese email ve la invitación en el paso 2 y la acepta con un toque (ver `sumarseAlEquipo`).
 */
export function FormularioRegistro({
  rol,
  conGoogle,
  invitacion,
  referido,
}: {
  rol: RolAlta;
  conGoogle: boolean;
  invitacion?: { institucion: string; rol: string; email: string };
  /**
   * El campo «Código de referido (opcional)», solo en el registro de una institución (no en el del profesional ni en el de una invitación al equipo).
   * `recordado`: ya quedó anotado el código de una institución que la recomendó (llegó por su enlace). El campo nunca se rellena con él: se avisa.
   * Un código escrito viaja con el email y con Google.
   */
  referido?: { recordado: boolean };
}) {
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
        bajada={
          invitacion ? (
            <>
              Te invitaron a sumarte al equipo de <b className="font-semibold text-tinta">{invitacion.institucion}</b> como{" "}
              {invitacion.rol}. Creá tu acceso con este email y, al terminar, aceptás la invitación.
            </>
          ) : esDocente ? (
            "Es gratis y tardás 2 minutos."
          ) : (
            "Con esto vas a ingresar la próxima vez."
          )
        }
      />
      <div className="mb-[22px] flex flex-col gap-3.5">
        {esDocente && (
          // Por separado: el apellido no se adivina, y el nombre queda fijo cuando se verifica el DNI. Como figuran en el DNI.
          <div className="flex gap-3.5 max-[560px]:flex-col">
            <Campo etiqueta="Nombre" className="flex-1" error={campos.nombre} ayuda="Como figura en tu DNI.">
              <Input
                name="nombre"
                autoComplete="given-name"
                placeholder="Ej. María Luciana"
                required
                minLength={2}
                maxLength={80}
                defaultValue={valores.nombre}
                aria-invalid={Boolean(campos.nombre)}
              />
            </Campo>
            <Campo etiqueta="Apellido" className="flex-1" error={campos.apellido} ayuda="Completo, también como en tu DNI.">
              <Input
                name="apellido"
                autoComplete="family-name"
                placeholder="Ej. Prieto Gómez"
                required
                minLength={2}
                maxLength={80}
                defaultValue={valores.apellido}
                aria-invalid={Boolean(campos.apellido)}
              />
            </Campo>
          </div>
        )}
        <Campo etiqueta="Email" error={campos.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder={esDocente ? "nombre@mail.com" : "nombre@colegio.edu.ar"}
            required
            readOnly={Boolean(invitacion)}
            defaultValue={invitacion?.email ?? valores.email}
            aria-invalid={Boolean(campos.email)}
          />
        </Campo>
        <Campo etiqueta="Contraseña" error={campos.password}>
          <InputContrasena
            name="password"
            aria-label="Contraseña"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            maxLength={72}
            aria-invalid={Boolean(campos.password)}
          />
        </Campo>
        <Campo etiqueta="Repetí la contraseña" error={campos.confirmacion}>
          <InputContrasena
            name="confirmacion"
            aria-label="Repetí la contraseña"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-invalid={Boolean(campos.confirmacion)}
          />
        </Campo>
        {referido && !esDocente && !invitacion && (
          <CampoCodigoDeReferido
            // Vacío, salvo lo que escribió en el envío anterior (React vacía los campos después de cada envío, también cuando algo falló).
            defaultValue={typeof valores.codigoReferido === "string" ? valores.codigoReferido : ""}
            error={campos.codigoReferido}
            ayuda={referido.recordado ? AYUDA_DEL_CODIGO_AL_REGISTRARSE.conEnlace : AYUDA_DEL_CODIGO_AL_REGISTRARSE.sinEnlace}
          />
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        {conGoogle && (
          <>
            <SeparadorConTexto>o registrate con Google</SeparadorConTexto>
            <BotonGoogle deshabilitado={pendiente} />
          </>
        )}

        {/* Para todos: sin aceptar los términos no se crea la cuenta (tampoco con Google, que usa este mismo formulario). */}
        <div>
          <Casilla name="aceptaTerminos" required className="mt-1.5">
            Acepto los{" "}
            <Link href="/terminos" target="_blank" className="font-semibold text-navy-700 hover:text-naranja">
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
          <Link href="/privacidad" target="_blank" className="font-semibold text-navy-700 hover:text-naranja">
            política de privacidad
          </Link>
          .
        </p>
        <AlertaError>{errorGeneral}</AlertaError>
        <Boton type="submit" bloque disabled={pendiente} className="min-h-12 text-base">
          {pendiente ? "Un segundo…" : "Continuar"}
        </Boton>
      </div>

      {/* El "Volver al inicio" lo pone el marco (MarcoAcceso): vuelve al inicio, no al selector de cuenta, para que quien entró como institución no vea "Soy profesional" (ni al revés). */}
      <p className="mt-[22px] mb-0 text-[13px] leading-snug text-apagado">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={`/ingresar?next=${encodeURIComponent(PRIMER_PASO_PROTEGIDO[rol])}`}
          className="font-semibold text-navy-700 hover:text-naranja"
        >
          Ingresá
        </Link>
      </p>
    </form>
  );
}
