/*
 * Débito automático con Mercado Pago: crea `suscripciones_mp` (la suscripción de cada institución) y `cobros_mp` (cada intento de cobro,
 * con el número de Mercado Pago como clave: un aviso repetido no cobra dos veces), las dos con RLS. Aparte de `facturas` e `instituciones`
 * a propósito: agregarles una columna rompe todas las consultas hasta correr el script.
 *
 * Aditivo e idempotente (`create table if not exists`): se corre ANTES de subir el código que las usa (el código viejo las ignora).
 * Una tabla nueva sin RLS queda expuesta a la clave pública: este script la activa. Si alguna vez se hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:mercadopago
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:mercadopago).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.suscripciones_mp (
        institucion_id uuid primary key references public.instituciones(id) on delete cascade,
        suscripcion_id text not null unique,
        estado text not null,
        plan text not null,
        monto integer not null,
        email text not null,
        proximo_cobro date,
        creada_en timestamptz not null default now(),
        actualizada_en timestamptz not null default now(),
        constraint suscripciones_mp_estado_valido check (estado in ('pendiente', 'autorizada', 'pausada', 'cancelada')),
        constraint suscripciones_mp_monto_positivo check (monto > 0)
      )`;
    await tx`
      create table if not exists public.cobros_mp (
        id text primary key,
        institucion_id uuid not null references public.instituciones(id) on delete cascade,
        suscripcion_id text not null,
        factura_id uuid references public.facturas(id) on delete set null,
        periodo text,
        monto integer,
        resultado text not null,
        pago_id text,
        detalle text,
        intento integer not null default 0,
        debito_en date,
        creado_en timestamptz not null default now(),
        actualizado_en timestamptz not null default now(),
        constraint cobros_mp_resultado_valido check (resultado in ('aprobado', 'rechazado', 'pendiente', 'cancelado'))
      )`;
    await tx`create index if not exists cobros_mp_institucion_idx on public.cobros_mp (institucion_id)`;
    await tx`alter table public.suscripciones_mp enable row level security`;
    await tx`alter table public.cobros_mp enable row level security`;
  });
  console.log("Listo: suscripciones_mp y cobros_mp creadas, con RLS.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
