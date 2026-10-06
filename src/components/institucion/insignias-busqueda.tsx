import { Insignia } from "@/components/ui/insignia";
import { plural } from "@/lib/busquedas";
import type { BusquedaItem } from "@/lib/queries/busquedas";

/** Estado de una búsqueda en la tabla de Publicaciones: Activa, Rápida (con su plazo), Pausada o Cerrada. */
export function EstadoBusqueda({ b }: { b: Pick<BusquedaItem, "estado" | "rapida" | "plazo"> }) {
  if (b.estado === "cerrada") return <Insignia>Cerrada</Insignia>;
  if (b.estado === "pausada") return <Insignia tono="ambar">Pausada</Insignia>;
  if (b.rapida) {
    return b.plazo?.vencida ? (
      <Insignia>{b.plazo.texto}</Insignia>
    ) : (
      <Insignia tono="naranja">⚡ {b.plazo?.texto ?? "Rápida"}</Insignia>
    );
  }
  return <Insignia tono="verde">Activa</Insignia>;
}

/** Cómo viene una búsqueda abierta, para el listado del dashboard ("4 postulantes nuevos", "Vence en 18 hs"). */
export function ResumenDeBusqueda({ b }: { b: Pick<BusquedaItem, "plazo" | "nuevos" | "postulantes" | "edadDias"> }) {
  const semanas = Math.max(1, Math.floor(b.edadDias / 7));
  return (
    <>
      {b.plazo && (b.plazo.vencida ? <Insignia>{b.plazo.texto}</Insignia> : <Insignia tono="naranja">⚡ {b.plazo.texto}</Insignia>)}
      {b.nuevos > 0 ? (
        <Insignia tono="azul">{plural(b.nuevos, "postulante nuevo", "postulantes nuevos")}</Insignia>
      ) : b.edadDias >= 14 && b.postulantes <= 3 ? (
        <Insignia tono="ambar">
          {plural(b.postulantes, "postulante", "postulantes")} en {plural(semanas, "semana", "semanas")}
        </Insignia>
      ) : (
        !b.plazo && (
          <Insignia>{b.postulantes === 0 ? "Sin postulantes todavía" : plural(b.postulantes, "postulante", "postulantes")}</Insignia>
        )
      )}
    </>
  );
}
