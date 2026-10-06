/**
 * URL de conexión a Postgres (Supabase). Compartida por la app, el seed y drizzle-kit.
 *
 * - `POSTGRES_URL` es la del pooler de transacciones que provisiona la integración de Vercel;
 *   `DATABASE_URL` es el nombre genérico si se configura a mano.
 * - Para migraciones hace falta una conexión que soporte DDL/prepared statements: pooler en modo
 *   sesión o conexión directa (`POSTGRES_URL_NON_POOLING`).
 */
function limpiar(url: string) {
  try {
    const u = new URL(url);
    // La integración agrega ?supa=base-pooler.x: postgres-js lo mandaría como parámetro de servidor.
    u.searchParams.delete("supa");
    return u.toString();
  } catch {
    return url;
  }
}

export function urlApp() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  return url ? limpiar(url) : undefined;
}

export function urlMigraciones() {
  const url =
    process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  return url ? limpiar(url) : undefined;
}

/** El pooler de transacciones (puerto 6543) no admite prepared statements. */
export function usaPoolerDeTransacciones(url: string) {
  try {
    return new URL(url).port === "6543";
  } catch {
    return false;
  }
}
