/*
 * Cambia el rol de una cuenta existente de Supabase Auth. Sirve para dar acceso al backoffice:
 *
 *   pnpm db:admin --email=correo@ejemplo.com              → rol admin (entra a /backoffice y también a las otras áreas)
 *   pnpm db:admin --email=correo@ejemplo.com --rol=institucion   → lo devuelve a un rol normal
 *
 * No crea cuentas: la cuenta se crea en Supabase (panel o /registro). Si todavía no tiene fila en
 * `usuarios`, se crea con el rol indicado.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { urlMigraciones } from "./conexion";
import * as s from "./schema";

const ROLES = ["admin", "institucion", "docente"] as const;
type Rol = (typeof ROLES)[number];

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const i = a.indexOf("=");
      return i < 0 ? [a.slice(2), "true"] : [a.slice(2, i), a.slice(i + 1)];
    }),
);

const url = urlMigraciones();
if (!url) {
  console.error("Falta la conexión a la base (corré el script con dotenv: pnpm db:admin).");
  process.exit(1);
}
const cliente = postgres(url, { max: 1 });
const db = drizzle(cliente, { schema: s });

async function main() {
  const email = args.email;
  const rol = (args.rol ?? "admin") as Rol;
  if (!email || !ROLES.includes(rol)) {
    console.error(`Uso: pnpm db:admin --email=correo [--rol=${ROLES.join("|")}]`);
    process.exitCode = 1;
    return;
  }
  const filas = await db.execute<{ id: string }>(sql`select id from auth.users where lower(email) = lower(${email}) limit 1`);
  const id = filas[0]?.id;
  if (!id) throw new Error(`No existe ninguna cuenta de Supabase con el correo ${email}.`);

  await db
    .insert(s.usuarios)
    .values({ id, email, rol })
    .onConflictDoUpdate({ target: s.usuarios.id, set: { rol } });
  console.log(`✓ ${email} ahora tiene rol "${rol}"`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => cliente.end());
