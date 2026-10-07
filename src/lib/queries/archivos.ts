import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { cursos, docenteDetalle, docentes, institucionFotos, instituciones } from "@/db/schema";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { objetoDeArchivo } from "@/lib/archivos";
import { clienteAdmin } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/subidas";

/**
 * ¿Alguna fila guarda todavía este archivo? `valor` es lo que se guarda en la base (URL pública o path privado) y
 * `path` el path dentro del bucket. Si se suma una columna que guarde archivos, va acá (y la limpieza general de
 * src/db/limpiar-archivos.ts la encuentra sola, porque mira todas las columnas de texto).
 */
async function estaEnUso(valor: string, path: string) {
  const filas = await getDb().execute(sql`
    select (
      exists (select 1 from ${instituciones} where ${instituciones.logoUrl} = ${valor} or ${instituciones.portadaUrl} = ${valor})
      or exists (select 1 from ${docentes} where ${docentes.fotoUrl} = ${valor} or ${docentes.cvUrl} = ${valor})
      or exists (select 1 from ${cursos} where ${cursos.fotoUrl} = ${valor})
      or exists (select 1 from ${institucionFotos} where ${institucionFotos.url} = ${valor})
      or exists (select 1 from ${docenteDetalle} where position(${path} in ${docenteDetalle.documentos}::text) > 0)
    ) as en_uso`);
  return Boolean((filas[0] as { en_uso?: boolean } | undefined)?.en_uso);
}

/**
 * Borra de Storage los archivos que se reemplazaron o se quitaron. Se llama DESPUÉS de guardar en la base (si el guardado
 * falla no se pierde nada) con los valores de antes que ya no están (`quitados(antes, despues)`). Nunca borra un archivo
 * que otra fila siga usando, y nunca rompe la acción que lo llama: si algo falla lo deja en el log y el archivo queda como
 * huérfano para la limpieza general.
 */
export async function borrarArchivos(valores: (string | null | undefined)[]): Promise<void> {
  try {
    if (!almacenamientoConfigurado()) return;
    const porBucket: Record<string, Set<string>> = { publico: new Set(), privado: new Set() };
    const candidatos = new Map<string, { valor: string; bucket: string; path: string }>();
    for (const valor of valores) {
      const objeto = objetoDeArchivo(valor);
      if (valor && objeto) candidatos.set(`${objeto.bucket}/${objeto.path}`, { valor, ...objeto });
    }
    for (const { valor, bucket, path } of candidatos.values()) {
      if (!(await estaEnUso(valor, path))) porBucket[bucket]?.add(path);
    }
    for (const bucket of BUCKETS) {
      const paths = [...(porBucket[bucket] ?? [])];
      if (paths.length === 0) continue;
      const { error } = await clienteAdmin().storage.from(bucket).remove(paths);
      if (error) console.error(`[archivos] no se pudo borrar de "${bucket}":`, error.message);
    }
  } catch (error) {
    console.error("[archivos] no se pudieron borrar los archivos reemplazados", error);
  }
}
