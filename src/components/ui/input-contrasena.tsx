"use client";

import { useState } from "react";
import { Input } from "@/components/ui/campos";
import { cn } from "@/lib/utils";

/**
 * Campo de contraseña con un botón "Ver / Ocultar". Mismas props que `<Input>` (menos `type`).
 * Dentro de un `<Campo>` (que es un <label>) conviene pasar `aria-label`: así el nombre del campo no incluye el texto del botón.
 */
export function InputContrasena({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-[74px]", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute inset-y-1 right-1 cursor-pointer rounded-lg px-3 text-[12.5px] font-semibold text-navy-700 hover:text-naranja focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {visible ? "Ocultar" : "Ver"}
      </button>
    </span>
  );
}
