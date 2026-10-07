/*
 * Limpia Supabase Storage de archivos que ninguna fila de la base usa: los que se reemplazaron antes de que la app
 * borrara los viejos, los que se subieron y nunca se guardaron (formulario abandonado) y los de cuentas dadas de baja.
 *
 *   pnpm db:limpiar-archivos                     → vista previa: lista qué se borraría. NO borra nada.
 *   pnpm db:limpiar-archivos --borrar            → borra de verdad lo que la vista previa listó.
 *   pnpm db:limpiar-archivos --horas=72          → solo considera archivos de más de 72 h (por defecto 24).
 *   pnpm db:limpiar-archivos --usuario=<uuid>    → mira solo los archivos de esa cuenta (por ejemplo, una dada de baja).
 *
 * Qué cuenta como "en uso": cualquier columna de texto, texto[] o jsonb de cualquier tabla que contenga el path del archivo
 * (la URL pública del bucket `publico` o el path del `privado`). Se mira TODA la base y no una lista de columnas, así
 * una columna nueva que guarde archivos queda protegida sin acordarse de sumarla acá. El margen de horas protege las
 * subidas de quien está llenando un formulario en este momento.
 */
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { patronDePaths } from "@/lib/archivos";
import { BUCKETS } from "@/lib/subidas";
import { urlMigraciones } from "./conexion";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const i = a.indexOf("=");
      return i < 0 ? [a.slice(2), "true"] : [a.slice(2, i), a.slice(i + 1)];
    }),
);
const borrar = args.borrar === "true";
const usuario = args.usuario;
if (usuario !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(usuario)) {
  console.error("--usuario tiene que ser el uuid de la cuenta.");
  process.exit(1);
}
const horas = Number(args.horas ?? 24);
// El margen mínimo de 1 hora protege las subidas en curso; solo las pruebas lo bajan (LIMPIEZA_PERMITIR_HORAS_CORTAS=1).
const horasMinimas = process.env.LIMPIEZA_PERMITIR_HORAS_CORTAS === "1" ? 0.0001 : 1;
if (!Number.isFinite(horas) || horas < horasMinimas) {
  console.error(`--horas tiene que ser un número de ${horasMinimas} o más.`);
  process.exit(1);
}

const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
const urlBase = urlMigraciones();
if (!urlSupabase || !claveServicio || !urlBase) {
  console.error("Faltan variables de Supabase (corré el script con dotenv: pnpm db:limpiar-archivos).");
  process.exit(1);
}

const supabase = createClient(urlSupabase, claveServicio, { auth: { persistSession: false } });
const sql = postgres(urlBase, { max: 1 });

type Objeto = { bucket: string; path: string; bytes: number; creado: Date };

/** Todos los archivos de un bucket, bajando por las carpetas (`<usuario>/<carpeta>/<archivo>`). */
async function listar(bucket: string, prefijo = ""): Promise<Objeto[]> {
  const encontrados: Objeto[] = [];
  for (let desde = 0; ; desde += 100) {
    const { data, error } = await supabase.storage.from(bucket).list(prefijo, { limit: 100, offset: desde });
    if (error) throw new Error(`No pude listar "${bucket}/${prefijo}": ${error.message}`);
    for (const item of data) {
      const ruta = prefijo ? `${prefijo}/${item.name}` : item.name;
      // Las carpetas vienen sin id; los archivos, con metadata.
      if (item.id === null) encontrados.push(...(await listar(bucket, ruta)));
      else
        encontrados.push({
          bucket,
          path: ruta,
          bytes: Number((item.metadata as { size?: number } | null)?.size ?? 0),
          creado: new Date(item.created_at ?? Date.now()),
        });
    }
    if (data.length < 100) return encontrados;
  }
}

/** Todos los paths de archivos que aparecen en alguna columna de texto de la base. */
async function referenciados(): Promise<Set<string>> {
  const patron = patronDePaths();
  const buscar = new RegExp(patron, "g");
  const columnas = await sql<{ tabla: string; columna: string }[]>`
    select table_name as tabla, column_name as columna
    from information_schema.columns
    where table_schema = 'public'
      and (data_type in ('text', 'character varying', 'jsonb') or (data_type = 'ARRAY' and udt_name in ('_text', '_varchar')))`;
  const usados = new Set<string>();
  for (const { tabla, columna } of columnas) {
    const filas = await sql<{ v: string }[]>`
      select ${sql(columna)}::text as v from ${sql(tabla)}
      where ${sql(columna)} is not null and ${sql(columna)}::text ~ ${patron}`;
    for (const { v } of filas) for (const coincidencia of v.match(buscar) ?? []) usados.add(coincidencia);
  }
  return usados;
}

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(2)} MB`;
const edad = (d: Date) => {
  const h = (Date.now() - d.getTime()) / 3_600_000;
  return h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} días`;
};

async function main() {
  const [usados, ...porBucket] = await Promise.all([referenciados(), ...BUCKETS.map((b) => listar(b, usuario ?? ""))]);
  const objetos = porBucket.flat();

  const enUso = objetos.filter((o) => usados.has(o.path));
  const sinUso = objetos.filter((o) => !usados.has(o.path));
  const recientes = sinUso.filter((o) => Date.now() - o.creado.getTime() < horas * 3_600_000);
  const candidatos = sinUso.filter((o) => !recientes.includes(o));

  console.log(`Archivos en Storage${usuario ? ` de la cuenta ${usuario}` : ""}: ${objetos.length} (${mb(objetos.reduce((t, o) => t + o.bytes, 0))})`);
  console.log(`  en uso (se conservan):                   ${enUso.length}`);
  console.log(`  sin uso pero de menos de ${horas} h (se esperan): ${recientes.length}`);
  console.log(`  sin uso y de más de ${horas} h (se borrarían):    ${candidatos.length} (${mb(candidatos.reduce((t, o) => t + o.bytes, 0))})`);

  for (const o of candidatos.slice(0, 60)) console.log(`   - ${o.bucket}/${o.path}  ${mb(o.bytes)}  hace ${edad(o.creado)}`);
  if (candidatos.length > 60) console.log(`   … y ${candidatos.length - 60} más`);

  if (candidatos.length === 0) return;
  if (!borrar) {
    console.log("\nVista previa: no se borró nada. Para borrar lo de arriba: pnpm db:limpiar-archivos --borrar");
    return;
  }
  for (const bucket of BUCKETS) {
    const paths = candidatos.filter((o) => o.bucket === bucket).map((o) => o.path);
    for (let i = 0; i < paths.length; i += 100) {
      const lote = paths.slice(i, i + 100);
      const { error } = await supabase.storage.from(bucket).remove(lote);
      if (error) throw new Error(`No pude borrar de "${bucket}": ${error.message}`);
    }
    if (paths.length) console.log(`✓ "${bucket}": borrados ${paths.length} archivos`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 2 }));
