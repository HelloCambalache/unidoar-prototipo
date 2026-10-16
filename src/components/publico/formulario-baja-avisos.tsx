"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmarBajaDeAvisos, type EstadoBajaAvisos } from "@/app/actions/avisos";
import { Boton } from "@/components/ui/button";

/** Paso de confirmación de la baja de avisos por mail (la página no hace nada con solo abrir el enlace). */
export function FormularioBajaAvisos({ usuarioId, firma, children }: { usuarioId: string; firma: string; children?: React.ReactNode }) {
  const [estado, accion, pendiente] = useActionState<EstadoBajaAvisos, FormData>(confirmarBajaDeAvisos, null);

  if (estado?.ok) {
    return (
      <div role="status" className="rounded-caja bg-verde-tint px-4 py-4 text-sm leading-normal text-verde">
        <p className="m-0 font-semibold">Listo: no te vamos a mandar más avisos por mail.</p>
        <p className="m-0 mt-1.5 text-tinta-2">
          Seguís viéndolos en la campanita de UNIDOAR. Si más adelante querés recibirlos de nuevo, activalos desde «Mi cuenta» (
          <Link href="/ingresar" className="font-medium text-navy-700 underline">
            ingresá
          </Link>{" "}
          y buscala en el menú).
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      {children}
      <input type="hidden" name="u" value={usuarioId} />
      <input type="hidden" name="t" value={firma} />
      <Boton type="submit" variante="primario" tamano="lg" disabled={pendiente} aria-busy={pendiente} className="self-start">
        {pendiente ? "Guardando…" : "Dejar de recibir avisos por mail"}
      </Boton>
      {estado && !estado.ok && estado.error && (
        <p role="alert" className="m-0 rounded-caja bg-[#FEE2E2] px-4 py-3 text-[13px] leading-snug font-medium text-[#b91c1c]">
          {estado.error}
        </p>
      )}
    </form>
  );
}
