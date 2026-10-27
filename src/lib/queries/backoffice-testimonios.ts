import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { testimonios } from "@/db/schema";

export type TestimonioFila = {
  id: string;
  pagina: string;
  cita: string;
  autor: string;
  cargo: string;
  fotoUrl: string | null;
  orden: number;
  visible: boolean;
};

/** Todos los testimonios (visibles y ocultos) para el backoffice, en el orden en que se muestran dentro de cada página. */
export async function testimoniosDelEquipo(): Promise<TestimonioFila[]> {
  return getDb()
    .select({
      id: testimonios.id,
      pagina: testimonios.pagina,
      cita: testimonios.cita,
      autor: testimonios.autor,
      cargo: testimonios.cargo,
      fotoUrl: testimonios.fotoUrl,
      orden: testimonios.orden,
      visible: testimonios.visible,
    })
    .from(testimonios)
    .orderBy(asc(testimonios.pagina), asc(testimonios.orden), asc(testimonios.autor));
}
