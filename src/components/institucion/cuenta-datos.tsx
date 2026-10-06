"use client";

import { useActionState, useEffect, useState } from "react";
import { actualizarCuenta } from "@/app/actions/institucion";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import type { Resultado } from "@/lib/acciones";
import { iniciales } from "@/lib/utils";

/**
 * Datos de quien administra la cuenta. El email es el de acceso (solo lectura); el teléfono es el de contacto
 * de la institución, así que solo lo edita el dueño (`telefono === null` para quien entró por invitación).
 */
export function CuentaDatos({
  inicial,
  email,
  rolEtiqueta,
}: {
  inicial: { nombre: string; apellido: string; telefono: string | null };
  email: string;
  rolEtiqueta: string;
}) {
  const toast = useToast();
  const [estado, accion, pendiente] = useActionState<Resultado | null, FormData>(actualizarCuenta, null);
  // Controlados: React 19 reinicia los campos sin controlar al terminar la acción y se perdería lo escrito si hay un error.
  const [nombre, setNombre] = useState(inicial.nombre);
  const [apellido, setApellido] = useState(inicial.apellido);
  const [telefono, setTelefono] = useState(inicial.telefono ?? "");
  const errores = estado && !estado.ok ? (estado.campos ?? {}) : {};

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) toast("Datos guardados");
    else toast(estado.error, "error");
  }, [estado, toast]);

  return (
    <Tarjeta como="section" className="p-[22px]">
      <form action={accion}>
        <div className="mb-5 flex items-center gap-3.5">
          <Avatar iniciales={iniciales(`${nombre} ${apellido}`.trim() || email)} tamano={52} className="text-[17px]" />
          <div className="min-w-0">
            <div className="truncate text-[17px] leading-tight font-semibold">{`${nombre} ${apellido}`.trim() || email}</div>
            <Insignia className="mt-1">{rolEtiqueta}</Insignia>
          </div>
        </div>

        <div className="mb-3.5 grid grid-cols-2 gap-3.5 max-[700px]:grid-cols-1">
          <Campo etiqueta="Nombre" error={errores.nombre}>
            <Input
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="given-name"
              maxLength={60}
              required
              aria-invalid={Boolean(errores.nombre)}
            />
          </Campo>
          <Campo etiqueta="Apellido" error={errores.apellido}>
            <Input
              name="apellido"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              autoComplete="family-name"
              maxLength={80}
              aria-invalid={Boolean(errores.apellido)}
            />
          </Campo>
        </div>

        <div className="mb-[18px] grid grid-cols-2 gap-3.5 max-[700px]:grid-cols-1">
          <Campo etiqueta="Email" ayuda="Es el email con el que ingresás a UNIDOAR.">
            <Input type="email" value={email} readOnly aria-readonly="true" className="bg-superficie text-apagado" />
          </Campo>
          {inicial.telefono !== null ? (
            <Campo etiqueta="Teléfono" error={errores.telefono}>
              <Input
                type="tel"
                name="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                autoComplete="tel"
                maxLength={40}
                required
                aria-invalid={Boolean(errores.telefono)}
              />
            </Campo>
          ) : (
            <p className="m-0 self-end pb-2.5 text-[13px] leading-normal text-apagado">
              El teléfono de contacto de la institución lo carga el dueño de la cuenta.
            </p>
          )}
        </div>

        <Boton type="submit" variante="cta" tamano="lg" disabled={pendiente} aria-busy={pendiente} className="min-w-[200px] max-[560px]:w-full">
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </Boton>
      </form>
    </Tarjeta>
  );
}
