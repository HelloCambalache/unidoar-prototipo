/*
 * Comprobante de pago que adjunta el equipo (pedido de Flor, 2026-11-10): crea `comprobantes_pago`, una fila por pago (de una factura o de una
 * búsqueda puntual pagada) con el path del archivo en el bucket privado. Con RLS. Aparte de `facturas` a propósito: agregarle una columna rompe
 * todas las consultas hasta correr el script.
 *
 * Aditivo e idempotente (`create table if not exists`): se corre ANTES de subir el código que la usa (el código viejo la ignora). Una tabla nueva
 * sin RLS queda expuesta a la clave pública: este script la activa. Si alguna vez se hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:comprobantes
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:comprobantes).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.comprobantes_pago (
        id uuid primary key default gen_random_uuid(),
        factura_id uuid references public.facturas(id) on delete cascade,
        credito_id uuid references public.creditos_busqueda(id) on delete cascade,
        path text not null,
        nombre text not null,
        subido_por uuid references public.usuarios(id) on delete set null,
        creado_en timestamptz not null default now(),
        constraint comprobantes_pago_un_pago check ((factura_id is not null)::int + (credito_id is not null)::int = 1)
      )`;
    await tx`create unique index if not exists comprobantes_pago_factura_uq on public.comprobantes_pago (factura_id)`;
    await tx`create unique index if not exists comprobantes_pago_credito_uq on public.comprobantes_pago (credito_id)`;
    await tx`alter table public.comprobantes_pago enable row level security`;
  });
  const [{ n }] = await sql`select count(*)::int as n from public.comprobantes_pago`;
  console.log(`Listo: comprobantes_pago creada, con RLS (${n} comprobantes).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
