/*
 * Referidos de instituciones: crea `codigos_referido` (el código personal de cada institución, aparte para no tocar `instituciones`)
 * y `referidos_instituciones` (quién recomendó a quién y cuándo se aplicó el beneficio), y `meses_bonificados` (los meses sin cargo que
 * gana quien paga mes a mes: opción B, ver src/lib/bonificacion.ts), todas con RLS. También agrega `referidos_instituciones.beneficio_tipo`
 * (pack o meses; null en lo ya aplicado, que era pack). `meses_bonificados` apunta a `cobros_mp`: correr antes `pnpm db:mercadopago`.
 *
 * Aditivo e idempotente (`create table if not exists`): se corre ANTES de subir el código que las usa (el código viejo las ignora).
 * Una tabla nueva sin RLS queda expuesta a la clave pública: este script la activa. Si alguna vez se hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:referidos
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:referidos).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.codigos_referido (
        institucion_id uuid primary key references public.instituciones(id) on delete cascade,
        codigo text not null unique,
        creado_en timestamptz not null default now()
      )`;
    await tx`
      create table if not exists public.referidos_instituciones (
        id uuid primary key default gen_random_uuid(),
        referidor_id uuid not null references public.instituciones(id) on delete cascade,
        referido_id uuid not null references public.instituciones(id) on delete cascade,
        creado_en timestamptz not null default now(),
        beneficio_en timestamptz,
        constraint referidos_instituciones_referido_unico unique (referido_id),
        constraint referidos_instituciones_no_a_si_misma check (referidor_id <> referido_id)
      )`;
    await tx`create index if not exists referidos_instituciones_referidor_idx on public.referidos_instituciones (referidor_id)`;
    // Cómo se aplicó el beneficio: pack o meses. Null en lo que se aplicó antes (era siempre pack).
    await tx`alter table public.referidos_instituciones add column if not exists beneficio_tipo text`;
    await tx`
      create table if not exists public.meses_bonificados (
        id uuid primary key default gen_random_uuid(),
        institucion_id uuid not null references public.instituciones(id) on delete cascade,
        referido_id uuid references public.referidos_instituciones(id) on delete set null,
        periodo text,
        usado_en timestamptz,
        cobro_id text references public.cobros_mp(id) on delete set null,
        devuelto_en timestamptz,
        creado_en timestamptz not null default now()
      )`;
    await tx`create index if not exists meses_bonificados_institucion_idx on public.meses_bonificados (institucion_id)`;
    // Un mes de una institución se bonifica una sola vez (los disponibles tienen periodo null y no entran).
    await tx`create unique index if not exists meses_bonificados_inst_periodo_uq on public.meses_bonificados (institucion_id, periodo) where periodo is not null`;
    await tx`alter table public.codigos_referido enable row level security`;
    await tx`alter table public.referidos_instituciones enable row level security`;
    await tx`alter table public.meses_bonificados enable row level security`;
  });
  console.log("Listo: codigos_referido, referidos_instituciones y meses_bonificados creadas, con RLS.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
