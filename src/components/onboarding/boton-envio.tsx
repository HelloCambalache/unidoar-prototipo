"use client";

import { botonClases, type BotonTamano, type BotonVariante } from "@/components/ui/button";

/**
 * Botón que envía un formulario con un valor distinto en un campo oculto (`<input type="hidden" name={campo}>`
 * que el formulario debe tener): "Guardar borrador", "Guardar y salir", "Continuar con Google".
 *
 * Es `type="button"` y envía con `requestSubmit()` a propósito: si fuera un submit común y
 * estuviera antes del botón principal en el DOM, Enter dentro de un campo lo dispararía a él en vez de
 * al botón principal. Con `sinValidar` se saltea la validación nativa de los demás campos.
 */
export function BotonEnvio({
  campo,
  valor,
  formId,
  sinValidar = true,
  variante,
  tamano,
  bloque,
  plano,
  className,
  children,
  ...resto
}: {
  campo: string;
  valor: string;
  /** Si el botón está fuera del `<form>` (ej. el encabezado del marco), el `id` del formulario. */
  formId?: string;
  sinValidar?: boolean;
  variante?: BotonVariante;
  tamano?: BotonTamano;
  bloque?: boolean;
  /** Sin estilos de botón de marca: se usa solo `className` (para links de texto como "Guardar y salir"). */
  plano?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "name" | "value" | "form">) {
  const alTocar = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = formId ? document.getElementById(formId) : e.currentTarget.form;
    if (!(form instanceof HTMLFormElement)) return;
    const control = form.elements.namedItem(campo);
    if (!(control instanceof HTMLInputElement)) return;

    const valorPrevio = control.value;
    const noValidarPrevio = form.noValidate;
    control.value = valor;
    if (sinValidar) form.noValidate = true;
    // El evento "submit" se despacha de forma síncrona: React ya leyó el FormData cuando esto sigue.
    form.requestSubmit();
    control.value = valorPrevio;
    form.noValidate = noValidarPrevio;
  };

  return (
    <button type="button" onClick={alTocar} className={plano ? className : botonClases({ variante, tamano, bloque, className })} {...resto}>
      {children}
    </button>
  );
}
