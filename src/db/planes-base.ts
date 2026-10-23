/*
 * Planes editables: crea `planes` y `planes_condiciones` (con RLS) y las llena con los valores de lanzamiento de src/lib/planes.ts.
 *
 * Aditivo e idempotente: nunca pisa lo que ya se editó desde el backoffice (inserta solo las filas que faltan), y el código viejo
 * ignora las tablas nuevas, así que se puede correr antes de subir el código. Si alguna vez se hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:planes
 */
import postgres from "postgres";
import { CLAVES_PLAN, CONDICIONES_POR_DEFECTO, PLANES_POR_DEFECTO } from "@/lib/planes";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta POSTGRES_URL_NON_POOLING / POSTGRES_URL (corré el script con dotenv: pnpm db:planes).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.planes (
        clave text primary key,
        etiqueta text not null,
        precio integer not null,
        resumen text not null default '',
        detalle text not null default '',
        vigente boolean not null default true,
        creado_en timestamptz not null default now(),
        actualizado_en timestamptz not null default now()
      )`;
    await tx`
      create table if not exists public.planes_condiciones (
        id integer primary key default 1,
        sedes_multisede integer not null,
        pack_meses integer not null,
        pack_meses_pagos integer not null,
        pack_meses_referido integer not null,
        tipos_colegio text[] not null,
        creado_en timestamptz not null default now(),
        actualizado_en timestamptz not null default now(),
        constraint planes_condiciones_una_fila check (id = 1)
      )`;
    // Agregada después de crear la tabla (descuento por sede adicional): en una base que ya la tenía se suma con el valor de lanzamiento.
    await tx`alter table public.planes_condiciones add column if not exists descuento_sede_extra integer not null default 50`;
    await tx`alter table public.planes enable row level security`;
    await tx`alter table public.planes_condiciones enable row level security`;

    let nuevos = 0;
    for (const clave of CLAVES_PLAN) {
      const p = PLANES_POR_DEFECTO[clave];
      const r = await tx`
        insert into public.planes (clave, etiqueta, precio, resumen, detalle, vigente)
        values (${clave}, ${p.label}, ${p.precio}, ${p.resumen}, ${p.detalle}, ${p.vigente})
        on conflict (clave) do nothing
        returning clave`;
      nuevos += r.length;
    }
    const c = CONDICIONES_POR_DEFECTO;
    const cond = await tx`
      insert into public.planes_condiciones (id, sedes_multisede, descuento_sede_extra, pack_meses, pack_meses_pagos, pack_meses_referido, tipos_colegio)
      values (1, ${c.sedesMultisede}, ${c.descuentoSedeExtra}, ${c.pack.meses}, ${c.pack.mesesQueSePagan}, ${c.pack.mesesConReferido}, ${c.tiposColegio})
      on conflict (id) do nothing
      returning id`;

    const [{ n }] = await tx`select count(*)::int as n from public.planes`;
    console.log(`✓ Planes listos: ${nuevos} filas nuevas (hay ${n} en total), condiciones ${cond.length ? "creadas" : "ya existían"}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
