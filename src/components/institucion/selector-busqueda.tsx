"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/campos";
import type { OpcionBusqueda } from "@/lib/pipeline";

/** Cambia de búsqueda en el pipeline conservando la vista (?vista=). */
export function SelectorBusqueda({
  opciones,
  actual,
  vista,
}: {
  opciones: OpcionBusqueda[];
  actual: string;
  vista: "kanban" | "tabla";
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const abiertas = opciones.filter((o) => o.estado !== "cerrada");
  const cerradas = opciones.filter((o) => o.estado === "cerrada");
  const etiqueta = (o: OpcionBusqueda) => `${o.puesto}${o.nuevos > 0 ? ` · ${o.nuevos} nuevo${o.nuevos === 1 ? "" : "s"}` : ""}`;

  return (
    <div className="w-full max-w-[300px] flex-none max-[640px]:max-w-none" aria-busy={pendiente}>
      <Select
        aria-label="Búsqueda"
        value={actual}
        onChange={(e) =>
          empezar(() => router.push(`/institucion/postulantes?busqueda=${e.target.value}${vista === "tabla" ? "&vista=tabla" : ""}`))
        }
      >
        {abiertas.length > 0 && (
          <optgroup label="Abiertas">
            {abiertas.map((o) => (
              <option key={o.id} value={o.id}>
                {etiqueta(o)}
              </option>
            ))}
          </optgroup>
        )}
        {cerradas.length > 0 && (
          <optgroup label="Cerradas">
            {cerradas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.puesto}
              </option>
            ))}
          </optgroup>
        )}
      </Select>
    </div>
  );
}
