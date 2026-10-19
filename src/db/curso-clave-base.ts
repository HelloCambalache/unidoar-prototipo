/*
 * Contraseña o código de acceso de la sala de un curso online (por ejemplo, la de Zoom): agrega a `cursos` la columna
 * `link_clave` (texto, nullable). Solo la ven los profesionales inscriptos y la institución.
 *
 * Aditivo e idempotente (`add column if not exists`): se corre ANTES de subir el código que la usa (el código viejo la ignora).
 * La tabla ya tiene RLS: no hace falta `db:rls`.
 * Uso: pnpm db:curso-clave
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:curso-clave).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql`alter table public.cursos add column if not exists link_clave text`;
  console.log("Listo: cursos tiene la columna link_clave.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
