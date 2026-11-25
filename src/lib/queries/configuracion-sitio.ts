import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { configuracionSitio } from "@/db/schema";
import { resumenDeError } from "@/lib/errores";

/*
 * Configuración del sitio público (una sola fila; la edita el equipo en Backoffice → Sitio). Todo arranca oculto y falla cerrado: si la tabla
 * todavía no existe (falta correr `pnpm db:configuracion-sitio`) o la base no responde, las cifras se ven como «ocultas», nunca como «visibles».
 */

export type ConfiguracionDelSitio = {
  /** Si las cifras de la red (profesionales e instituciones verificados, búsquedas activas, disciplinas…) se muestran en el sitio público. */
  mostrarCifras: boolean;
  /** Cuándo se cambió por última vez; null si nunca se tocó (o la tabla todavía no existe). */
  actualizadoEn: Date | null;
};

const OCULTAS: ConfiguracionDelSitio = { mostrarCifras: false, actualizadoEn: null };

/** La configuración vigente. Una vez por request. */
export const configuracionDelSitio = cache(async (): Promise<ConfiguracionDelSitio> => {
  try {
    const [fila] = await getDb()
      .select({ mostrarCifras: configuracionSitio.mostrarCifras, actualizadoEn: configuracionSitio.actualizadoEn })
      .from(configuracionSitio)
      .where(eq(configuracionSitio.id, 1))
      .limit(1);
    // Sin fila (nadie la creó todavía) vale lo mismo que oculto, y `actualizadoEn` no dice nada: nadie lo tocó.
    return fila ? { mostrarCifras: fila.mostrarCifras, actualizadoEn: fila.actualizadoEn } : OCULTAS;
  } catch (e) {
    console.error("[configuracion-sitio] no se pudo leer; las cifras se ven ocultas", resumenDeError(e));
    return OCULTAS;
  }
});

/** ¿Se muestran las cifras de la red en el sitio público? */
export const cifrasPublicasVisibles = async () => (await configuracionDelSitio()).mostrarCifras;
