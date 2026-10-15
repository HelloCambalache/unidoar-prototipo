/*
 * Respuesta del profesional a la entrevista: agrega a `postulaciones` las columnas `entrevista_respuesta` ("voy" / "no_puedo"),
 * `entrevista_respuesta_en` y `entrevista_respuesta_mensaje`.
 *
 * Aditivo e idempotente (`add column if not exists`, todas nullables): se corre ANTES de subir el código que las usa (el código
 * viejo las ignora). La tabla ya tiene RLS: no hace falta `db:rls`.
 * Uso: pnpm db:entrevista
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:entrevista).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`alter table public.postulaciones add column if not exists entrevista_respuesta text`;
    await tx`alter table public.postulaciones add column if not exists entrevista_respuesta_en timestamptz`;
    await tx`alter table public.postulaciones add column if not exists entrevista_respuesta_mensaje text`;
    await tx`
      do $$ begin
        alter table public.postulaciones
          add constraint postulaciones_entrevista_respuesta_valida check (entrevista_respuesta in ('voy', 'no_puedo'));
      exception when duplicate_object then null;
      end $$`;
  });
  console.log("Listo: postulaciones tiene las columnas de respuesta a la entrevista.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
