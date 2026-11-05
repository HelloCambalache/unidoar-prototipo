import { BuscadorLista } from "@/components/backoffice/buscador-lista";

/** La lupa de la cola de verificación: busca por nombre y apellido sin depender del orden de llegada (pedido del cliente, 2026-11-04). */
export function VerifBuscador({ q, estado }: { q: string; estado: string }) {
  return (
    <BuscadorLista
      accion="/backoffice/verificacion"
      q={q}
      conservar={{ estado: estado === "todos" ? "" : estado }}
      etiqueta="Buscar profesional por nombre y apellido"
      placeholder="Buscar por nombre y apellido"
    />
  );
}
