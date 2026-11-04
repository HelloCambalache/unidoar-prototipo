/*
 * Cursos para instituciones: una institución puede explorar los cursos de las demás y anotarse (para su staff o para la institución). Crea
 * `inscripciones_curso_institucion`, una fila por institución anotada en un curso. Es tabla aparte de `inscripciones_curso` (las de los profesionales)
 * a propósito: esa tiene la clave en `docente_id` y cambiarla rompería todo lo que ya la lee. Con RLS.
 *
 * Aditivo e idempotente (`create table if not exists`): se corre ANTES de subir el código que la usa (el código viejo la ignora). Una tabla nueva
 * sin RLS queda expuesta a la clave pública: este script la activa. Si alguna vez se hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:cursos-instituciones
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:cursos-instituciones).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.inscripciones_curso_institucion (
        curso_id uuid not null references public.cursos(id) on delete cascade,
        institucion_id uuid not null references public.instituciones(id) on delete cascade,
        creado_en timestamptz not null default now(),
        constraint inscripciones_curso_institucion_curso_id_institucion_id_pk primary key (curso_id, institucion_id)
      )`;
    await tx`create index if not exists inscripciones_curso_institucion_inst_idx on public.inscripciones_curso_institucion (institucion_id)`;
    await tx`alter table public.inscripciones_curso_institucion enable row level security`;
  });
  const [{ n }] = await sql`select count(*)::int as n from public.inscripciones_curso_institucion`;
  console.log(`Listo: inscripciones_curso_institucion creada, con RLS (${n} inscripciones).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
