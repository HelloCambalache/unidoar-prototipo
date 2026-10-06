import "server-only";
import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { mensajesContacto, type MensajeContacto } from "@/db/schema";

/* Bandeja de los mensajes del formulario público /contacto. Los lee solo el equipo, desde /backoffice/mensajes. */

export const POR_PAGINA_MENSAJES = 20;

export type FiltroMensajes = "todos" | "pendientes" | "atendidos";
export const FILTROS_MENSAJES: { clave: FiltroMensajes; etiqueta: string }[] = [
  { clave: "pendientes", etiqueta: "Sin atender" },
  { clave: "atendidos", etiqueta: "Atendidos" },
  { clave: "todos", etiqueta: "Todos" },
];

export type BandejaMensajes = {
  mensajes: MensajeContacto[];
  total: number;
  pagina: number;
  paginas: number;
  cantidades: Record<FiltroMensajes, number>;
};

export async function listarMensajes(filtro: FiltroMensajes, paginaPedida: number): Promise<BandejaMensajes> {
  const db = getDb();
  const [conteo] = await db
    .select({
      todos: count(),
      atendidos: sql<number>`count(*) filter (where ${mensajesContacto.atendido})`.mapWith(Number),
    })
    .from(mensajesContacto);
  const cantidades: Record<FiltroMensajes, number> = {
    todos: conteo?.todos ?? 0,
    atendidos: conteo?.atendidos ?? 0,
    pendientes: (conteo?.todos ?? 0) - (conteo?.atendidos ?? 0),
  };

  const total = cantidades[filtro];
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_MENSAJES));
  const pagina = Math.min(Math.max(1, paginaPedida), paginas);

  const mensajes = await db
    .select()
    .from(mensajesContacto)
    .where(filtro === "todos" ? undefined : eq(mensajesContacto.atendido, filtro === "atendidos"))
    .orderBy(desc(mensajesContacto.creadoEn), desc(mensajesContacto.id))
    .limit(POR_PAGINA_MENSAJES)
    .offset((pagina - 1) * POR_PAGINA_MENSAJES);

  return { mensajes, total, pagina, paginas, cantidades };
}
