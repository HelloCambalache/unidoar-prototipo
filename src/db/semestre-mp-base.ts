/*
 * Pago del semestre por Mercado Pago (un pago único por adelantado, no una suscripción): crea `pagos_semestre_mp`, una fila por cada link de pago
 * que se le arma a una institución (el «intento»). Guarda lo que se acordó al crear el link (el monto, desde qué mes y cuántos meses cubre): el pago
 * que después avisa Mercado Pago se compara con eso, y el número del intento viaja a Mercado Pago como `external_reference`, que es lo único que dice
 * de quién es cada pago. Con RLS. Aparte de `facturas` e `instituciones` a propósito: agregarles una columna rompe todas las consultas hasta correr el
 * script.
 *
 * Aditivo e idempotente (`create table if not exists`): se corre ANTES de subir el código que la usa (el código viejo la ignora). Una tabla nueva
 * sin RLS queda expuesta a la clave pública: este script la activa. Si alguna vez se hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:semestre-mp
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:semestre-mp).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.pagos_semestre_mp (
        id uuid primary key default gen_random_uuid(),
        institucion_id uuid not null references public.instituciones(id) on delete cascade,
        plan text not null,
        periodo text not null,
        meses integer not null,
        meses_a_pagar integer not null,
        monto integer not null,
        usa_mes_bonificado boolean not null default false,
        preferencia_id text,
        enlace text,
        estado text not null default 'pendiente',
        pago_id text unique,
        factura_id uuid references public.facturas(id) on delete set null,
        pagado_en timestamptz,
        creado_en timestamptz not null default now(),
        actualizado_en timestamptz not null default now(),
        constraint pagos_semestre_mp_estado_valido check (estado in ('pendiente', 'pagado', 'revisar')),
        constraint pagos_semestre_mp_monto_positivo check (monto > 0),
        constraint pagos_semestre_mp_meses_validos check (meses >= 2 and meses_a_pagar >= 1 and meses_a_pagar <= meses)
      )`;
    await tx`create index if not exists pagos_semestre_mp_institucion_idx on public.pagos_semestre_mp (institucion_id)`;
    await tx`create index if not exists pagos_semestre_mp_estado_idx on public.pagos_semestre_mp (estado, creado_en)`;
    await tx`alter table public.pagos_semestre_mp enable row level security`;
  });
  const [{ n }] = await sql`select count(*)::int as n from public.pagos_semestre_mp`;
  console.log(`Listo: pagos_semestre_mp creada, con RLS (${n} intentos).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
