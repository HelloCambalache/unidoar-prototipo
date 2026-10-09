"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/campos";
import type { OpcionBusqueda } from "@/lib/pipeline";

/**
 * Cambia de búsqueda en el pipeline conservando la vista (?vista=). Si la institución tiene varias sedes, también deja filtrar la
 * lista de búsquedas por sede (?sede=): la búsqueda que se está viendo siempre sigue en la lista.
 */
export function SelectorBusqueda({
  opciones,
  actual,
  vista,
  sedes,
  sedeFiltro,
}: {
  opciones: OpcionBusqueda[];
  actual: string;
  vista: "kanban" | "tabla";
  /** Las sedes de la institución; con una sola no se ofrece el filtro. */
  sedes: { id: string; nombre: string }[];
  /** La sede por la que se filtra (vacío = todas). */
  sedeFiltro: string;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const visibles = sedeFiltro ? opciones.filter((o) => o.sedeId === sedeFiltro || o.id === actual) : opciones;
  const abiertas = visibles.filter((o) => o.estado !== "cerrada");
  const cerradas = visibles.filter((o) => o.estado === "cerrada");
  const ir = (busquedaId: string, sede: string) =>
    empezar(() => router.push(`/institucion/postulantes?busqueda=${busquedaId}${vista === "tabla" ? "&vista=tabla" : ""}${sede ? `&sede=${sede}` : ""}`));
  const etiqueta = (o: OpcionBusqueda) => `${o.puesto}${o.nuevos > 0 ? ` · ${o.nuevos} nuevo${o.nuevos === 1 ? "" : "s"}` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2.5" aria-busy={pendiente}>
      {sedes.length > 1 && (
        <div className="w-full max-w-[220px] flex-none max-[640px]:max-w-none">
          <Select aria-label="Filtrar por sede" value={sedeFiltro} onChange={(e) => ir(actual, e.target.value)}>
            <option value="">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="w-full max-w-[300px] flex-none max-[640px]:max-w-none">
      <Select aria-label="Búsqueda" value={actual} onChange={(e) => ir(e.target.value, sedeFiltro)}>
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
    </div>
  );
}
