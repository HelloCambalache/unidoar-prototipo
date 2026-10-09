/*
 * Sedes de las instituciones: crea `institucion_sedes` (con RLS), agrega `busquedas.sede_id` y le da a cada institución su
 * "Sede principal" con la ubicación que ya tenía (y a cada búsqueda la sede principal de su institución).
 *
 * Todo es ADITIVO e idempotente: no borra ni cambia ninguna columna existente, y el código viejo ignora la tabla y la columna
 * nuevas, así que se puede correr antes de subir el código. Correrlo de nuevo no duplica nada (solo completa lo que falte:
 * por ejemplo instituciones o búsquedas creadas después). Si alguna vez se hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:sedes
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta POSTGRES_URL_NON_POOLING / POSTGRES_URL (corré el script con dotenv: pnpm db:sedes).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.institucion_sedes (
        id uuid primary key default gen_random_uuid(),
        institucion_id uuid not null references public.instituciones(id) on delete cascade,
        nombre text not null,
        direccion text,
        partido text,
        provincia text,
        zona text,
        lat double precision,
        lng double precision,
        cue text,
        es_principal boolean not null default false,
        creado_en timestamptz not null default now(),
        actualizado_en timestamptz not null default now()
      )`;
    await tx`create index if not exists institucion_sedes_institucion_idx on public.institucion_sedes (institucion_id)`;
    await tx`create unique index if not exists institucion_sedes_principal_uq on public.institucion_sedes (institucion_id) where es_principal`;
    await tx`alter table public.institucion_sedes enable row level security`;

    await tx`alter table public.busquedas add column if not exists sede_id uuid references public.institucion_sedes(id) on delete set null`;
    await tx`create index if not exists busquedas_sede_idx on public.busquedas (sede_id)`;

    // Cada institución sin sedes recibe la principal con lo que ya tenía guardado.
    const nuevas = await tx`
      insert into public.institucion_sedes (institucion_id, nombre, direccion, partido, provincia, zona, lat, lng, cue, es_principal)
      select i.id, 'Sede principal', i.direccion, i.partido, i.provincia, i.zona, i.lat, i.lng, i.cue, true
      from public.instituciones i
      where not exists (select 1 from public.institucion_sedes s where s.institucion_id = i.id)
      returning id`;
    // Y cada búsqueda sin sede, la principal de su institución.
    const busquedas = await tx`
      update public.busquedas b
      set sede_id = s.id
      from public.institucion_sedes s
      where s.institucion_id = b.institucion_id and s.es_principal and b.sede_id is null
      returning b.id`;

    const [{ instituciones }] = await tx`select count(*)::int as instituciones from public.instituciones`;
    const [{ sin_principal }] = await tx`
      select count(*)::int as sin_principal from public.instituciones i
      where not exists (select 1 from public.institucion_sedes s where s.institucion_id = i.id and s.es_principal)`;
    console.log(
      `✓ Sedes listas: ${nuevas.length} principales nuevas (de ${instituciones} instituciones), ${busquedas.length} búsquedas asignadas, ${sin_principal} instituciones sin sede principal`,
    );
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
