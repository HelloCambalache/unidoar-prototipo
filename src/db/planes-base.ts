/*
 * Planes editables: crea `planes`, `planes_condiciones`, `acuerdos_precio` y `creditos_busqueda` (con RLS) y llena las dos primeras con los
 * valores de lanzamiento de src/lib/planes.ts (incluida la fila del plan de búsqueda puntual, que se inserta si falta). También agrega
 * `planes.precio_minimo` (el piso del rango de precio), `planes_condiciones.descuento_sede_extra` y las condiciones de la búsqueda puntual.
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
    // El piso del rango de precio de cada plan (null: sin piso, el abono no se negocia). En una base que ya tenía planes arranca sin piso:
    // se carga desde Planes (o a mano) y no se pisa al volver a correr este script.
    await tx`alter table public.planes add column if not exists precio_minimo integer`;
    // Precio acordado con una institución (a lo sumo uno): un abono dentro del rango del plan o un convenio a medida.
    await tx`
      create table if not exists public.acuerdos_precio (
        institucion_id uuid primary key references public.instituciones(id) on delete cascade,
        modalidad text not null,
        monto integer not null,
        nota text,
        creado_en timestamptz not null default now(),
        actualizado_en timestamptz not null default now()
      )`;
    // La búsqueda puntual (el plan sin abono): días de vigencia, búsquedas abiertas a la vez y qué incluye.
    await tx`alter table public.planes_condiciones add column if not exists puntual_vigencia_dias integer not null default 30`;
    await tx`alter table public.planes_condiciones add column if not exists puntual_busquedas_abiertas integer not null default 1`;
    await tx`alter table public.planes_condiciones add column if not exists puntual_incluye_cursos boolean not null default false`;
    await tx`alter table public.planes_condiciones add column if not exists puntual_incluye_buscador boolean not null default false`;
    // Búsquedas puntuales pagadas: una fila por búsqueda que la institución pagó. Disponible mientras usado_en es null; al publicar se consume.
    await tx`
      create table if not exists public.creditos_busqueda (
        id uuid primary key default gen_random_uuid(),
        institucion_id uuid not null references public.instituciones(id) on delete cascade,
        monto integer not null,
        medio text not null,
        pagado_en timestamptz not null,
        nota text,
        busqueda_id uuid references public.busquedas(id) on delete set null,
        usado_en timestamptz,
        vence_en timestamptz,
        creado_en timestamptz not null default now()
      )`;
    await tx`create index if not exists creditos_busqueda_institucion_idx on public.creditos_busqueda (institucion_id)`;
    await tx`alter table public.planes enable row level security`;
    await tx`alter table public.planes_condiciones enable row level security`;
    await tx`alter table public.acuerdos_precio enable row level security`;
    await tx`alter table public.creditos_busqueda enable row level security`;

    let nuevos = 0;
    for (const clave of CLAVES_PLAN) {
      const p = PLANES_POR_DEFECTO[clave];
      const r = await tx`
        insert into public.planes (clave, etiqueta, precio, precio_minimo, resumen, detalle, vigente)
        values (${clave}, ${p.label}, ${p.precio}, ${p.precioMinimo}, ${p.resumen}, ${p.detalle}, ${p.vigente})
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
