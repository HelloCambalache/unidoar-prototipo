/*
 * CV adjunto a los contactos propios de una institución: agrega `contactos_institucion.cv_path` (path del PDF en el bucket privado) y
 * `cv_nombre` (el nombre con el que se subió). Las dos son opcionales: un contacto sin CV las deja en null.
 *
 * Aditivo e idempotente (`add column if not exists`): se corre ANTES de subir el código que las lee (sin las columnas fallan las consultas
 * de Profesionales, que las piden). No toca ninguna fila ni ningún archivo. La tabla ya tiene RLS: no hace falta `db:rls`.
 * Uso: pnpm db:contactos-cv
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:contactos-cv).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`alter table public.contactos_institucion add column if not exists cv_path text`;
    await tx`alter table public.contactos_institucion add column if not exists cv_nombre text`;
  });
  const [{ n, conCv }] = await sql`
    select count(*)::int as n, count(cv_path)::int as "conCv" from public.contactos_institucion`;
  const [{ rls }] = await sql`select relrowsecurity as rls from pg_class where oid = 'public.contactos_institucion'::regclass`;
  console.log(`Listo: contactos_institucion tiene cv_path y cv_nombre (${n} contactos, ${conCv} con CV). RLS ${rls ? "activado" : "DESACTIVADO: corré pnpm db:rls"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
