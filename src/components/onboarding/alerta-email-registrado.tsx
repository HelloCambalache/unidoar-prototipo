"use client";

import { useEffect, useRef } from "react";
import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import type { EstadoAuth } from "@/lib/acceso";
import { MENSAJE_EMAIL_YA_REGISTRADO } from "@/lib/acceso";

/**
 * Aviso destacado del registro cuando el email ya tiene una cuenta (pedido del cliente, 2026-11-10): lo primero que ve la persona, con el email que
 * puso y las dos salidas, «Ingresar» y «Recuperar mi contraseña». Funciona igual para una institución, un profesional o quien llega por una
 * invitación: no dice de qué tipo es la cuenta que ya existe. Al aparecer (cada vez que se vuelve a enviar el formulario) se lleva a la vista y
 * toma el foco, para que no pase desapercibido en el celular.
 *
 * `senal` es el estado de la acción: cambia en cada envío y vuelve a disparar el desplazamiento aunque el aviso ya estuviera en pantalla.
 */
export function AlertaEmailYaRegistrado({ email, conGoogle, senal }: { email: string; conGoogle: boolean; senal: EstadoAuth }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    caja.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    caja.current?.focus({ preventScroll: true });
  }, [senal]);

  return (
    <div
      ref={caja}
      role="alert"
      tabIndex={-1}
      className="mb-[22px] flex flex-col gap-3 rounded-interno border-2 border-naranja bg-naranja-tint px-4 py-4 text-naranja-ink outline-none max-[560px]:px-3.5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-full bg-naranja text-white">
          <Icono nombre="cuenta" tamano={18} />
        </span>
        <div className="min-w-0">
          <p className="m-0 font-display text-[17px] leading-tight font-semibold">{MENSAJE_EMAIL_YA_REGISTRADO}</p>
          <p className="m-0 mt-1.5 text-[13.5px] leading-normal [overflow-wrap:anywhere]">
            Ya hay una cuenta con <b className="font-semibold">{email}</b>. Ingresá con tu contraseña{conGoogle ? " (o con Google, si te registraste así)" : ""};
            si no la recordás, recuperala. Si querés crear otra cuenta, usá otro email.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <BotonLink href="/ingresar" tamano="sm">
          Ingresar
        </BotonLink>
        <BotonLink href="/ingresar/recuperar" tamano="sm" variante="secundario" className="bg-white">
          Recuperar mi contraseña
        </BotonLink>
      </div>
    </div>
  );
}
