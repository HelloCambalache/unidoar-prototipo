/*
 * Un profesional con más de una categoría (docente, entrenador/a, guardavidas): agrega `docentes.categorias_extra`, la lista de las
 * categorías que tiene ADEMÁS de la principal (`docentes.categoria`). Un perfil sin extras la deja vacía, así que nadie cambia.
 *
 * Aditivo e idempotente (`add column if not exists`): se corre ANTES de subir el código que la lee (sin la columna fallan todas las
 * consultas a `docentes`, que piden todas las columnas). No toca ninguna fila existente. La tabla ya tiene RLS: no hace falta `db:rls`.
 * Uso: pnpm db:categorias-multiples
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:categorias-multiples).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`alter table public.docentes add column if not exists categorias_extra public.categoria_docente[] not null default '{}'::public.categoria_docente[]`;
  });
  const [{ n, conExtras }] = await sql`
    select count(*)::int as n, count(*) filter (where cardinality(categorias_extra) > 0)::int as "conExtras" from public.docentes`;
  const [{ rls }] = await sql`select relrowsecurity as rls from pg_class where oid = 'public.docentes'::regclass`;
  console.log(`Listo: docentes tiene categorias_extra (${n} perfiles, ${conExtras} con más de una categoría). RLS ${rls ? "activado" : "DESACTIVADO: corré pnpm db:rls"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
