"use client";

import { useFormStatus } from "react-dom";
import { Boton } from "@/components/ui/button";

/** Botón de envío de la pantalla de confirmación de un enlace del mail: queda deshabilitado mientras se verifica (el token se usa una sola vez). */
export function BotonConfirmarEnlace({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Boton type="submit" bloque className="min-h-12 text-base" disabled={pending}>
      {pending ? "Un momento…" : children}
    </Boton>
  );
}
