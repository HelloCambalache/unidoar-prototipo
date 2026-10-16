"use client";

import { useActionState } from "react";
import { enviarContacto } from "@/app/actions/contacto";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { ROLES_CONSULTA, type EstadoContacto } from "@/lib/contacto";

const INICIAL: EstadoContacto = { ok: false };

/** Formulario de /contacto: valida en el servidor y confirma en pantalla cuando el mensaje se guardó. */
export function FormularioContacto() {
  const [estado, accion, enviando] = useActionState(enviarContacto, INICIAL);
  const campos = estado.campos ?? {};
  const v = estado.valores;

  return (
    <form action={accion} noValidate className="flex flex-col gap-4">
      <Campo etiqueta="Nombre" requerido error={campos.nombre}>
        <Input
          name="nombre"
          autoComplete="name"
          placeholder="Tu nombre"
          defaultValue={v?.nombre}
          aria-invalid={!!campos.nombre}
          required
          maxLength={120}
        />
      </Campo>
      <Campo etiqueta="Email" requerido error={campos.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@email.com"
          defaultValue={v?.email}
          aria-invalid={!!campos.email}
          required
          maxLength={254}
        />
      </Campo>
      <Campo etiqueta="Sos…" requerido error={campos.rol}>
        <Select name="rol" defaultValue={v?.rol || ROLES_CONSULTA[0]} aria-invalid={!!campos.rol}>
          {ROLES_CONSULTA.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo etiqueta="Mensaje" requerido error={campos.mensaje}>
        <Textarea
          name="mensaje"
          placeholder="Contanos en qué te podemos ayudar"
          defaultValue={v?.mensaje}
          aria-invalid={!!campos.mensaje}
          required
          minLength={10}
          maxLength={2000}
          className="min-h-[120px]"
        />
      </Campo>

      {/* Campo trampa: las personas no lo ven ni lo completan, algunos bots sí. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No completar este campo
          <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Boton type="submit" tamano="lg" disabled={enviando} className="self-start">
        {enviando ? "Enviando…" : "Enviar mensaje"}
      </Boton>

      {estado.ok && (
        <div role="status" className="rounded-lg bg-verde-tint px-4 py-3 text-[13px] leading-snug font-medium text-verde">
          Gracias, recibimos tu mensaje. Te contestamos a la brevedad.
        </div>
      )}
      {!estado.ok && estado.error && (
        <div role="alert" className="rounded-lg bg-[#FEE2E2] px-4 py-3 text-[13px] leading-snug font-medium text-[#b91c1c]">
          {estado.error}
        </div>
      )}
    </form>
  );
}
