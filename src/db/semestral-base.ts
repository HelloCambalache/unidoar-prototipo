/*
 * Semestre al contado: agrega `facturas.meses_cubiertos` (cuántos meses cubre una factura; 1 las mensuales, 6 el semestre pagado por adelantado).
 *
 * Aditivo e idempotente: las facturas que ya existen quedan en 1 (cubren su mes, como siempre). Hay que correrlo ANTES de desplegar el código
 * que la lee: sin la columna, cualquier consulta a `facturas` falla. Usa la misma conexión de migraciones que `db:planes`.
 * Uso: pnpm db:semestral
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta POSTGRES_URL_NON_POOLING / POSTGRES_URL (corré el script con dotenv: pnpm db:semestral).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql`alter table public.facturas add column if not exists meses_cubiertos integer not null default 1`;
  const [{ n, varios }] = await sql`select count(*)::int as n, count(*) filter (where meses_cubiertos > 1)::int as varios from public.facturas`;
  console.log(`✓ facturas.meses_cubiertos lista: ${n} facturas, ${varios} cubren más de un mes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
