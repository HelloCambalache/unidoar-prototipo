/*
 * Activa Row Level Security en TODAS las tablas del esquema `public`, sin políticas.
 *
 * Por qué: Supabase expone `public` por una API REST/GraphQL accesible con la clave pública
 * (la que viaja al navegador). Sin RLS, cualquiera podría leer y escribir las tablas. La app
 * no usa esa API: se conecta directo a Postgres con el rol `postgres` (que saltea RLS), así
 * que "RLS activado y sin políticas" = la API pública no puede tocar nada, y la app sigue igual.
 *
 * Es idempotente y cubre tablas nuevas: correrlo después de cada `db:push`.
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta POSTGRES_URL_NON_POOLING / POSTGRES_URL (corré el script con dotenv: pnpm db:rls).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  const tablas = await sql<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public'`;
  for (const { tablename } of tablas) {
    await sql.unsafe(`alter table public."${tablename.replaceAll('"', '""')}" enable row level security`);
  }
  console.log(`✓ RLS activado en ${tablas.length} tablas`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
