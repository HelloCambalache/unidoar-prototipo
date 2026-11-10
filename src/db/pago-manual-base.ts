/*
 * Instituciones habilitadas a pagar por transferencia o efectivo (pedido de Flor, 2026-11-10): crea `habilitaciones_pago_manual`, una fila por
 * institución habilitada. Sin fila, la institución paga con Mercado Pago (cuando Mercado Pago está disponible para ella). Con RLS. Aparte de
 * `instituciones` a propósito: agregarle una columna rompe todas las consultas hasta correr el script.
 *
 * Aditivo e idempotente (`create table if not exists`): se corre ANTES de subir el código que la usa (el código viejo la ignora). Una tabla nueva
 * sin RLS queda expuesta a la clave pública: este script la activa. Si alguna vez se hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:pago-manual
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:pago-manual).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.habilitaciones_pago_manual (
        institucion_id uuid primary key references public.instituciones(id) on delete cascade,
        habilitada_por uuid references public.usuarios(id) on delete set null,
        habilitada_en timestamptz not null default now()
      )`;
    await tx`alter table public.habilitaciones_pago_manual enable row level security`;
  });
  const [{ n }] = await sql`select count(*)::int as n from public.habilitaciones_pago_manual`;
  console.log(`Listo: habilitaciones_pago_manual creada, con RLS (${n} instituciones habilitadas).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
