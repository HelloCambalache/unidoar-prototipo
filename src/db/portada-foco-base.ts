/*
 * Encuadre de la portada de una institución: agrega `instituciones.portada_foco`, el punto de la foto que la institución eligió mostrar
 * ("30% 62%", como un `object-position`; reglas en src/lib/encuadre.ts). Una portada sin encuadre elegido queda en null y se ve como siempre.
 *
 * Aditivo e idempotente (`add column if not exists`): se corre ANTES de subir el código que la lee (sin la columna fallan todas las consultas
 * que piden toda la fila de `instituciones`). No toca ninguna fila. La tabla ya tiene RLS: no hace falta `db:rls`.
 * Uso: pnpm db:portada-foco
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:portada-foco).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`alter table public.instituciones add column if not exists portada_foco text`;
  });
  const [{ n, conEncuadre }] = await sql`
    select count(*)::int as n, count(*) filter (where portada_foco is not null)::int as "conEncuadre" from public.instituciones`;
  const [{ rls }] = await sql`select relrowsecurity as rls from pg_class where oid = 'public.instituciones'::regclass`;
  console.log(`Listo: instituciones tiene portada_foco (${n} instituciones, ${conEncuadre} con encuadre elegido). RLS ${rls ? "activado" : "DESACTIVADO: corré pnpm db:rls"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
