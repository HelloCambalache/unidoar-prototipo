/*
 * Testimonios administrables: agrega `testimonios.visible` (solo los visibles se muestran en el sitio) y OCULTA los testimonios que ya había, que son
 * los genéricos de ejemplo del seed (personas inventadas). No borra nada: desde Backoffice → Testimonios se pueden editar, mostrar de nuevo o eliminar.
 *
 * Aditivo e idempotente: la primera vez agrega la columna y oculta lo que había; las siguientes no tocan nada (así no esconde los testimonios que
 * el equipo cargó después). Hay que correrlo ANTES de desplegar el código que lee la columna: sin ella, la lectura de testimonios falla.
 * Uso: pnpm db:testimonios
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta POSTGRES_URL_NON_POOLING / POSTGRES_URL (corré el script con dotenv: pnpm db:testimonios).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  const [{ existe }] = await sql`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'testimonios' and column_name = 'visible'
    ) as existe`;

  if (existe) {
    console.log("✓ testimonios.visible ya existía: no se toca nada");
  } else {
    await sql.begin(async (tx) => {
      await tx`alter table public.testimonios add column visible boolean not null default true`;
      const ocultados = await tx`update public.testimonios set visible = false returning id`;
      console.log(`✓ testimonios.visible agregada; ${ocultados.length} testimonios de ejemplo quedaron ocultos`);
    });
  }

  const [{ n, visibles }] = await sql`select count(*)::int as n, count(*) filter (where visible)::int as visibles from public.testimonios`;
  console.log(`  Testimonios: ${n} en total, ${visibles} visibles`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
