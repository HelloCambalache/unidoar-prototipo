/*
 * Configuración del sitio público (pedido del cliente, 2026-11-25: «preferiría por el momento no mostrar los datos» de la portada): crea
 * `configuracion_sitio`, una sola fila (`id = 1`) con el interruptor `mostrar_cifras`, que arranca en `false` (oculto). Con RLS. Lo edita el equipo
 * en Backoffice → Sitio.
 *
 * Aditivo e idempotente (`create table if not exists`, la fila se inserta solo si falta y nunca se pisa): se corre ANTES de subir el código que la
 * usa. Si falta la tabla, el código la lee como «oculto» (no rompe nada), así que el orden no es crítico, pero conviene respetarlo para poder
 * prender el interruptor apenas se despliega. Una tabla nueva sin RLS queda expuesta a la clave pública: este script la activa. Si alguna vez se
 * hace `db:push`, correr `db:rls` después.
 * Uso: pnpm db:configuracion-sitio
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:configuracion-sitio).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists public.configuracion_sitio (
        id integer primary key default 1,
        mostrar_cifras boolean not null default false,
        actualizado_por uuid references public.usuarios(id) on delete set null,
        actualizado_en timestamptz not null default now(),
        constraint configuracion_sitio_una_fila check (id = 1)
      )`;
    await tx`insert into public.configuracion_sitio (id) values (1) on conflict (id) do nothing`;
    await tx`alter table public.configuracion_sitio enable row level security`;
  });
  const [{ mostrar }] = await sql`select mostrar_cifras as mostrar from public.configuracion_sitio where id = 1`;
  console.log(`Listo: configuracion_sitio creada, con RLS (cifras de la red: ${mostrar ? "visibles" : "ocultas"}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
